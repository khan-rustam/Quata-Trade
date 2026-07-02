import { decodeBase64Strict, sniffImageType } from "../chat/chat.validators";

/**
 * Evidence uploads follow the same base64 + magic-byte pattern as KYC:
 * images (jpeg/png/webp) plus PDF (bank statements/receipts), SVG impossible
 * by whitelist. Pure functions — reuses chat's tested decode/sniff helpers.
 */

export const EVIDENCE_MAX_BYTES = 5 * 1024 * 1024;

export interface EvidenceFile {
  buffer: Buffer;
  mime: string;
  ext: string;
}

export type EvidenceValidation = { ok: true; file: EvidenceFile } | { ok: false; reason: string };

export function isPdf(buf: Buffer): boolean {
  return buf.length >= 5 && buf.toString("latin1", 0, 5) === "%PDF-";
}

export function validateEvidenceFile(base64: string): EvidenceValidation {
  const buffer = decodeBase64Strict(base64);
  if (!buffer) return { ok: false, reason: "malformed base64 payload" };
  if (buffer.length === 0) return { ok: false, reason: "empty file" };
  if (buffer.length > EVIDENCE_MAX_BYTES) return { ok: false, reason: "file exceeds the 5MB limit" };

  const image = sniffImageType(buffer);
  if (image) return { ok: true, file: { buffer, mime: image.mime, ext: image.ext } };
  if (isPdf(buffer)) return { ok: true, file: { buffer, mime: "application/pdf", ext: ".pdf" } };
  return { ok: false, reason: "unsupported file type (jpeg, png, webp, pdf only)" };
}
