import { z } from "zod";

/**
 * LOCAL schema for the KYC upload endpoint only. The submit/status contract
 * lives in @quatatrade/shared (zKycSubmitRequest / zKycStatusResponse) — this
 * one is backend-internal because the frontend uploads through the typed
 * client with the same shape but the shared package is frozen for this task.
 */

export const KYC_UPLOAD_MIMES = ["image/jpeg", "image/png", "image/webp", "application/pdf"] as const;
export type KycUploadMime = (typeof KYC_UPLOAD_MIMES)[number];

/** 5 MiB decoded ceiling → base64 inflates 4/3 (~6.67 MiB) — 7 MiB wire cap. */
export const MAX_BASE64_LENGTH = 7 * 1024 * 1024;

export const zKycUploadRequest = z
  .object({
    /** Plain base64 (no `data:` prefix, no whitespace). Decoded server-side and re-validated. */
    fileBase64: z
      .string()
      .min(1)
      .max(MAX_BASE64_LENGTH)
      .regex(/^[A-Za-z0-9+/]+={0,2}$/, "fileBase64 must be plain base64 without a data: prefix"),
    mime: z.enum(KYC_UPLOAD_MIMES),
  })
  .strict();
export type KycUploadRequest = z.infer<typeof zKycUploadRequest>;

export const zKycUploadResponse = z.object({ key: z.string() });
export type KycUploadResponse = z.infer<typeof zKycUploadResponse>;
