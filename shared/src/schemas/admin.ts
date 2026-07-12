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
import { zAmount, zEmail, zIdempotencyKey, zPassword, zPaginated, zTotpCode, zUuid } from "./common.js";

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
  depositPolicy: z.object({
    minAmount: zAmount,
    maxAmount: zAmount.nullable(),
    feeFixed: zAmount,
    feeBps: z.number().int(),
    confirmations: z.number().int(),
  }),
  feeBps: z.record(z.string(), z.number().int()),
  /** Global SELLER trading fee bps (Phase 2). 0 = disabled. */
  sellerFeeBps: z.number().int(),
  withdrawalCaps: z.object({
    perTxMax: zAmount,
    dailyMax: zAmount,
    dualApprovalThreshold: zAmount,
    autoApproveBelow: zAmount,
  }),
  /** Hot-wallet operating thresholds (Documents/10 D30-limits). 0 = disabled. */
  hotWallet: z.object({
    maxBalance: zAmount,
    minBalance: zAmount,
    reserve: zAmount,
    dailyOpLimit: zAmount,
    alertThreshold: zAmount,
  }),
  /** Launch-protection ceilings (Documents/10 D30-limits). 0 = disabled. */
  launchLimits: z.object({
    maxUserBalance: zAmount,
    maxDailyDepositPerUser: zAmount,
    maxPlatformCustody: zAmount,
    maxDailyWithdrawalVolume: zAmount,
    maxPendingWithdrawalQueue: z.number().int(),
    maxWithdrawalsPerDay: z.number().int(),
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
 * hot_wallet write value (Documents/10 D30-limits). Smallest-unit strings; 0 =
 * that threshold is disabled. Monitoring/liquidity knobs — the reconciliation
 * reserve check reads `reserve`/`alert_threshold`.
 */
export const zHotWalletValue = z
  .object({
    max_balance: zCapAmount,
    min_balance: zCapAmount,
    reserve: zCapAmount,
    daily_op_limit: zCapAmount,
    alert_threshold: zCapAmount,
  })
  .strict();
export type HotWalletValue = z.infer<typeof zHotWalletValue>;

/**
 * launch_limits write value (Documents/10 D30-limits). Custody/velocity ceilings
 * (0 = disabled). Amount fields are smallest-unit strings; queue/count fields are
 * integers. Reject-enforcement of the money-path ceilings is wired incrementally.
 */
export const zLaunchLimitsValue = z
  .object({
    max_user_balance: zCapAmount,
    max_daily_deposit_per_user: zCapAmount,
    max_platform_custody: zCapAmount,
    max_daily_withdrawal_volume: zCapAmount,
    max_pending_withdrawal_queue: z.number().int().min(0),
    max_withdrawals_per_day: z.number().int().min(0),
  })
  .strict();
export type LaunchLimitsValue = z.infer<typeof zLaunchLimitsValue>;

/**
 * deposit_policy write value. Smallest-unit strings + a percentage. The platform
 * deposit fee = fee_fixed + floor(gross * fee_bps / 10000); the min applies to the
 * GROSS received amount. The refine guarantees the fee on the SMALLEST allowed deposit
 * still leaves a positive net (so the credit never posts a zero/negative user leg).
 * The FE editor imports this so both sides validate identically.
 */
export const zDepositPolicyValue = z
  .object({
    min_amount: zCapAmount,
    // Null/absent = no maximum. When set it must be >= min and within int8.
    max_amount: zCapAmount.nullable().optional(),
    fee_fixed: zCapAmount,
    fee_bps: z.number().int().min(0).max(MAX_FEE_BPS),
    confirmations: z.number().int().min(1).max(200),
  })
  .strict()
  .superRefine((v, ctx) => {
    const min = BigInt(v.min_amount);
    const fixed = BigInt(v.fee_fixed);
    if (min <= 0n) ctx.addIssue({ code: z.ZodIssueCode.custom, message: "min_amount must be greater than zero", path: ["min_amount"] });
    if (v.max_amount != null) {
      const max = BigInt(v.max_amount);
      if (max > MAX_INT8) ctx.addIssue({ code: z.ZodIssueCode.custom, message: "max_amount exceeds the maximum supported amount", path: ["max_amount"] });
      if (max < min) ctx.addIssue({ code: z.ZodIssueCode.custom, message: "max_amount must be >= min_amount", path: ["max_amount"] });
    }
    const feeAtMin = fixed + (min * BigInt(v.fee_bps)) / 10_000n;
    if (feeAtMin >= min) ctx.addIssue({ code: z.ZodIssueCode.custom, message: "deposit fee must be less than the minimum deposit", path: ["fee_fixed"] });
  });
export type DepositPolicyValue = z.infer<typeof zDepositPolicyValue>;

/**
 * withdrawal_fee write value — per-asset platform fee that can be fixed, percentage,
 * or combined: fee = fixed + floor(amount * bps / 10000). Accepts the legacy
 * fixed-only string form ("1000000") for back-compat so an un-migrated row still
 * validates (normalised to { fixed, bps: 0 } on read).
 */
const zWithdrawalFeeEntry = z.union([
  zCapAmount, // legacy fixed-only
  z.object({ fixed: zCapAmount, bps: z.number().int().min(0).max(MAX_FEE_BPS) }).strict(),
]);
export const zWithdrawalFeeValue = z
  .record(z.enum(ASSET_CODES), zWithdrawalFeeEntry)
  .refine((v) => v.USDT_TRC20 !== undefined, "withdrawal_fee must include USDT_TRC20");
export type WithdrawalFeeValue = z.infer<typeof zWithdrawalFeeValue>;

/**
 * withdrawal_network_fee write value — a per-asset ESTIMATE of the on-chain (TRON)
 * network cost, shown to the user before confirming. Informational/display; the
 * platform absorbs the actual on-chain cost unless the platform fee is set to cover it.
 */
export const zWithdrawalNetworkFeeValue = z
  .record(z.enum(ASSET_CODES), zCapAmount)
  .refine((v) => v.USDT_TRC20 !== undefined, "withdrawal_network_fee must include USDT_TRC20");
export type WithdrawalNetworkFeeValue = z.infer<typeof zWithdrawalNetworkFeeValue>;

/**
 * Promotional fee campaign — time-limited, optionally country-specific, per fee type.
 * While active it OVERRIDES the fee: for trading, discountBps replaces the rail fee
 * (0 = free); for deposit/withdrawal an active campaign WAIVES the platform fee.
 * country = null → all markets. Stored as the promo_campaigns settings array.
 */
export const zPromoCampaign = z
  .object({
    id: z.string().trim().min(1).max(64),
    feeType: z.enum(["trading", "deposit", "withdrawal"]),
    country: z.string().length(2).nullable(), // ISO-3166 alpha-2, or null = all markets
    startsAt: z.string().datetime(),
    endsAt: z.string().datetime(),
    discountBps: z.number().int().min(0).max(MAX_FEE_BPS), // effective trading bps; waiver for deposit/withdrawal
    note: z.string().max(200).optional(),
  })
  .strict()
  .refine((c) => new Date(c.startsAt).getTime() < new Date(c.endsAt).getTime(), {
    message: "startsAt must be before endsAt",
    path: ["endsAt"],
  });
export type PromoCampaign = z.infer<typeof zPromoCampaign>;

export const zPromoCampaignsValue = z.array(zPromoCampaign).max(100);
export type PromoCampaignsValue = z.infer<typeof zPromoCampaignsValue>;

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
    // Mandatory change reason — every fee/settings modification is audit-logged with it
    // (fee-engine spec: audit & compliance).
    reason: z.string().trim().min(3).max(1000),
    totpCode: zTotpCode.optional(),
  })
  .strict();
export type UpdateSettingRequest = z.infer<typeof zUpdateSettingRequest>;

// ---- wallet configuration (key ceremony — PUBLIC xpub only, Documents/10 D29) ----
/**
 * One configured production/dev wallet. `xpub` is an account-level extended
 * PUBLIC key — the backend never holds/returns any private key material.
 * `sampleAddress` is the deposit address at index 0, for the admin to eyeball
 * against the hardware wallet during the key ceremony.
 */
export const zWalletConfigSummary = z.object({
  id: zUuid,
  network: z.string(),
  xpub: z.string(),
  derivationPath: z.string(),
  label: z.string().nullable(),
  source: z.enum(["env", "ceremony"]),
  sampleAddress: z.string(),
  active: z.boolean(),
  activatedBy: zUuid.nullable(),
  createdAt: z.string(),
});
export type WalletConfigSummary = z.infer<typeof zWalletConfigSummary>;

export const zAdminWalletConfigResponse = z.object({
  network: z.string(),
  /** null while still on the env fallback (no DB config activated yet). */
  activeXpub: z.string().nullable(),
  usingEnvFallback: z.boolean(),
  configs: z.array(zWalletConfigSummary),
});
export type AdminWalletConfigResponse = z.infer<typeof zAdminWalletConfigResponse>;

/** Cold Wallet Provider status (Documents/10 D30-cold) — disabled at launch. */
export const zColdWalletStatus = z.object({
  provider: z.enum(["disabled", "trezor_safe_3", "future_hardware", "institutional_custody"]),
  enabled: z.boolean(),
  canReceive: z.boolean(),
  label: z.string(),
  note: z.string(),
});
export type ColdWalletStatusResponse = z.infer<typeof zColdWalletStatus>;

export const zActivateWalletConfigRequest = z
  .object({
    network: z.enum(["tron"]).default("tron"),
    /**
     * Account-level extended PUBLIC key (xpub, m/44'/195'/0'). The backend
     * REJECTS any extended private key (xprv) — validated via watch-only
     * derivation. Never submit a seed, mnemonic, or private key here.
     */
    xpub: z.string().trim().min(20).max(256),
    label: z.string().trim().max(120).optional(),
    /**
     * Required to rotate the key once deposit addresses already exist — guards
     * against silently orphaning custody of already-derived addresses.
     */
    acknowledgeReset: z.boolean().optional(),
    reason: z.string().trim().min(3).max(1000),
    totpCode: zTotpCode.optional(),
  })
  .strict();
export type ActivateWalletConfigRequest = z.infer<typeof zActivateWalletConfigRequest>;

// ---- team / admin-account management (SUPER only, Documents/06 RBAC) ----
export const zAdminAccount = z.object({
  id: zUuid,
  email: z.string(),
  role: z.enum(ADMIN_ROLES),
  active: z.boolean(),
  totpEnabled: z.boolean(),
  createdAt: z.string(),
});
export type AdminAccount = z.infer<typeof zAdminAccount>;

export const zAdminAccountsResponse = z.object({ admins: z.array(zAdminAccount) });
export type AdminAccountsResponse = z.infer<typeof zAdminAccountsResponse>;

export const zCreateAdminRequest = z
  .object({
    email: zEmail,
    role: z.enum(ADMIN_ROLES),
    // Initial password; the new admin enables their own 2FA on first login.
    password: zPassword,
    totpCode: zTotpCode.optional(),
  })
  .strict();
export type CreateAdminRequest = z.infer<typeof zCreateAdminRequest>;

export const zUpdateAdminRequest = z
  .object({
    role: z.enum(ADMIN_ROLES).optional(),
    active: z.boolean().optional(),
    totpCode: zTotpCode.optional(),
  })
  .strict()
  .refine((d) => d.role !== undefined || d.active !== undefined, { message: "nothing to update" });
export type UpdateAdminRequest = z.infer<typeof zUpdateAdminRequest>;

export const zResetAdminTotpRequest = z.object({ totpCode: zTotpCode.optional() }).strict();
export type ResetAdminTotpRequest = z.infer<typeof zResetAdminTotpRequest>;

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
