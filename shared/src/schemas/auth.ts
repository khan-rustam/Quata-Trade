import { z } from "zod";
import { zEmail, zOk, zOtpCode, zPassword, zPhone, zPin, zTotpCode } from "./common.js";

export const zRegisterRequest = z
  .object({
    email: zEmail,
    phone: zPhone.optional(),
    password: zPassword,
    firstName: z.string().trim().min(1).max(80).optional(),
    lastName: z.string().trim().min(1).max(80).optional(),
    country: z.string().length(2).toUpperCase().default("CM"),
    acceptTerms: z.literal(true),
  })
  .strict();
export type RegisterRequest = z.infer<typeof zRegisterRequest>;

export const zRegisterResponse = z.object({
  userId: z.string().uuid(),
  emailVerificationRequired: z.literal(true),
});
export type RegisterResponse = z.infer<typeof zRegisterResponse>;

export const zVerifyEmailRequest = z.object({ email: zEmail, code: zOtpCode }).strict();
export const zVerifyPhoneRequest = z.object({ phone: zPhone, code: zOtpCode }).strict();

export const zLoginRequest = z
  .object({
    email: zEmail,
    password: z.string().min(1).max(128),
    totpCode: zTotpCode.optional(),
    deviceFingerprint: z.string().max(256).optional(),
  })
  .strict();
export type LoginRequest = z.infer<typeof zLoginRequest>;

/** Refresh token travels in an httpOnly cookie; body carries only the access token. */
export const zAuthTokensResponse = z.object({
  accessToken: z.string(),
  accessTokenExpiresIn: z.number().int(),
  totpRequired: z.boolean().default(false),
});
export type AuthTokensResponse = z.infer<typeof zAuthTokensResponse>;

export const zForgotPasswordRequest = z.object({ email: zEmail }).strict();
export const zResetPasswordRequest = z
  .object({ token: z.string().min(32).max(256), password: zPassword })
  .strict();

export const zTotpSetupResponse = z.object({
  otpauthUrl: z.string(),
  qrDataUrl: z.string(),
});
export const zTotpEnableRequest = z.object({ code: zTotpCode }).strict();
export const zTotpVerifyRequest = z.object({ code: zTotpCode }).strict();
export const zTotpDisableRequest = z.object({ code: zTotpCode }).strict();
export type TotpDisableRequest = z.infer<typeof zTotpDisableRequest>;

export const zSetPinRequest = z
  .object({ pin: zPin, currentPassword: z.string().min(1).max(128) })
  .strict();

export const zChangePasswordRequest = z
  .object({ currentPassword: z.string().min(1).max(128), newPassword: zPassword })
  .strict();

export const zLogoutResponse = zOk;
