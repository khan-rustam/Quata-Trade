import { z } from "zod";
import { KYC_STATUSES, USER_STATUSES } from "../constants.js";
import { zUuid } from "./common.js";

export const zUserProfile = z.object({
  id: zUuid,
  email: z.string(),
  phone: z.string().nullable(),
  firstName: z.string().nullable(),
  lastName: z.string().nullable(),
  country: z.string(),
  emailVerified: z.boolean(),
  phoneVerified: z.boolean(),
  kycTier: z.number().int().min(0).max(3),
  kycStatus: z.enum(KYC_STATUSES),
  totpEnabled: z.boolean(),
  pinSet: z.boolean(),
  status: z.enum(USER_STATUSES),
  reputationScore: z.number().int(),
  createdAt: z.string(),
});
export type UserProfile = z.infer<typeof zUserProfile>;

export const zUpdateProfileRequest = z
  .object({
    firstName: z.string().trim().min(1).max(80).optional(),
    lastName: z.string().trim().min(1).max(80).optional(),
  })
  .strict();
export type UpdateProfileRequest = z.infer<typeof zUpdateProfileRequest>;

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
