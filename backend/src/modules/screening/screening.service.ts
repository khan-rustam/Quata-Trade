import { Inject, Injectable, Logger } from "@nestjs/common";
import type { Kysely, Selectable } from "kysely";
import type { AssetCode, BlockAddressRequest, BlockedAddress } from "@quatatrade/shared";
import { DB } from "../../db/database.module";
import type { Database, BlockedAddressesTable } from "../../db/types";
import { newId } from "../../common/ids";
import { BlockedAddressError } from "./screening.errors";

export interface ScreeningResult {
  blocked: boolean;
  category: string | null;
  reason: string | null;
}

type BlockedRow = Selectable<BlockedAddressesTable>;

function toWire(r: BlockedRow): BlockedAddress {
  return {
    id: r.id,
    asset: r.asset,
    address: r.address,
    // Narrowed to the shared enum at the API boundary; DB stores free text.
    category: r.category === "sanctions" || r.category === "blacklist" ? r.category : "manual",
    reason: r.reason,
    source: r.source,
    active: r.active,
    createdAt: r.created_at.toISOString(),
  };
}

/**
 * AML / sanctions / wallet-blacklist screening (security remediation item 4).
 *
 * A single deterministic blocklist — no external calls, no LLM (Documents/12:
 * risk/fraud decisions are deterministic). check() is the read primitive;
 * assertAllowed() is the outbound chokepoint (withdrawals) that additionally
 * raises an aml.hit alert and refuses the operation. block()/unblock()/list()
 * are the compliance-managed surface.
 */
@Injectable()
export class ScreeningService {
  private readonly logger = new Logger(ScreeningService.name);

  constructor(@Inject(DB) private readonly db: Kysely<Database>) {}

  /** Deterministic active-blocklist lookup for one (asset, address). */
  async check(asset: AssetCode, address: string): Promise<ScreeningResult> {
    const hit = await this.db
      .selectFrom("blocked_addresses")
      .select(["category", "reason"])
      .where("asset", "=", asset)
      .where("address", "=", address)
      .where("active", "=", true)
      .executeTakeFirst();
    return hit
      ? { blocked: true, category: hit.category, reason: hit.reason }
      : { blocked: false, category: null, reason: null };
  }

  /**
   * Outbound guard: on a hit, record an aml.hit event (AlertsService pages the
   * on-call + logs) and throw BlockedAddressError. Never silently lets a blocked
   * address through. The event insert is best-effort — a failed insert must not
   * turn a block into an allow, so a blocked address still throws.
   */
  async assertAllowed(
    asset: AssetCode,
    address: string,
    ctx: { userId: string; stage: string },
  ): Promise<void> {
    const res = await this.check(asset, address);
    if (!res.blocked) return;
    try {
      await this.db
        .insertInto("outbox")
        .values({
          id: newId(),
          event_type: "aml.hit",
          payload: JSON.stringify({
            userId: ctx.userId,
            asset,
            address,
            category: res.category,
            reason: res.reason,
            stage: ctx.stage,
          }),
        })
        .execute();
    } catch (err) {
      this.logger.error(`aml.hit event insert failed (still blocking): ${err instanceof Error ? err.message : "unknown"}`);
    }
    throw new BlockedAddressError(res.reason ?? "address is blocked", res.category ?? "manual");
  }

  // --------------------------------------------------------- compliance surface

  /** Full blocklist (most recent first) for the compliance console. */
  async listBlocked(): Promise<BlockedAddress[]> {
    const rows = await this.db
      .selectFrom("blocked_addresses")
      .selectAll()
      .orderBy("created_at", "desc")
      .execute();
    return rows.map(toWire);
  }

  /** Add or re-activate a blocklist entry (idempotent on asset+address). */
  async block(input: BlockAddressRequest, adminId: string): Promise<BlockedAddress> {
    const row = await this.db
      .insertInto("blocked_addresses")
      .values({
        id: newId(),
        asset: input.asset,
        address: input.address,
        category: input.category,
        reason: input.reason,
        source: input.source ?? "manual",
        created_by: adminId,
      })
      .onConflict((oc) =>
        oc.columns(["asset", "address"]).doUpdateSet({
          category: input.category,
          reason: input.reason,
          source: input.source ?? "manual",
          active: true,
          created_by: adminId,
          updated_at: new Date(),
        }),
      )
      .returningAll()
      .executeTakeFirstOrThrow();
    return toWire(row);
  }

  /** Deactivate an entry (soft — audit trail preserved). Idempotent. */
  async unblock(id: string): Promise<void> {
    await this.db
      .updateTable("blocked_addresses")
      .set({ active: false, updated_at: new Date() })
      .where("id", "=", id)
      .execute();
  }
}
