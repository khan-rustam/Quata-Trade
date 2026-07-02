import { z } from "zod";
import { ADMIN_ROLES, KYC_STATUSES, TRADE_STATUSES, USER_STATUSES, WITHDRAWAL_STATUSES } from "../constants.js";
import { zAmount, zEmail, zPaginated, zTotpCode, zUuid } from "./common.js";

export const zAdminLoginRequest = z
  .object({
    email: zEmail,
    password: z.string().min(1).max(128),
    totpCode: zTotpCode, // 2FA is mandatory for admins — no optional path
  })
  .strict();
export type AdminLoginRequest = z.infer<typeof zAdminLoginRequest>;

export const zAdminProfile = z.object({
  id: zUuid,
  email: z.string(),
  role: z.enum(ADMIN_ROLES),
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
  .object({ totpCode: zTotpCode, notes: z.string().max(1000).optional() })
  .strict();
export const zRejectWithdrawalRequest = z
  .object({ totpCode: zTotpCode, reason: z.string().trim().min(5).max(1000) })
  .strict();

export const zKillSwitchState = z.object({
  withdrawalsPaused: z.boolean(),
  tradesPaused: z.boolean(),
});
export type KillSwitchState = z.infer<typeof zKillSwitchState>;

export const zKillSwitchRequest = z
  .object({
    target: z.enum(["withdrawals", "trades"]),
    paused: z.boolean(),
    totpCode: zTotpCode,
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
    totpCode: zTotpCode,
  })
  .strict();
