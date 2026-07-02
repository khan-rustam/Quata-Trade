import { z } from "zod";
import { AMOUNT_REGEX } from "../money.js";

/** UUID (any version; app generates UUIDv7). */
export const zUuid = z.string().uuid();

/** BIGINT smallest-units amount as a wire string, e.g. "1500000". */
export const zAmount = z
  .string()
  .regex(AMOUNT_REGEX, "Amount must be a non-negative integer string (smallest units)");

/** Positive (non-zero) amount string. */
export const zPositiveAmount = zAmount.refine((v) => v !== "0", "Amount must be greater than zero");

export const zEmail = z.string().trim().toLowerCase().email().max(320);

/** Cameroon-first E.164 phone. */
export const zPhone = z
  .string()
  .trim()
  .regex(/^\+[1-9]\d{6,14}$/, "Phone must be E.164, e.g. +2376XXXXXXXX");

export const zPassword = z
  .string()
  .min(10, "Password must be at least 10 characters")
  .max(128)
  .regex(/[a-z]/, "Must contain a lowercase letter")
  .regex(/[A-Z]/, "Must contain an uppercase letter")
  .regex(/\d/, "Must contain a digit");

export const zPin = z.string().regex(/^\d{6}$/, "PIN must be exactly 6 digits");

export const zTotpCode = z.string().regex(/^\d{6}$/, "2FA code must be 6 digits");

export const zOtpCode = z.string().regex(/^\d{6}$/, "Code must be 6 digits");

/** TRON base58check address: starts with T, 34 chars, base58 alphabet. */
export const zTronAddress = z
  .string()
  .regex(/^T[1-9A-HJ-NP-Za-km-z]{33}$/, "Invalid TRON address");

/** Client-supplied idempotency key for money-moving requests. */
export const zIdempotencyKey = z.string().min(16).max(128);

export const zPagination = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});
export type Pagination = z.infer<typeof zPagination>;

export const zPaginated = <T extends z.ZodTypeAny>(item: T) =>
  z.object({
    items: z.array(item),
    page: z.number().int(),
    pageSize: z.number().int(),
    total: z.number().int(),
  });

export const zOk = z.object({ ok: z.literal(true) });
export type Ok = z.infer<typeof zOk>;

/** Standard API error envelope (Nest exception filter emits this shape). */
export const zApiError = z.object({
  statusCode: z.number().int(),
  error: z.string(),
  message: z.union([z.string(), z.array(z.string())]),
  requestId: z.string().optional(),
});
export type ApiError = z.infer<typeof zApiError>;
