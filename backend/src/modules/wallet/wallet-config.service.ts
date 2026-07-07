import { Inject, Injectable } from "@nestjs/common";
import type { Kysely, Selectable, Transaction } from "kysely";
import type {
  ActivateWalletConfigRequest,
  AdminWalletConfigResponse,
  WalletConfigSummary,
} from "@quatatrade/shared";
import { DB } from "../../db/database.module";
import type { Database, WalletConfigsTable } from "../../db/types";
import { newId } from "../../common/ids";
import { AuditService } from "../../common/audit/audit.service";
import { deriveTronAddress, TRON_ACCOUNT_PATH } from "./derivation";
import { WALLET_XPUB } from "./wallet.tokens";
import { WalletConfigInvalidXpubError, WalletConfigRotationBlockedError } from "./wallet.errors";

type WalletConfigRow = Selectable<WalletConfigsTable>;

const DEFAULT_NETWORK = "tron";

/**
 * wallet-config — admin key-ceremony support (Documents/10 D29).
 *
 * Owns the `wallet_configs` table: the account-level PUBLIC xpub that deposit
 * derivation uses. NEVER stores or accepts private key material — activate()
 * runs the submitted key through the watch-only derivation (which rejects any
 * xprv) before persisting it. WalletService reads the active xpub from here,
 * falling back to the env WALLET_XPUB when nothing is activated (dev).
 */
@Injectable()
export class WalletConfigService {
  constructor(
    @Inject(DB) private readonly db: Kysely<Database>,
    @Inject(WALLET_XPUB) private readonly envXpub: string,
    private readonly audit: AuditService,
  ) {}

  /**
   * The xpub deposit derivation must use: the DB-active config for the network,
   * else the env fallback. Callers derive addresses from this — never a private key.
   */
  async getActiveXpub(network: string = DEFAULT_NETWORK): Promise<string> {
    const row = await this.db
      .selectFrom("wallet_configs")
      .select("xpub")
      .where("network", "=", network)
      .where("active", "=", true)
      .executeTakeFirst();
    return row?.xpub ?? this.envXpub;
  }

  /** Admin view: active xpub + full history. Public info only. */
  async view(network: string = DEFAULT_NETWORK): Promise<AdminWalletConfigResponse> {
    const rows = await this.db
      .selectFrom("wallet_configs")
      .selectAll()
      .where("network", "=", network)
      .orderBy("created_at", "desc")
      .execute();
    const active = rows.find((r) => r.active);
    return {
      network,
      activeXpub: active?.xpub ?? null,
      usingEnvFallback: active === undefined,
      configs: rows.map((r) => this.toSummary(r)),
    };
  }

  /**
   * Key-ceremony activation. Validates the xpub via watch-only derivation
   * (rejects xprv/malformed), then swaps the active row inside one transaction
   * with an audit entry. Rotating once addresses were derived requires an
   * explicit acknowledgeReset (custody-continuity guard).
   */
  async activate(
    adminId: string,
    dto: ActivateWalletConfigRequest,
    ip?: string,
  ): Promise<AdminWalletConfigResponse> {
    const network = dto.network ?? DEFAULT_NETWORK;

    // Validate: must be a neutered account xpub that derives a real TRON address.
    // deriveTronAddress throws on xprv (isNeutered) and on any malformed key.
    let sampleAddress: string;
    try {
      sampleAddress = deriveTronAddress(dto.xpub, 0).address;
    } catch {
      throw new WalletConfigInvalidXpubError();
    }

    const current = await this.db
      .selectFrom("wallet_configs")
      .selectAll()
      .where("network", "=", network)
      .where("active", "=", true)
      .executeTakeFirst();

    // Idempotent: re-activating the SAME key is a no-op.
    if (current && current.xpub === dto.xpub) return this.view(network);

    // Rotation guard: refuse to change the key once addresses were derived from
    // it, unless the admin explicitly acknowledges the reset.
    const derived = await this.db
      .selectFrom("deposit_addresses")
      .select((eb) => eb.fn.countAll<bigint>().as("n"))
      .executeTakeFirstOrThrow();
    const derivedCount = Number(derived.n);
    if (derivedCount > 0 && !dto.acknowledgeReset) {
      throw new WalletConfigRotationBlockedError(derivedCount);
    }

    await this.db.transaction().execute(async (trx) => {
      if (current) {
        // Deactivate the previous active row FIRST so the partial-unique
        // (network) WHERE active index never sees two active rows.
        await trx.updateTable("wallet_configs").set({ active: false }).where("id", "=", current.id).execute();
      }
      await this.insertActive(trx, network, dto, adminId);
      await this.audit.log(
        {
          actorType: "admin",
          actorId: adminId,
          action: "wallet.config_activate",
          targetType: "wallet_config",
          ip,
          metadata: {
            network,
            sampleAddress,
            label: dto.label ?? null,
            reason: dto.reason,
            rotatedFrom: current?.xpub ?? null,
            acknowledgeReset: dto.acknowledgeReset ?? false,
            derivedAddressCount: derivedCount,
          },
        },
        trx,
      );
    });
    return this.view(network);
  }

  private async insertActive(
    trx: Transaction<Database>,
    network: string,
    dto: ActivateWalletConfigRequest,
    adminId: string,
  ): Promise<void> {
    await trx
      .insertInto("wallet_configs")
      .values({
        id: newId(),
        network,
        xpub: dto.xpub,
        derivation_path: TRON_ACCOUNT_PATH,
        label: dto.label ?? null,
        source: "ceremony",
        active: true,
        activated_by: adminId,
      })
      .execute();
  }

  private toSummary(r: WalletConfigRow): WalletConfigSummary {
    // Rows are only inserted after successful derivation, so index 0 always
    // derives; the guard keeps a hand-inserted/legacy row from throwing a read.
    let sampleAddress = "";
    try {
      sampleAddress = deriveTronAddress(r.xpub, 0).address;
    } catch {
      sampleAddress = "";
    }
    return {
      id: r.id,
      network: r.network,
      xpub: r.xpub,
      derivationPath: r.derivation_path,
      label: r.label,
      source: r.source === "env" ? "env" : "ceremony",
      sampleAddress,
      active: r.active,
      activatedBy: r.activated_by,
      createdAt: r.created_at.toISOString(),
    };
  }
}
