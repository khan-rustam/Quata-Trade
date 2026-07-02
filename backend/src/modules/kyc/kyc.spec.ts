import { describe, expect, it } from "vitest";
import {
  MAX_DECODED_BYTES,
  assertDecodedSize,
  assertFileKeysOwned,
  assertMagicBytes,
  assertTierProgression,
  extensionFor,
  sniffMime,
} from "./kyc.rules";
import {
  FileOwnershipError,
  FileValidationError,
  PendingSubmissionExistsError,
  TierProgressionError,
} from "./kyc.errors";
import { MAX_BASE64_LENGTH, zKycUploadRequest } from "./kyc.schemas";

/** Build a buffer starting with the given bytes, padded to `size`. */
const buf = (bytes: number[], size = bytes.length): Buffer => {
  const b = Buffer.alloc(size);
  Buffer.from(bytes).copy(b);
  return b;
};

const JPEG = buf([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46], 64);
const PNG = buf([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], 64);
const WEBP = Buffer.concat([Buffer.from("RIFF"), Buffer.from([0x24, 0x00, 0x00, 0x00]), Buffer.from("WEBPVP8 "), Buffer.alloc(32)]);
const PDF = Buffer.concat([Buffer.from("%PDF-1.7\n"), Buffer.alloc(32)]);
const SVG = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>`);

describe("kyc magic-byte validation (Documents/08 §F)", () => {
  it("sniffs each allowed type from its magic bytes", () => {
    expect(sniffMime(JPEG)).toBe("image/jpeg");
    expect(sniffMime(PNG)).toBe("image/png");
    expect(sniffMime(WEBP)).toBe("image/webp");
    expect(sniffMime(PDF)).toBe("application/pdf");
  });

  it("rejects SVG and other content as unknown (no allowed type)", () => {
    expect(sniffMime(SVG)).toBeNull();
    expect(sniffMime(Buffer.from("<!DOCTYPE html><html></html>"))).toBeNull();
    expect(sniffMime(Buffer.from("#!/bin/sh\nrm -rf /"))).toBeNull();
    expect(sniffMime(Buffer.alloc(0))).toBeNull();
  });

  it("rejects truncated signatures", () => {
    expect(sniffMime(Buffer.from([0xff, 0xd8]))).toBeNull(); // JPEG needs 3 bytes
    expect(sniffMime(Buffer.from([0x89, 0x50, 0x4e]))).toBeNull(); // PNG needs 4
    expect(sniffMime(Buffer.from("%PD"))).toBeNull();
    // RIFF container that is too short to carry the WEBP tag
    expect(sniffMime(Buffer.from("RIFFxxxx"))).toBeNull();
  });

  it("RIFF containers that are not WebP (e.g. WAVE) are rejected", () => {
    const wav = Buffer.concat([Buffer.from("RIFF"), Buffer.alloc(4), Buffer.from("WAVE"), Buffer.alloc(16)]);
    expect(sniffMime(wav)).toBeNull();
  });

  it("assertMagicBytes passes only when content matches the DECLARED mime", () => {
    expect(() => assertMagicBytes(JPEG, "image/jpeg")).not.toThrow();
    expect(() => assertMagicBytes(PNG, "image/png")).not.toThrow();
    expect(() => assertMagicBytes(WEBP, "image/webp")).not.toThrow();
    expect(() => assertMagicBytes(PDF, "application/pdf")).not.toThrow();
    // real JPEG declared as PNG → mismatch
    expect(() => assertMagicBytes(JPEG, "image/png")).toThrow(FileValidationError);
    expect(() => assertMagicBytes(PDF, "image/jpeg")).toThrow(FileValidationError);
    // SVG declared as anything → rejected
    expect(() => assertMagicBytes(SVG, "image/png")).toThrow(FileValidationError);
    expect(() => assertMagicBytes(SVG, "application/pdf")).toThrow(FileValidationError);
  });

  it("enforces the 5 MiB decoded ceiling and rejects empty files", () => {
    expect(() => assertDecodedSize(JPEG)).not.toThrow();
    expect(() => assertDecodedSize(Buffer.alloc(MAX_DECODED_BYTES))).not.toThrow(); // exactly at the limit
    expect(() => assertDecodedSize(Buffer.alloc(MAX_DECODED_BYTES + 1))).toThrow(FileValidationError);
    expect(() => assertDecodedSize(Buffer.alloc(0))).toThrow(FileValidationError);
  });

  it("maps mimes to safe extensions", () => {
    expect(extensionFor("image/jpeg")).toBe(".jpg");
    expect(extensionFor("image/png")).toBe(".png");
    expect(extensionFor("image/webp")).toBe(".webp");
    expect(extensionFor("application/pdf")).toBe(".pdf");
  });
});

describe("kyc upload request schema (local)", () => {
  const b64 = Buffer.from("hello").toString("base64");

  it("accepts plain base64 with an allowed mime", () => {
    expect(zKycUploadRequest.safeParse({ fileBase64: b64, mime: "image/jpeg" }).success).toBe(true);
  });

  it("rejects SVG mime, data: URIs, unknown fields and oversized payloads", () => {
    expect(zKycUploadRequest.safeParse({ fileBase64: b64, mime: "image/svg+xml" }).success).toBe(false);
    expect(zKycUploadRequest.safeParse({ fileBase64: `data:image/png;base64,${b64}`, mime: "image/png" }).success).toBe(false);
    expect(zKycUploadRequest.safeParse({ fileBase64: b64, mime: "image/png", extra: 1 }).success).toBe(false);
    expect(zKycUploadRequest.safeParse({ fileBase64: "A".repeat(MAX_BASE64_LENGTH + 4), mime: "image/png" }).success).toBe(false);
  });
});

describe("kyc tier progression (Documents/06 kyc — manual only, strictly +1)", () => {
  const ok = (currentTier: number, requestedTier: number) =>
    assertTierProgression({ currentTier, requestedTier, hasPendingSubmission: false });

  it("allows exactly current tier + 1", () => {
    expect(() => ok(0, 1)).not.toThrow();
    expect(() => ok(1, 2)).not.toThrow();
    expect(() => ok(2, 3)).not.toThrow();
  });

  it("rejects skipping tiers", () => {
    expect(() => ok(0, 2)).toThrow(TierProgressionError);
    expect(() => ok(0, 3)).toThrow(TierProgressionError);
    expect(() => ok(1, 3)).toThrow(TierProgressionError);
  });

  it("rejects re-requesting the current tier or downgrading", () => {
    expect(() => ok(1, 1)).toThrow(TierProgressionError);
    expect(() => ok(2, 1)).toThrow(TierProgressionError);
    expect(() => ok(3, 3)).toThrow(TierProgressionError);
  });

  it("rejects any submission while one is already PENDING — even the correct next tier", () => {
    expect(() => assertTierProgression({ currentTier: 0, requestedTier: 1, hasPendingSubmission: true })).toThrow(
      PendingSubmissionExistsError,
    );
    expect(() => assertTierProgression({ currentTier: 2, requestedTier: 3, hasPendingSubmission: true })).toThrow(
      PendingSubmissionExistsError,
    );
  });
});

describe("kyc file-key ownership (IDOR guard, Documents/08 §E)", () => {
  const me = "0198c9a1-0000-7000-8000-000000000001";
  const other = "0198c9a1-0000-7000-8000-000000000002";

  it("accepts keys under the caller's own prefix", () => {
    expect(() => assertFileKeysOwned(me, [`${me}/doc-front.jpg`, `${me}/selfie.png`])).not.toThrow();
  });

  it("rejects another user's keys — generic error, no enumeration detail", () => {
    expect(() => assertFileKeysOwned(me, [`${other}/doc-front.jpg`])).toThrow(FileOwnershipError);
    try {
      assertFileKeysOwned(me, [`${other}/doc-front.jpg`]);
    } catch (err) {
      expect((err as Error).message).not.toContain(other); // never echo foreign identifiers
    }
  });

  it("rejects bare-prefix, traversal and double-slash keys", () => {
    expect(() => assertFileKeysOwned(me, [`${me}/`])).toThrow(FileOwnershipError);
    expect(() => assertFileKeysOwned(me, [`${me}/../${other}/doc.jpg`])).toThrow(FileOwnershipError);
    expect(() => assertFileKeysOwned(me, [`${me}//doc.jpg`])).toThrow(FileOwnershipError);
    expect(() => assertFileKeysOwned(me, ["doc.jpg"])).toThrow(FileOwnershipError);
  });

  it("rejects a mixed batch when any single key is foreign", () => {
    expect(() => assertFileKeysOwned(me, [`${me}/ok.jpg`, `${other}/steal.jpg`])).toThrow(FileOwnershipError);
  });
});
