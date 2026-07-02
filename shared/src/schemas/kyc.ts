import { z } from "zod";
import { KYC_STATUSES } from "../constants.js";
import { zUuid } from "./common.js";

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
  })
  .strict();
