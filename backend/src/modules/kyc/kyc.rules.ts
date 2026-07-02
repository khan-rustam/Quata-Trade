import type { KycUploadMime } from "./kyc.schemas";
import {
  FileOwnershipError,
  FileValidationError,
  PendingSubmissionExistsError,
  TierProgressionError,
} from "./kyc.errors";

/**
 * Pure, deterministic KYC rules (no I/O) — unit-tested in kyc.spec.ts.
 * Documents/08 §F: magic-byte check, SVG banned, size limits.
 * Documents/06 kyc: manual decision only; tier progression is strictly +1.
 */

/** Hard ceiling on the DECODED upload (5 MiB). */
export const MAX_DECODED_BYTES = 5 * 1024 * 1024;

const EXTENSIONS: Record<KycUploadMime, string> = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
  "application/pdf": ".pdf",
};

export function extensionFor(mime: KycUploadMime): string {
  return EXTENSIONS[mime];
}

/**
 * Sniff the real content type from magic bytes. Returns the detected allowed
 * mime or null for everything else (SVG, HTML, scripts, truncated files...).
 *   JPEG  FF D8 FF · PNG  89 50 4E 47 · WebP  "RIFF"...."WEBP" · PDF  "%PDF"
 */
export function sniffMime(buf: Buffer): KycUploadMime | null {
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "image/jpeg";
  if (buf.length >= 4 && buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return "image/png";
  if (buf.length >= 12 && buf.toString("latin1", 0, 4) === "RIFF" && buf.toString("latin1", 8, 12) === "WEBP") {
    return "image/webp";
  }
  if (buf.length >= 4 && buf.toString("latin1", 0, 4) === "%PDF") return "application/pdf";
  return null;
}

/** Content must match the DECLARED mime exactly — a JPEG declared as PNG is rejected. */
export function assertMagicBytes(buf: Buffer, declared: KycUploadMime): void {
  if (sniffMime(buf) !== declared) {
    throw new FileValidationError("file content does not match the declared type");
  }
}

export function assertDecodedSize(buf: Buffer): void {
  if (buf.length === 0) throw new FileValidationError("file is empty");
  if (buf.length > MAX_DECODED_BYTES) throw new FileValidationError("file exceeds the 5 MiB limit");
}

/**
 * Tier progression: exactly currentTier + 1, one submission in flight at a time.
 * (Skipping tiers, resubmitting the same tier while PENDING, or downgrading all fail.)
 */
export function assertTierProgression(input: {
  currentTier: number;
  requestedTier: number;
  hasPendingSubmission: boolean;
}): void {
  if (input.hasPendingSubmission) throw new PendingSubmissionExistsError();
  if (input.requestedTier !== input.currentTier + 1) {
    throw new TierProgressionError(input.currentTier, input.requestedTier);
  }
}

/**
 * Every submitted object key must live under the caller's own `userId/` prefix —
 * referencing another user's uploads (or traversal tricks) fails generically.
 */
export function assertFileKeysOwned(userId: string, keys: string[]): void {
  const prefix = `${userId}/`;
  for (const key of keys) {
    if (!key.startsWith(prefix) || key.length <= prefix.length || key.includes("..") || key.includes("//")) {
      throw new FileOwnershipError();
    }
  }
}
