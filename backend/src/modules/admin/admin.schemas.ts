import { z, type ZodTypeAny } from "zod";
import {
  ASSET_CODES,
  TRADE_STATUSES,
  WITHDRAWAL_STATUSES,
  zIdempotencyKey,
  zPagination,
  zTotpCode,
  zUuid,
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

/**
 * The ONLY manual money endpoint (Documents/08 §E: SUPER_ADMIN only +
 * mandatory reason + audit). amount is SIGNED: positive credits the user
 * (external → user_available), negative debits (user_available → external).
 */
export const zLedgerAdjustmentRequest = z
  .object({
    userId: zUuid,
    accountKind: z.literal("user_available"), // v1: only the user's available balance is adjustable
    asset: z.enum(ASSET_CODES).default("USDT_TRC20"),
    amount: z
      .string()
      .regex(/^-?\d{1,30}$/, "must be a signed integer amount string")
      .refine((v) => BigInt(v) !== 0n, "amount must be non-zero"),
    reason: z.string().trim().min(10).max(1000),
    idempotencyKey: zIdempotencyKey,
    totpCode: zTotpCode,
  })
  .strict();
export type LedgerAdjustmentRequest = z.infer<typeof zLedgerAdjustmentRequest>;

const zTierLimitValue = z.object({ maxTrade: zAmountStr, dailyWithdrawal: zAmountStr }).strict();

/**
 * PATCH /admin/settings whitelist: key → value schema. Each schema mirrors
 * what SettingsService parses at read time, so an edit can never brick the
 * running app. kill_switches deliberately absent — it has its own endpoint.
 */
export const SETTING_VALUE_SCHEMAS: Readonly<Record<string, ZodTypeAny>> = {
  fee_bps: z
    .object({
      QUATAPAY: z.number().int().min(0).max(10_000),
      MTN_MOMO: z.number().int().min(0).max(10_000),
      ORANGE_MONEY: z.number().int().min(0).max(10_000),
    })
    .strict(),
  trade_payment_window_minutes: z.number().int().min(5).max(1440),
  withdrawal_caps: z
    .object({
      per_tx_max: zAmountStr,
      daily_max: zAmountStr,
      dual_approval_threshold: zAmountStr,
      auto_approve_below: zAmountStr,
    })
    .strict(),
  withdrawal_fee: z
    .record(z.enum(ASSET_CODES), zAmountStr)
    .refine((v) => typeof v.USDT_TRC20 === "string", "withdrawal_fee must include USDT_TRC20"),
  kyc_tier_limits: z
    .record(z.string().regex(/^\d{1,2}$/), zTierLimitValue)
    .refine(
      (v) => ["0", "1", "2", "3"].every((tier) => v[tier] !== undefined),
      "kyc_tier_limits must define tiers 0-3",
    ),
  deposit_policy: z.object({ min_amount: zAmountStr, confirmations: z.number().int().min(1).max(200) }).strict(),
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
