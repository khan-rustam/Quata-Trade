import { z } from "zod";
import {
  ADMIN_ROLES,
  ASSET_CODES,
  KYC_STATUSES,
  MAX_FEE_BPS,
  OFFER_SIDES,
  PAYMENT_METHODS,
  TRADE_STATUSES,
  USER_STATUSES,
  WITHDRAWAL_STATUSES,
} from "../constants.js";
import { zAmount, zEmail, zIdempotencyKey, zPaginated, zTotpCode, zUuid } from "./common.js";

export const zAdminLoginRequest = z
  .object({
    email: zEmail,
    password: z.string().min(1).max(128),
    // 2FA is optional (test phase): required only if the admin enabled it.
    totpCode: zTotpCode.optional(),
  })
  .strict();
export type AdminLoginRequest = z.infer<typeof zAdminLoginRequest>;

export const zAdminProfile = z.object({
  id: zUuid,
  email: z.string(),
  role: z.enum(ADMIN_ROLES),
  totpEnabled: z.boolean(),
});
export type AdminProfile = z.infer<typeof zAdminProfile>;

export const zAdminUserRow = z.object({
  id: zUuid,
  email: z.string(),
  phone: z.string().nullable(),
  kycTier: z.number().int(),
  kycStatus: z.enum(KYC_STATUSES),
  status: z.enum(USER_STATUSES),
  reputationScore: z.number().int(),
  createdAt: z.string(),
});
export const zAdminUsersResponse = zPaginated(zAdminUserRow);

export const zFreezeUserRequest = z
  .object({ reason: z.string().trim().min(5).max(1000) })
  .strict();

export const zAdminWithdrawalRow = z.object({
  id: zUuid,
  userId: zUuid,
  userEmail: z.string(),
  asset: z.string(),
  toAddress: z.string(),
  amount: zAmount,
  fee: zAmount,
  status: z.enum(WITHDRAWAL_STATUSES),
  riskScore: z.number().int().nullable(),
  riskFlags: z.record(z.unknown()).nullable(),
  requiresSecondApprover: z.boolean(),
  approvedBy: zUuid.nullable(),
  secondApprover: zUuid.nullable(),
  createdAt: z.string(),
});
export const zAdminWithdrawalsResponse = zPaginated(zAdminWithdrawalRow);

export const zApproveWithdrawalRequest = z
  .object({ totpCode: zTotpCode.optional(), notes: z.string().max(1000).optional() })
  .strict();
export type ApproveWithdrawalRequest = z.infer<typeof zApproveWithdrawalRequest>;
export const zRejectWithdrawalRequest = z
  .object({ totpCode: zTotpCode.optional(), reason: z.string().trim().min(5).max(1000) })
  .strict();
export type RejectWithdrawalRequest = z.infer<typeof zRejectWithdrawalRequest>;

export const zKillSwitchState = z.object({
  withdrawalsPaused: z.boolean(),
  tradesPaused: z.boolean(),
});
export type KillSwitchState = z.infer<typeof zKillSwitchState>;

/** Runtime-tunable business config for the admin settings console (read snapshot).
 * Amounts are smallest-unit strings. Every field is editable via PATCH /admin/settings
 * with TOTP step-up; feeBps + withdrawalCaps are validated by the hardened value
 * schemas below (zFeeBpsValue / zWithdrawalCapsValue). */
export const zAdminSettingsResponse = z.object({
  paymentWindowMinutes: z.number().int(),
  depositPolicy: z.object({ minAmount: zAmount, confirmations: z.number().int() }),
  feeBps: z.record(z.string(), z.number().int()),
  withdrawalCaps: z.object({
    perTxMax: zAmount,
    dailyMax: zAmount,
    dualApprovalThreshold: zAmount,
    autoApproveBelow: zAmount,
  }),
});
export type AdminSettingsResponse = z.infer<typeof zAdminSettingsResponse>;

/**
 * fee_bps write value — a FULL snapshot of every payment rail (0..MAX_FEE_BPS bps).
 * Derived from PAYMENT_METHODS so a new rail is covered automatically; requiring every
 * rail makes the settings full-value REPLACE unable to silently drop a rail's fee, and
 * rejecting unknown rails keeps the row clean. The FE editor imports this to validate
 * identically. The write gate (SETTING_VALUE_SCHEMAS) reuses it.
 */
const zBpsValue = z.number().int().min(0).max(MAX_FEE_BPS);
export const zFeeBpsValue = z
  .record(z.enum(PAYMENT_METHODS), zBpsValue)
  .refine((v) => PAYMENT_METHODS.every((m) => typeof v[m] === "number"), {
    message: `fee_bps must include every rail: ${PAYMENT_METHODS.join(", ")}`,
  });
export type FeeBpsValue = z.infer<typeof zFeeBpsValue>;

/**
 * withdrawal_caps write value. Smallest-unit strings with the ordering invariant the
 * withdrawal service assumes: 0 < per_tx_max, auto_approve_below <= dual_approval_threshold
 * <= per_tx_max <= daily_max. Compared as BigInt (never Number) so 30-digit values are
 * exact. The dual-approval threshold is enforced live by a DB trigger (see the
 * dual-approval migration), so it is freely settable within this coherent range.
 */
// Smallest-unit cap amount. Bounded to <= 30 digits so a written value can never
// exceed what the SettingsService READ schema accepts (an over-long value would pass
// the write but throw on every read, bricking withdrawals). The superRefine also caps
// it at the PG int8 max: withdrawal.amount is int8 and the dual-approval trigger casts
// the threshold to bigint, so a larger value would overflow that cast.
const zCapAmount = z.string().regex(/^\d{1,30}$/, "cap must be a smallest-unit integer string");
const MAX_INT8 = 9223372036854775807n;
export const zWithdrawalCapsValue = z
  .object({
    per_tx_max: zCapAmount,
    daily_max: zCapAmount,
    dual_approval_threshold: zCapAmount,
    auto_approve_below: zCapAmount,
  })
  .strict()
  .superRefine((v, ctx) => {
    const perTx = BigInt(v.per_tx_max);
    const daily = BigInt(v.daily_max);
    const dual = BigInt(v.dual_approval_threshold);
    const auto = BigInt(v.auto_approve_below);
    if (perTx <= 0n) ctx.addIssue({ code: z.ZodIssueCode.custom, message: "per_tx_max must be greater than zero", path: ["per_tx_max"] });
    if (daily > MAX_INT8) ctx.addIssue({ code: z.ZodIssueCode.custom, message: "daily_max exceeds the maximum supported amount", path: ["daily_max"] });
    if (perTx > daily) ctx.addIssue({ code: z.ZodIssueCode.custom, message: "per_tx_max must be <= daily_max", path: ["per_tx_max"] });
    if (dual > perTx) ctx.addIssue({ code: z.ZodIssueCode.custom, message: "dual_approval_threshold must be <= per_tx_max", path: ["dual_approval_threshold"] });
    if (auto > dual) ctx.addIssue({ code: z.ZodIssueCode.custom, message: "auto_approve_below must be <= dual_approval_threshold", path: ["auto_approve_below"] });
  });
export type WithdrawalCapsValue = z.infer<typeof zWithdrawalCapsValue>;

/**
 * Manual ledger adjustment — the ONLY manual money endpoint (Documents/08 §E:
 * SUPER_ADMIN only + mandatory reason + audit). `amount` is a SIGNED smallest-unit
 * string: positive credits the user (external → user_available), negative debits.
 * Shared so the admin FE validates the exact same contract the backend enforces.
 */
export const zLedgerAdjustmentRequest = z
  .object({
    userId: zUuid,
    accountKind: z.literal("user_available"), // v1: only the user's available balance is adjustable
    asset: z.enum(ASSET_CODES).default("USDT_TRC20"),
    // Validate format THEN non-zero in one pass — a bare `.refine(BigInt(v)!==0n)`
    // after `.regex()` throws on a malformed value (zod still runs the refine).
    amount: z.string().superRefine((v, ctx) => {
      if (!/^-?\d{1,30}$/.test(v)) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: "must be a signed integer amount string" });
        return;
      }
      if (BigInt(v) === 0n) ctx.addIssue({ code: z.ZodIssueCode.custom, message: "amount must be non-zero" });
    }),
    reason: z.string().trim().min(10).max(1000),
    idempotencyKey: zIdempotencyKey,
    totpCode: zTotpCode,
  })
  .strict();
export type LedgerAdjustmentRequest = z.infer<typeof zLedgerAdjustmentRequest>;

export const zLedgerAdjustmentResponse = z.object({
  journalId: zUuid,
  replayed: z.boolean(),
});
export type LedgerAdjustmentResponse = z.infer<typeof zLedgerAdjustmentResponse>;

export const zKillSwitchRequest = z
  .object({
    target: z.enum(["withdrawals", "trades"]),
    paused: z.boolean(),
    totpCode: zTotpCode.optional(),
    reason: z.string().trim().min(5).max(1000),
  })
  .strict();
export type KillSwitchRequest = z.infer<typeof zKillSwitchRequest>;

export const zAdminKpisResponse = z.object({
  totalUsers: z.number().int(),
  activeTrades: z.number().int(),
  tradesLast24h: z.number().int(),
  volumeLast24h: zAmount,
  escrowLockedTotal: zAmount,
  treasuryBalance: zAmount,
  openDisputes: z.number().int(),
  pendingKyc: z.number().int(),
  pendingWithdrawals: z.number().int(),
  riskFlagsLast24h: z.number().int(),
});
export type AdminKpisResponse = z.infer<typeof zAdminKpisResponse>;

export const zAdminTradeRow = z.object({
  id: zUuid,
  shortRef: z.string(),
  sellerEmail: z.string(),
  buyerEmail: z.string(),
  amount: zAmount,
  feeAmount: zAmount,
  status: z.enum(TRADE_STATUSES),
  createdAt: z.string(),
});
export const zAdminTradesResponse = zPaginated(zAdminTradeRow);

export const zAuditLogRow = z.object({
  id: zUuid,
  actorType: z.string(),
  actorId: zUuid.nullable(),
  action: z.string(),
  targetType: z.string().nullable(),
  targetId: zUuid.nullable(),
  ip: z.string().nullable(),
  metadata: z.record(z.unknown()).nullable(),
  createdAt: z.string(),
});
export const zAuditLogsResponse = zPaginated(zAuditLogRow);

export const zUpdateSettingRequest = z
  .object({
    key: z.string().min(1).max(120),
    value: z.unknown(),
    totpCode: zTotpCode.optional(),
  })
  .strict();
export type UpdateSettingRequest = z.infer<typeof zUpdateSettingRequest>;

// ---- KYC review queue ----
export const zAdminKycQueueRow = z.object({
  id: zUuid,
  userId: zUuid,
  userEmail: z.string(),
  tier: z.number().int(),
  docType: z.string(),
  files: z.array(z.string()),
  submittedAt: z.string(),
  retentionDeleteAfter: z.string(),
});
export const zAdminKycQueueResponse = zPaginated(zAdminKycQueueRow);

// ---- KYC document viewer (presigned, short-TTL, kycReview-gated) ----
export const zAdminKycDocument = z.object({
  key: z.string(),
  url: z.string(),
  kind: z.enum(["image", "pdf", "other"]),
});
export const zAdminKycDocumentsResponse = z.object({
  submissionId: zUuid,
  ttlSeconds: z.number().int(),
  documents: z.array(zAdminKycDocument),
});
export type AdminKycDocumentsResponse = z.infer<typeof zAdminKycDocumentsResponse>;

// ---- dispute queue ----
export const zAdminDisputeRow = z.object({
  id: zUuid,
  tradeId: zUuid,
  tradeShortRef: z.string(),
  tradeStatus: z.enum(TRADE_STATUSES),
  amount: zAmount,
  openedBy: zUuid,
  reason: z.string(),
  status: z.string(),
  createdAt: z.string(),
});
export const zAdminDisputesResponse = zPaginated(zAdminDisputeRow);

// ---- treasury / revenue ----
export const zAdminRevenueResponse = z.object({
  today: zAmount,
  month: zAmount,
  lifetime: zAmount,
});
export type AdminRevenueResponse = z.infer<typeof zAdminRevenueResponse>;

export const zAdminTreasuryResponse = z.object({
  treasury: z.string(),
  pendingSweep: z.string(),
  external: z.string(),
});
export type AdminTreasuryResponse = z.infer<typeof zAdminTreasuryResponse>;

// ---- metrics timeseries (dashboard charts + report page) ----
export const zAdminMetricsQuery = z.object({
  days: z.coerce.number().int().min(1).max(365).default(30),
});
export type AdminMetricsQuery = z.infer<typeof zAdminMetricsQuery>;

export const zAdminMetricsPoint = z.object({
  /** YYYY-MM-DD (UTC day bucket) */
  date: z.string(),
  signups: z.number().int(),
  trades: z.number().int(),
  /** completed-trade USDT volume, smallest units (string) */
  volumeUsdt: zAmount,
  /** fees earned that day, USDT smallest units (string) */
  feeUsdt: zAmount,
});
export const zAdminMetricsResponse = z.object({
  days: z.number().int(),
  points: z.array(zAdminMetricsPoint),
  totals: z.object({
    signups: z.number().int(),
    trades: z.number().int(),
    volumeUsdt: zAmount,
    feeUsdt: zAmount,
  }),
});
export type AdminMetricsResponse = z.infer<typeof zAdminMetricsResponse>;

export const zAuditVerifyResponse = z.object({ broken: z.array(z.string()) });

export const zModerationResult = z.object({ ok: z.literal(true), status: z.string() });

// ---- user detail (admin: click a user row → everything about them) ----
export const zAdminUserBalance = z.object({
  asset: z.string(),
  kind: z.string(),
  balance: zAmount,
});
export const zAdminUserTradeRow = z.object({
  id: zUuid,
  shortRef: z.string(),
  /** from THIS user's perspective */
  side: z.enum(OFFER_SIDES),
  counterpartyEmail: z.string(),
  amount: zAmount,
  fiatAmountXaf: zAmount,
  status: z.enum(TRADE_STATUSES),
  createdAt: z.string(),
});
export const zAdminUserWithdrawalRow = z.object({
  id: zUuid,
  asset: z.string(),
  amount: zAmount,
  fee: zAmount,
  status: z.enum(WITHDRAWAL_STATUSES),
  toAddress: z.string(),
  createdAt: z.string(),
});
export const zAdminUserDepositRow = z.object({
  id: zUuid,
  asset: z.string(),
  amount: zAmount,
  status: z.string(),
  txHash: z.string(),
  createdAt: z.string(),
});
export const zAdminUserKycRow = z.object({
  id: zUuid,
  tier: z.number().int(),
  docType: z.string(),
  status: z.enum(KYC_STATUSES),
  reviewedAt: z.string().nullable(),
  createdAt: z.string(),
});
export const zAdminUserSessionRow = z.object({
  id: zUuid,
  ip: z.string().nullable(),
  userAgent: z.string().nullable(),
  deviceFingerprint: z.string().nullable(),
  revoked: z.boolean(),
  createdAt: z.string(),
  expiresAt: z.string(),
});
export const zAdminUserRiskRow = z.object({
  id: zUuid,
  kind: z.string(),
  score: z.number().int(),
  actionTaken: z.string().nullable(),
  flags: z.record(z.unknown()).nullable(),
  createdAt: z.string(),
});
export const zAdminUserDetail = z.object({
  user: z.object({
    id: zUuid,
    email: z.string(),
    phone: z.string().nullable(),
    firstName: z.string().nullable(),
    lastName: z.string().nullable(),
    displayName: z.string().nullable(),
    bio: z.string().nullable(),
    country: z.string(),
    kycTier: z.number().int(),
    kycStatus: z.enum(KYC_STATUSES),
    status: z.enum(USER_STATUSES),
    reputationScore: z.number().int(),
    totpEnabled: z.boolean(),
    emailVerified: z.boolean(),
    phoneVerified: z.boolean(),
    createdAt: z.string(),
  }),
  balances: z.array(zAdminUserBalance),
  stats: z.object({
    tradesTotal: z.number().int(),
    tradesCompleted: z.number().int(),
    tradesCancelled: z.number().int(),
    tradesDisputed: z.number().int(),
    volumeCompletedXaf: zAmount,
    offersActive: z.number().int(),
    offersTotal: z.number().int(),
    withdrawalsTotal: z.number().int(),
    depositsTotal: z.number().int(),
    openDisputes: z.number().int(),
  }),
  recentTrades: z.array(zAdminUserTradeRow),
  recentWithdrawals: z.array(zAdminUserWithdrawalRow),
  recentDeposits: z.array(zAdminUserDepositRow),
  kyc: z.array(zAdminUserKycRow),
  sessions: z.array(zAdminUserSessionRow),
  riskEvents: z.array(zAdminUserRiskRow),
});
export type AdminUserDetail = z.infer<typeof zAdminUserDetail>;
