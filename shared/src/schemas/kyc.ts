import { z } from "zod";
import { KYC_STATUSES } from "../constants.js";
import { zTotpCode, zUuid } from "./common.js";

export const KYC_DOC_TYPES = ["national_id", "passport", "drivers_license"] as const;

export const zKycSubmitRequest = z
  .object({
    tier: z.number().int().min(1).max(3),
    docType: z.enum(KYC_DOC_TYPES),
    /** MinIO object keys returned by the KYC upload endpoint (front, back, selfie...) */
    files: z.array(z.string().max(512)).min(1).max(6),
    consent: z.literal(true), // explicit consent — Cameroon Law 2024/017
  })
  .strict();
export type KycSubmitRequest = z.infer<typeof zKycSubmitRequest>;

/**
 * What `POST /api/v1/kyc/submit` actually returns.
 *
 * The client previously parsed this reply with `zOk` (`{ ok: true }`), which
 * the endpoint has never sent — it returns the created submission. The
 * submission therefore succeeded, the "documents received" email went out,
 * and the client then threw while validating the response, showing the user
 * a raw Zod issue array over a request that had in fact worked.
 *
 * Declaring the real shape here — rather than making the endpoint return
 * `{ ok: true }` — keeps the submission id and status, which the UI needs to
 * show the pending state without a second round trip to `/kyc/status`.
 */
export const zKycSubmitResponse = z.object({
  id: zUuid,
  tier: z.number().int(),
  status: z.enum(KYC_STATUSES),
});
export type KycSubmitResponse = z.infer<typeof zKycSubmitResponse>;

export const zKycStatusResponse = z.object({
  tier: z.number().int(),
  status: z.enum(KYC_STATUSES),
  pendingSubmission: z
    .object({
      id: zUuid,
      tier: z.number().int(),
      submittedAt: z.string(),
    })
    .nullable(),
  reviewNotes: z.string().nullable(),
});
export type KycStatusResponse = z.infer<typeof zKycStatusResponse>;

export const zKycReviewRequest = z
  .object({
    notes: z.string().trim().max(4000).optional(),
    // Step-up: an approval grants a KYC tier (and with it higher limits), so it
    // is re-authenticated like a withdrawal approval, not treated as a read.
    totpCode: zTotpCode.optional(),
  })
  .strict();
export type KycReviewRequest = z.infer<typeof zKycReviewRequest>;

export const KYC_UPLOAD_MIMES = ["image/jpeg", "image/png", "image/webp", "application/pdf"] as const;

export const zKycUploadRequest = z
  .object({
    fileBase64: z.string().min(1),
    mime: z.enum(KYC_UPLOAD_MIMES),
  })
  .strict();
export type KycUploadRequest = z.infer<typeof zKycUploadRequest>;

export const zKycUploadResponse = z.object({ key: z.string() });
export type KycUploadResponse = z.infer<typeof zKycUploadResponse>;
