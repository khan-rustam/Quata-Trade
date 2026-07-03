import { z } from "zod";
import { AVATAR_STYLES, KYC_STATUSES, PAYMENT_METHODS, REPUTATION_TIERS, USER_STATUSES } from "../constants.js";
import { zEmail, zUuid } from "./common.js";

/** Off-platform receiving account for one payment method (where a buyer sends fiat). */
export const zPaymentAccount = z.object({
  number: z.string(),
  name: z.string(),
});
/** A user's receiving accounts, keyed by payment method (partial — only set methods). */
export const zPaymentAccounts = z.record(z.enum(PAYMENT_METHODS), zPaymentAccount);
export type PaymentAccounts = z.infer<typeof zPaymentAccounts>;

/** Upsert/clear receiving accounts. A null value clears that method's account. */
export const zUpdatePaymentAccountsRequest = z
  .object({
    accounts: z.record(
      z.enum(PAYMENT_METHODS),
      z
        .object({
          number: z.string().trim().min(4).max(30),
          name: z.string().trim().min(2).max(80),
        })
        .nullable(),
    ),
  })
  .strict();
export type UpdatePaymentAccountsRequest = z.infer<typeof zUpdatePaymentAccountsRequest>;

export const zUserProfile = z.object({
  id: zUuid,
  email: z.string(),
  phone: z.string().nullable(),
  firstName: z.string().nullable(),
  lastName: z.string().nullable(),
  displayName: z.string().nullable(), // opt-in public handle; null = use masked name
  bio: z.string().nullable(),
  avatarStyle: z.enum(AVATAR_STYLES).nullable(),
  avatarSeed: z.string().nullable(),
  country: z.string(),
  emailVerified: z.boolean(),
  phoneVerified: z.boolean(),
  pendingEmail: z.string().nullable(), // email awaiting verification, if a change is in flight
  kycTier: z.number().int().min(0).max(3),
  kycStatus: z.enum(KYC_STATUSES),
  totpEnabled: z.boolean(),
  pinSet: z.boolean(),
  status: z.enum(USER_STATUSES),
  reputationScore: z.number().int(),
  reputationTier: z.enum(REPUTATION_TIERS), // derived, display only
  completedTrades: z.number().int(),
  completionRate: z.number(), // 0..100, display only — not money
  paymentAccounts: zPaymentAccounts, // own off-platform receiving accounts
  createdAt: z.string(),
});
export type UserProfile = z.infer<typeof zUserProfile>;

export const zUpdateProfileRequest = z
  .object({
    firstName: z.string().trim().min(1).max(80).optional(),
    lastName: z.string().trim().min(1).max(80).optional(),
    displayName: z.string().trim().min(2).max(24).nullable().optional(), // null clears (revert to masked)
    bio: z.string().trim().max(280).nullable().optional(),
    avatarStyle: z.enum(AVATAR_STYLES).nullable().optional(),
    avatarSeed: z.string().trim().min(1).max(64).nullable().optional(),
  })
  .strict();
export type UpdateProfileRequest = z.infer<typeof zUpdateProfileRequest>;

/** Change of account email — requires password step-up; new address must be verified. */
export const zChangeEmailRequest = z
  .object({
    newEmail: zEmail,
    password: z.string().min(1).max(128),
  })
  .strict();
export type ChangeEmailRequest = z.infer<typeof zChangeEmailRequest>;

export const zVerifyEmailChangeRequest = z
  .object({
    code: z.string().trim().length(6),
  })
  .strict();
export type VerifyEmailChangeRequest = z.infer<typeof zVerifyEmailChangeRequest>;

export const zSession = z.object({
  id: zUuid,
  ip: z.string().nullable(),
  userAgent: z.string().nullable(),
  deviceFingerprint: z.string().nullable(),
  createdAt: z.string(),
  expiresAt: z.string(),
  current: z.boolean(),
});
export type Session = z.infer<typeof zSession>;

export const zSessionsResponse = z.object({ sessions: z.array(zSession) });
