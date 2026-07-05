import { Inject, Injectable } from "@nestjs/common";
import type { Kysely } from "kysely";
import { z } from "zod";
import { FEE_BPS, MAX_FEE_BPS, zPromoCampaignsValue, type PaymentMethod, type PromoCampaignsValue } from "@quatatrade/shared";
import { DB } from "../../db/database.module";
import type { Database } from "../../db/types";

// Fee (bps) per rail — a record so new rails (migration 0016) don't break the parse.
// Bounded by MAX_FEE_BPS to agree with the write gate (zFeeBpsValue).
const zFeeBps = z.record(z.string(), z.number().int().min(0).max(MAX_FEE_BPS));
const zKillSwitches = z.object({ withdrawals_paused: z.boolean(), trades_paused: z.boolean() });
// Integer smallest-unit strings — fail loudly at read if a row is malformed rather
// than crashing later inside BigInt() during a withdrawal (matches the write gate).
const zAmountStr = z.string().regex(/^\d{1,30}$/, "must be an integer amount string");
const zWithdrawalCaps = z.object({
  per_tx_max: zAmountStr,
  daily_max: zAmountStr,
  dual_approval_threshold: zAmountStr,
  auto_approve_below: zAmountStr,
});
const zTierLimit = z.object({ maxTrade: z.string(), dailyWithdrawal: z.string() });
const zTierLimits = z.record(zTierLimit);
// Deposit fee fields are OPTIONAL on read with safe defaults (fee 0, no max), so a
// row that predates the fee config (or hasn't been PATCHed yet) still reads and simply
// charges no deposit fee — the write gate (zDepositPolicyValue) requires the full shape.
const zDepositPolicy = z.object({
  min_amount: zAmountStr,
  confirmations: z.number().int().min(1),
  max_amount: zAmountStr.optional(),
  fee_fixed: zAmountStr.default("0"),
  fee_bps: z.number().int().min(0).max(MAX_FEE_BPS).default(0),
});
// Platform withdrawal fee: legacy fixed-only string OR { fixed, bps }.
const zWithdrawalFeeRead = z.record(
  z.string(),
  z.union([zAmountStr, z.object({ fixed: zAmountStr, bps: z.number().int().min(0).max(MAX_FEE_BPS) })]),
);

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

  async feeBps(method: PaymentMethod): Promise<number> {
    // Fall back to the compiled default if a rail somehow isn't in the settings row.
    return zFeeBps.parse(await this.raw("fee_bps"))[method] ?? FEE_BPS[method];
  }

  /**
   * Global SELLER trading fee bps (fee-engine Phase 2 — added to the seller's escrow
   * lock; borne by the seller). 0 = disabled (Phase 1). Reads the seller_fee_bps
   * settings row; 0 when the key isn't seeded/malformed so it can never brick a trade.
   */
  async sellerFeeBps(): Promise<number> {
    try {
      return z.coerce.number().int().min(0).max(MAX_FEE_BPS).parse(await this.raw("seller_fee_bps"));
    } catch {
      return 0;
    }
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

  /**
   * Caps read LIVE within a caller's transaction (bypasses the TTL cache). The
   * withdrawal approval decision must use the exact same dual_approval_threshold the
   * DB trigger will read; otherwise a threshold edited on another API instance (whose
   * cache is stale for up to CACHE_TTL_MS) can make the app single-approve a withdrawal
   * the trigger then rejects — an ungraceful 500 rather than the intended gating.
   */
  async withdrawalCapsIn(db: Kysely<Database>): Promise<{
    perTxMax: bigint;
    dailyMax: bigint;
    dualApprovalThreshold: bigint;
    autoApproveBelow: bigint;
  }> {
    const row = await db.selectFrom("settings").select("value").where("key", "=", "withdrawal_caps").executeTakeFirst();
    if (!row) throw new Error("missing setting: withdrawal_caps");
    const v = zWithdrawalCaps.parse(row.value);
    return {
      perTxMax: BigInt(v.per_tx_max),
      dailyMax: BigInt(v.daily_max),
      dualApprovalThreshold: BigInt(v.dual_approval_threshold),
      autoApproveBelow: BigInt(v.auto_approve_below),
    };
  }

  /**
   * Platform withdrawal fee CONFIG for an asset: { fixed, bps }. The money math
   * (fixed + floor(amount*bps/10000)) lives in the withdrawal service. Accepts the
   * legacy fixed-only string form for back-compat (normalised to bps 0).
   */
  async withdrawalFee(asset: string): Promise<{ fixed: bigint; bps: number }> {
    const v = zWithdrawalFeeRead.parse(await this.raw("withdrawal_fee"));
    const entry = v[asset];
    if (entry === undefined) throw new Error(`no withdrawal fee configured for ${asset}`);
    return typeof entry === "string" ? { fixed: BigInt(entry), bps: 0 } : { fixed: BigInt(entry.fixed), bps: entry.bps };
  }

  /** Estimated on-chain network fee for an asset (display only). 0 when unset. */
  async withdrawalNetworkFee(asset: string): Promise<bigint> {
    try {
      const v = z.record(z.string(), zAmountStr).parse(await this.raw("withdrawal_network_fee"));
      return v[asset] !== undefined ? BigInt(v[asset]) : 0n;
    } catch {
      return 0n; // key not seeded yet → no estimate
    }
  }

  /** Advertisement (offer-creation) fee — 0 = disabled. */
  async advertisementFee(): Promise<bigint> {
    return this.simpleAmount("advertisement_fee");
  }

  /** Dispute-open fee — 0 = disabled. */
  async disputeFee(): Promise<bigint> {
    return this.simpleAmount("dispute_fee");
  }

  /** A single smallest-unit amount stored as a JSON string; 0 when unset/absent. */
  private async simpleAmount(key: string): Promise<bigint> {
    try {
      return BigInt(zAmountStr.parse(await this.raw(key)));
    } catch {
      return 0n;
    }
  }

  /** Active + inactive promotional fee campaigns; [] when unset/malformed. */
  async promoCampaigns(): Promise<PromoCampaignsValue> {
    try {
      return zPromoCampaignsValue.parse(await this.raw("promo_campaigns"));
    } catch {
      return [];
    }
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

  /**
   * Deposit policy (settings key "deposit_policy"): gross min/max + the platform
   * deposit fee (fixed + percentage). maxAmount is null when no cap is configured.
   */
  async depositPolicy(): Promise<{
    minAmount: bigint;
    maxAmount: bigint | null;
    feeFixed: bigint;
    feeBps: number;
    confirmations: number;
  }> {
    const v = zDepositPolicy.parse(await this.raw("deposit_policy"));
    return {
      minAmount: BigInt(v.min_amount),
      maxAmount: v.max_amount !== undefined ? BigInt(v.max_amount) : null,
      feeFixed: BigInt(v.fee_fixed),
      feeBps: v.fee_bps,
      confirmations: v.confirmations,
    };
  }

  /**
   * Snapshot for the admin settings console. Amounts are smallest-unit strings
   * (never number). fee_bps + withdrawal_caps are now editable via PATCH
   * /admin/settings: fee_bps is validated as a full 11-rail snapshot (0..MAX_FEE_BPS)
   * so a save can't drop a rail, and withdrawal_caps enforces the ordering invariant
   * with the dual-approval threshold reconciled to the live DB trigger — so a UI edit
   * can no longer diverge from the DB or brick the withdrawal pipeline.
   */
  async adminSnapshot(): Promise<{
    paymentWindowMinutes: number;
    depositPolicy: { minAmount: string; maxAmount: string | null; feeFixed: string; feeBps: number; confirmations: number };
    feeBps: Record<string, number>;
    sellerFeeBps: number;
    withdrawalCaps: { perTxMax: string; dailyMax: string; dualApprovalThreshold: string; autoApproveBelow: string };
  }> {
    const [window, deposit, caps, feeBps, sellerFeeBps] = await Promise.all([
      this.tradePaymentWindowMinutes(),
      this.depositPolicy(),
      this.withdrawalCaps(),
      this.raw("fee_bps").then((v) => zFeeBps.parse(v)),
      this.sellerFeeBps(),
    ]);
    return {
      paymentWindowMinutes: window,
      depositPolicy: {
        minAmount: deposit.minAmount.toString(),
        maxAmount: deposit.maxAmount !== null ? deposit.maxAmount.toString() : null,
        feeFixed: deposit.feeFixed.toString(),
        feeBps: deposit.feeBps,
        confirmations: deposit.confirmations,
      },
      feeBps,
      sellerFeeBps,
      withdrawalCaps: {
        perTxMax: caps.perTxMax.toString(),
        dailyMax: caps.dailyMax.toString(),
        dualApprovalThreshold: caps.dualApprovalThreshold.toString(),
        autoApproveBelow: caps.autoApproveBelow.toString(),
      },
    };
  }

  /** Security hold windows (settings key "security_holds"): new-address cooldown in minutes. */
  async securityHolds(): Promise<{ newAddressMinutes: number }> {
    const v = z
      .object({ new_address_minutes: z.coerce.number().int().min(0) })
      .parse(await this.raw("security_holds"));
    return { newAddressMinutes: v.new_address_minutes };
  }
}
