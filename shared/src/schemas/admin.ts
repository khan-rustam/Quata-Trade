import { z } from "zod";
import { ADMIN_ROLES, KYC_STATUSES, TRADE_STATUSES, USER_STATUSES, WITHDRAWAL_STATUSES } from "../constants.js";
import { zAmount, zEmail, zPaginated, zTotpCode, zUuid } from "./common.js";

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

export const zAuditVerifyResponse = z.object({ broken: z.array(z.string()) });

export const zModerationResult = z.object({ ok: z.literal(true), status: z.string() });
