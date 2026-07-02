import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

/**
 * AES-256-GCM helpers for `users.totp_secret_enc` (bytea).
 *
 * NOTE (cross-module contract): `src/common/crypto.ts` did not exist when the
 * withdrawals module was written, so the layout is defined HERE and the auth
 * module MUST encrypt with the exact same layout (or this file must be replaced
 * by the shared helper): `iv(12 bytes) ‖ authTag(16 bytes) ‖ ciphertext`.
 * Key = MASTER_ENCRYPTION_KEY (32 bytes, base64 in env). Never log inputs/outputs.
 */

const IV_LENGTH = 12;
const TAG_LENGTH = 16;

export function encryptSecret(plaintext: string, key: Buffer): Buffer {
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), ciphertext]);
}

export function decryptSecret(encrypted: Buffer, key: Buffer): string {
  if (encrypted.length < IV_LENGTH + TAG_LENGTH + 1) {
    throw new Error("ciphertext too short");
  }
  const iv = encrypted.subarray(0, IV_LENGTH);
  const tag = encrypted.subarray(IV_LENGTH, IV_LENGTH + TAG_LENGTH);
  const ciphertext = encrypted.subarray(IV_LENGTH + TAG_LENGTH);
  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8");
}
