import { describe, expect, it } from "vitest";
import { randomBytes } from "node:crypto";
import { decryptSecret, encryptSecret } from "./crypto";

/**
 * At-rest field encryption (security remediation item 6b) — the canonical
 * AES-256-GCM helper used for DB secrets (TOTP seeds). Object storage (KYC
 * documents) uses MinIO SSE instead. Errors are deliberately generic (no oracle).
 */
describe("common/crypto — at-rest AES-256-GCM", () => {
  const key = randomBytes(32).toString("base64");

  it("round-trips a secret", () => {
    const blob = encryptSecret("JBSWY3DPEHPK3PXP", key);
    expect(blob).toBeInstanceOf(Buffer);
    expect(decryptSecret(blob, key)).toBe("JBSWY3DPEHPK3PXP");
  });

  it("produces different ciphertext each time (random IV)", () => {
    expect(encryptSecret("same", key).equals(encryptSecret("same", key))).toBe(false);
  });

  it("fails generically with the wrong key (GCM auth tag)", () => {
    const blob = encryptSecret("secret", key);
    expect(() => decryptSecret(blob, randomBytes(32).toString("base64"))).toThrow("decryption failed");
  });

  it("rejects a tampered ciphertext", () => {
    const blob = encryptSecret("secret", key);
    const last = blob.length - 1;
    blob[last] = (blob[last] ?? 0) ^ 0xff;
    expect(() => decryptSecret(blob, key)).toThrow("decryption failed");
  });

  it("rejects a too-short buffer", () => {
    expect(() => decryptSecret(Buffer.alloc(5), key)).toThrow("decryption failed");
  });

  it("rejects a master key that is not 32 bytes", () => {
    const shortKey = Buffer.alloc(16).toString("base64");
    expect(() => encryptSecret("x", shortKey)).toThrow("invalid master encryption key");
    expect(() => decryptSecret(encryptSecret("x", key), shortKey)).toThrow("invalid master encryption key");
  });
});
