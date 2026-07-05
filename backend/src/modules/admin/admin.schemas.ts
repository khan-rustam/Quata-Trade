import { z, type ZodTypeAny } from "zod";
import {
  MAX_FEE_BPS,
  TRADE_STATUSES,
  WITHDRAWAL_STATUSES,
  zDepositPolicyValue,
  zFeeBpsValue,
  zLedgerAdjustmentRequest,
  zPagination,
  zPromoCampaignsValue,
  zUuid,
  zWithdrawalCapsValue,
  zWithdrawalFeeValue,
  zWithdrawalNetworkFeeValue,
  type LedgerAdjustmentRequest,
} from "@quatatrade/shared";

/**
 * Local (backend-only) zod schemas for admin inputs that have no shared
 * contract yet. Everything else comes from @quatatrade/shared. Strict:
 * unknown body fields are rejected; query objects strip unknowns.
 */

export const zAdminUsersQuery = zPagination.extend({
  /** substring match on email (ILIKE, escaped) */
  search: z.string().trim().min(1).max(320).optional(),
});
export type AdminUsersQuery = z.infer<typeof zAdminUsersQuery>;

/** YYYY-MM-DD inclusive day range for created_at filtering. */
const zDay = z.string().date();

export const zAdminTradesQuery = zPagination.extend({
  status: z.enum(TRADE_STATUSES).optional(),
  from: zDay.optional(),
  to: zDay.optional(),
});
export type AdminTradesQuery = z.infer<typeof zAdminTradesQuery>;

export const zAdminWithdrawalsQuery = zPagination.extend({
  status: z.enum(WITHDRAWAL_STATUSES).optional(),
  from: zDay.optional(),
  to: zDay.optional(),
});
export type AdminWithdrawalsQuery = z.infer<typeof zAdminWithdrawalsQuery>;

export const zAdminAuditQuery = zPagination.extend({
  actorType: z.string().trim().min(1).max(40).optional(),
  action: z.string().trim().min(1).max(120).optional(),
  from: zDay.optional(),
  to: zDay.optional(),
});
export type AdminAuditQuery = z.infer<typeof zAdminAuditQuery>;

/** Unsigned BIGINT smallest-units string. */
const zAmountStr = z.string().regex(/^\d{1,30}$/, "must be an integer amount string");

// The manual ledger-adjustment contract now lives in shared/ (FE + BE validate the
// same schema); re-exported so existing backend imports keep resolving here.
export { zLedgerAdjustmentRequest, type LedgerAdjustmentRequest };

const zTierLimitValue = z.object({ maxTrade: zAmountStr, dailyWithdrawal: zAmountStr }).strict();

/**
 * PATCH /admin/settings whitelist: key → value schema. Each schema mirrors
 * what SettingsService parses at read time, so an edit can never brick the
 * running app. kill_switches deliberately absent — it has its own endpoint.
 */
export const SETTING_VALUE_SCHEMAS: Readonly<Record<string, ZodTypeAny>> = {
  // Full 11-rail snapshot, each 0..MAX_FEE_BPS (< 100% so the trades CHECK holds).
  // Shared with the FE editor so both sides validate identically.
  fee_bps: zFeeBpsValue,
  trade_payment_window_minutes: z.number().int().min(5).max(1440),
  // Coherent ordering (auto <= dual <= per_tx <= daily, per_tx > 0), BigInt-compared.
  // The dual-approval threshold is enforced live by the withdrawals DB trigger.
  withdrawal_caps: zWithdrawalCapsValue,
  // Platform withdrawal fee per asset: fixed + percentage (combined). Legacy fixed-only
  // string form still accepted for back-compat.
  withdrawal_fee: zWithdrawalFeeValue,
  // Estimated on-chain network fee per asset, shown to the user (display only).
  withdrawal_network_fee: zWithdrawalNetworkFeeValue,
  // Action fees — 0 = disabled (fee-engine "exists but off"): ad-creation + dispute-open.
  advertisement_fee: zAmountStr,
  dispute_fee: zAmountStr,
  // Global SELLER trading fee bps (Phase 2: 0.2–0.5% → 20–50). 0 = disabled (Phase 1).
  seller_fee_bps: z.number().int().min(0).max(MAX_FEE_BPS),
  // Promotional fee campaigns (time + country + reduced/zero fee).
  promo_campaigns: zPromoCampaignsValue,
  kyc_tier_limits: z
    .record(z.string().regex(/^\d{1,2}$/), zTierLimitValue)
    .refine(
      (v) => ["0", "1", "2", "3"].every((tier) => v[tier] !== undefined),
      "kyc_tier_limits must define tiers 0-3",
    ),
  // min/max (gross) + platform deposit fee (fixed + percentage), with the refine
  // guaranteeing the fee never zeroes the smallest allowed deposit.
  deposit_policy: zDepositPolicyValue,
};

/** Local response shape for the KYC review queue (no shared schema exists). */
export const zKycQueueRow = z.object({
  id: zUuid,
  userId: zUuid,
  userEmail: z.string(),
  tier: z.number().int(),
  docType: z.string(),
  files: z.array(z.string()),
  submittedAt: z.string(),
  retentionDeleteAfter: z.string(),
});
export type KycQueueRow = z.infer<typeof zKycQueueRow>;
