import { Inject, Injectable, Logger } from "@nestjs/common";
import { sql, type Kysely } from "kysely";
import { ConfigService } from "@nestjs/config";
import type { WalletAdminOverview } from "@quatatrade/shared";
import type { Env } from "../../config/env";
import { DB } from "../../db/database.module";
import type { Database } from "../../db/types";
import { SettingsService } from "../settings/settings.service";
import { BlockchainRegistry } from "../blockchain/blockchain-registry.service";
import { ColdWalletService } from "../cold-wallet/cold-wallet.service";

/**
 * Admin Wallet Administration Center (Documents/10 D30, audit gap #10). Read-only
 * aggregation across wallets, deposits, withdrawals, the hot-wallet on-chain
 * balance, blockchain node sync, and cold-wallet status — the single custody view
 * the audit found scattered/absent.
 */
@Injectable()
export class WalletAdminService {
  private readonly logger = new Logger(WalletAdminService.name);

  constructor(
    @Inject(DB) private readonly db: Kysely<Database>,
    private readonly settings: SettingsService,
    private readonly chain: BlockchainRegistry,
    private readonly cold: ColdWalletService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  async overview(): Promise<WalletAdminOverview> {
    const num = (v: { n: number | string | bigint } | undefined) => Number(v?.n ?? 0);
    const amt = (v: { s: string | null } | undefined) => v?.s ?? "0";

    const [
      totalWallets,
      activeWallets,
      restrictedUsers,
      depPending,
      depCredited,
      depVolume,
      wdPendingApproval,
      wdRiskHold,
      wdFailed,
      wdConfirmed,
      wdVolume,
      hot,
      blockchain,
    ] = await Promise.all([
      this.db.selectFrom("deposit_addresses").select((eb) => eb.fn.countAll<bigint>().as("n")).executeTakeFirst(),
      this.db.selectFrom("deposit_addresses").select((eb) => eb.fn.countAll<bigint>().as("n")).where("active", "=", true).executeTakeFirst(),
      this.db.selectFrom("users").select((eb) => eb.fn.countAll<bigint>().as("n")).where("status", "in", ["frozen", "suspended"]).executeTakeFirst(),
      // A compliance-REJECTED deposit keeps its SEEN/CONFIRMING status (the hold
      // flags are what stop it crediting), so without this filter the custody
      // overview reports it as pending forever — the same defect fixed on the
      // user's wallet balance, on the page treasury uses to reconcile.
      this.db
        .selectFrom("deposits")
        .select((eb) => eb.fn.countAll<bigint>().as("n"))
        .where("status", "in", ["SEEN", "CONFIRMING"])
        .where((eb) => eb.or([eb("hold_resolution", "is", null), eb("hold_resolution", "!=", "REJECTED")]))
        .executeTakeFirst(),
      this.db.selectFrom("deposits").select((eb) => eb.fn.countAll<bigint>().as("n")).where("status", "=", "CREDITED").executeTakeFirst(),
      this.db.selectFrom("deposits").select(sql<string>`COALESCE(SUM(amount),0)::text`.as("s")).where("status", "=", "CREDITED").executeTakeFirst(),
      this.db.selectFrom("withdrawals").select((eb) => eb.fn.countAll<bigint>().as("n")).where("status", "=", "PENDING_APPROVAL").executeTakeFirst(),
      this.db.selectFrom("withdrawals").select((eb) => eb.fn.countAll<bigint>().as("n")).where("status", "=", "RISK_HOLD").executeTakeFirst(),
      this.db.selectFrom("withdrawals").select((eb) => eb.fn.countAll<bigint>().as("n")).where("status", "=", "FAILED").executeTakeFirst(),
      this.db.selectFrom("withdrawals").select((eb) => eb.fn.countAll<bigint>().as("n")).where("status", "=", "CONFIRMED").executeTakeFirst(),
      this.db.selectFrom("withdrawals").select(sql<string>`COALESCE(SUM(amount),0)::text`.as("s")).where("status", "=", "CONFIRMED").executeTakeFirst(),
      this.settings.hotWallet(),
      this.chain.healthAll(),
    ]);

    const hotAddress = this.config.get("WALLET_HOT_ADDRESS", { infer: true }).trim();
    const onChainBalance = hotAddress.length > 0 ? await this.hotBalance(hotAddress) : null;

    return {
      checkedAt: new Date().toISOString(),
      wallets: { total: num(totalWallets), active: num(activeWallets), restricted: num(restrictedUsers) },
      deposits: { pending: num(depPending), credited: num(depCredited), volume: amt(depVolume) },
      withdrawals: {
        pendingApproval: num(wdPendingApproval),
        riskHold: num(wdRiskHold),
        failed: num(wdFailed),
        confirmed: num(wdConfirmed),
        volume: amt(wdVolume),
      },
      hotWallet: {
        address: hotAddress.length > 0 ? hotAddress : null,
        onChainBalance,
        maxBalance: hot.maxBalance.toString(),
        minBalance: hot.minBalance.toString(),
        reserve: hot.reserve.toString(),
        alertThreshold: hot.alertThreshold.toString(),
      },
      blockchain,
      coldWallet: this.cold.status(),
    };
  }

  /** Best-effort on-chain hot-wallet balance — never throws (dashboard, not a money decision). */
  private async hotBalance(address: string): Promise<string | null> {
    try {
      const balance = await this.chain.forAsset("USDT_TRC20").getTokenBalance(address);
      return balance.toString();
    } catch (err) {
      this.logger.warn(`hot-wallet balance read failed: ${err instanceof Error ? err.message : "unknown"}`);
      return null;
    }
  }
}
