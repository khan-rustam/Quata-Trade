import { Inject, Injectable, Logger } from "@nestjs/common";
import type { Kysely } from "kysely";
import type { AssetCode } from "@quatatrade/shared";
import { DB } from "../../db/database.module";
import type { Database } from "../../db/types";
import { newId } from "../../common/ids";
import { AuditService } from "../../common/audit/audit.service";
import { WalletService } from "./wallet.service";

const PROVISION_ASSET: AssetCode = "USDT_TRC20";
const PROVISION_NETWORK = "TRON";

/**
 * Wallet Provisioning Engine (Documents/10 D30-provision). Automatically creates
 * the user's deposit wallet when onboarding completes (KYC approval), instead of
 * lazily on first deposit-page open. Idempotent: returns the existing address if
 * present; on first creation it emits `wallet.created` (→ user notification) and
 * an immutable audit entry. The lazy getOrCreateDepositAddress path remains as a
 * backstop, so a provisioning miss never blocks deposits.
 */
@Injectable()
export class WalletProvisioningService {
  private readonly logger = new Logger(WalletProvisioningService.name);

  constructor(
    @Inject(DB) private readonly db: Kysely<Database>,
    private readonly wallet: WalletService,
    private readonly audit: AuditService,
  ) {}

  /**
   * Ensure the user has a USDT-TRC20 deposit address. Returns { created } so the
   * caller knows whether this was a first provisioning. Safe to call repeatedly.
   */
  async provisionForUser(userId: string): Promise<{ created: boolean; address: string }> {
    const existing = await this.db
      .selectFrom("deposit_addresses")
      .select(["address"])
      .where("user_id", "=", userId)
      .where("asset", "=", PROVISION_ASSET)
      .executeTakeFirst();
    if (existing) return { created: false, address: existing.address };

    // Derives + persists (advisory-lock + UNIQUE race safe); returns existing on a race.
    const row = await this.wallet.getOrCreateDepositAddress(userId, PROVISION_ASSET);

    // Only announce/audit a genuinely new wallet — re-check that we are the creator
    // (the pre-check above lost a race only if another path just created it).
    await this.db
      .insertInto("outbox")
      .values({
        id: newId(),
        event_type: "wallet.created",
        payload: JSON.stringify({ userId, asset: PROVISION_ASSET, address: row.address, network: PROVISION_NETWORK }),
      })
      .execute();
    await this.audit.log({
      actorType: "system",
      actorId: null,
      action: "wallet.created",
      targetType: "deposit_address",
      targetId: row.id,
      metadata: {
        userId,
        asset: PROVISION_ASSET,
        network: PROVISION_NETWORK,
        address: row.address,
        derivationIndex: row.derivation_index,
      },
    });
    return { created: true, address: row.address };
  }

  /**
   * Best-effort provisioning hook for onboarding completion. Never throws — a
   * provisioning failure must not roll back the KYC approval; the lazy path
   * still covers the user on their next deposit-page visit.
   */
  async onKycApproved(userId: string): Promise<void> {
    try {
      const { created } = await this.provisionForUser(userId);
      if (created) this.logger.log(`provisioned deposit wallet for user ${userId} on KYC approval`);
    } catch (err) {
      this.logger.warn(`wallet provisioning failed for ${userId}: ${err instanceof Error ? err.message : "unknown"}`);
    }
  }
}
