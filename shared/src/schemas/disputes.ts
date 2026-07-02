import { z } from "zod";
import { DISPUTE_RESOLUTIONS, DISPUTE_STATUSES } from "../constants.js";
import { zTotpCode, zUuid } from "./common.js";

export const zOpenDisputeRequest = z
  .object({
    reason: z.string().trim().min(10).max(2000),
  })
  .strict();
export type OpenDisputeRequest = z.infer<typeof zOpenDisputeRequest>;

export const zSubmitEvidenceRequest = z
  .object({
    kind: z.enum(["payment_proof", "chat_screenshot", "bank_statement", "other"]),
    note: z.string().trim().max(2000).optional(),
    files: z.array(z.string().max(512)).max(10).default([]),
  })
  .strict();
export type SubmitEvidenceRequest = z.infer<typeof zSubmitEvidenceRequest>;

export const zDisputeEvidence = z.object({
  id: zUuid,
  submittedBy: zUuid,
  kind: z.string(),
  note: z.string().nullable(),
  files: z.array(z.string()),
  createdAt: z.string(),
});

export const zDispute = z.object({
  id: zUuid,
  tradeId: zUuid,
  openedBy: zUuid,
  reason: z.string(),
  status: z.enum(DISPUTE_STATUSES),
  resolution: z.enum(DISPUTE_RESOLUTIONS).nullable(),
  resolutionNotes: z.string().nullable(),
  resolvedAt: z.string().nullable(),
  createdAt: z.string(),
  evidence: z.array(zDisputeEvidence),
});
export type Dispute = z.infer<typeof zDispute>;

export const zResolveDisputeRequest = z
  .object({
    resolution: z.enum(DISPUTE_RESOLUTIONS),
    notes: z.string().trim().min(10).max(4000),
    // Admin step-up 2FA — required only if the resolving admin has 2FA enabled
    // (optional in the test phase; enforced again in production).
    totpCode: zTotpCode.optional(),
  })
  .strict();
export type ResolveDisputeRequest = z.infer<typeof zResolveDisputeRequest>;
