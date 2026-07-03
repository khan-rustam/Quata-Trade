import { Inject, Injectable } from "@nestjs/common";
import type { Kysely } from "kysely";
import { z } from "zod";
import { DB } from "../../db/database.module";
import type { Database } from "../../db/types";

const zFeeBps = z.object({ QUATAPAY: z.number().int(), MTN_MOMO: z.number().int(), ORANGE_MONEY: z.number().int() });
const zKillSwitches = z.object({ withdrawals_paused: z.boolean(), trades_paused: z.boolean() });
const zWithdrawalCaps = z.object({
  per_tx_max: z.string(),
  daily_max: z.string(),
  dual_approval_threshold: z.string(),
  auto_approve_below: z.string(),
});
const zTierLimit = z.object({ maxTrade: z.string(), dailyWithdrawal: z.string() });
const zTierLimits = z.record(zTierLimit);
const zDepositPolicy = z.object({ min_amount: z.string(), confirmations: z.number().int().min(1) });

const CACHE_TTL_MS = 10_000;

/**
 * Reads runtime-tunable business config from the `settings` table
 * (seeded in migration 0006; edited only via admin module with audit).
 * Short-TTL cache: kill switches must take effect within seconds.
 */
@Injectable()
export class SettingsService {
  private cache = new Map<string, { value: unknown; expires: number }>();

  constructor(@Inject(DB) private readonly db: Kysely<Database>) {}

  private async raw(key: string): Promise<unknown> {
    const hit = this.cache.get(key);
    if (hit && hit.expires > Date.now()) return hit.value;
    const row = await this.db.selectFrom("settings").select("value").where("key", "=", key).executeTakeFirst();
    if (!row) throw new Error(`missing setting: ${key}`);
    this.cache.set(key, { value: row.value, expires: Date.now() + CACHE_TTL_MS });
    return row.value;
  }

  /** Test/admin hook: drop the cache so changes apply immediately. */
  invalidate(): void {
    this.cache.clear();
  }

  async feeBps(method: "QUATAPAY" | "MTN_MOMO" | "ORANGE_MONEY"): Promise<number> {
    return zFeeBps.parse(await this.raw("fee_bps"))[method];
  }

  async tradePaymentWindowMinutes(): Promise<number> {
    return z.coerce.number().int().min(5).max(1440).parse(await this.raw("trade_payment_window_minutes"));
  }

  async killSwitches(): Promise<{ withdrawalsPaused: boolean; tradesPaused: boolean }> {
    const v = zKillSwitches.parse(await this.raw("kill_switches"));
    return { withdrawalsPaused: v.withdrawals_paused, tradesPaused: v.trades_paused };
  }

  async withdrawalCaps(): Promise<{
    perTxMax: bigint;
    dailyMax: bigint;
    dualApprovalThreshold: bigint;
    autoApproveBelow: bigint;
  }> {
    const v = zWithdrawalCaps.parse(await this.raw("withdrawal_caps"));
    return {
      perTxMax: BigInt(v.per_tx_max),
      dailyMax: BigInt(v.daily_max),
      dualApprovalThreshold: BigInt(v.dual_approval_threshold),
      autoApproveBelow: BigInt(v.auto_approve_below),
    };
  }

  async withdrawalFee(asset: string): Promise<bigint> {
    const v = z.record(z.string()).parse(await this.raw("withdrawal_fee"));
    const fee = v[asset];
    if (fee === undefined) throw new Error(`no withdrawal fee configured for ${asset}`);
    return BigInt(fee);
  }

  async kycTierLimits(tier: number): Promise<{ maxTrade: bigint; dailyWithdrawal: bigint }> {
    const v = zTierLimits.parse(await this.raw("kyc_tier_limits"));
    const limits = v[String(tier)];
    if (!limits) throw new Error(`no limits configured for KYC tier ${tier}`);
    return { maxTrade: BigInt(limits.maxTrade), dailyWithdrawal: BigInt(limits.dailyWithdrawal) };
  }

  /** KYC document retention window in days (seeded 1825 — data-protection schedule). */
  async kycRetentionDays(): Promise<number> {
    return z.coerce.number().int().min(1).max(36500).parse(await this.raw("kyc_retention_days"));
  }

  /** Deposit display policy (settings key "deposit_policy"): min amount + confirmations. */
  async depositPolicy(): Promise<{ minAmount: bigint; confirmations: number }> {
    const v = zDepositPolicy.parse(await this.raw("deposit_policy"));
    return { minAmount: BigInt(v.min_amount), confirmations: v.confirmations };
  }

  /** Security hold windows (settings key "security_holds"): new-address cooldown in minutes. */
  async securityHolds(): Promise<{ newAddressMinutes: number }> {
    const v = z
      .object({ new_address_minutes: z.coerce.number().int().min(0) })
      .parse(await this.raw("security_holds"));
    return { newAddressMinutes: v.new_address_minutes };
  }
}
