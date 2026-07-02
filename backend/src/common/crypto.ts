import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

/**
 * AES-256-GCM secret encryption for at-rest secrets (TOTP seeds — never
 * private keys; those live only in the isolated signer, Documents/08 §D).
 *
 * Buffer layout: [ 12-byte IV | 16-byte auth tag | ciphertext ].
 * Key: MASTER_ENCRYPTION_KEY env — 32 bytes, base64. Errors are generic on
 * purpose: nothing about key material or plaintext ever reaches logs.
 */

const IV_LENGTH = 12;
const TAG_LENGTH = 16;

function masterKey(masterKeyBase64: string): Buffer {
  const key = Buffer.from(masterKeyBase64, "base64");
  if (key.length !== 32) {
    throw new Error("invalid master encryption key");
  }
  return key;
}

export function encryptSecret(plaintext: string, masterKeyBase64: string): Buffer {
  const key = masterKey(masterKeyBase64);
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), ciphertext]);
}

export function decryptSecret(blob: Buffer, masterKeyBase64: string): string {
  const key = masterKey(masterKeyBase64);
  if (blob.length < IV_LENGTH + TAG_LENGTH) {
    throw new Error("decryption failed");
  }
  try {
    const iv = blob.subarray(0, IV_LENGTH);
    const tag = blob.subarray(IV_LENGTH, IV_LENGTH + TAG_LENGTH);
    const ciphertext = blob.subarray(IV_LENGTH + TAG_LENGTH);
    const decipher = createDecipheriv("aes-256-gcm", key, iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8");
  } catch {
    // generic on purpose — no oracle about why (bad tag, truncation, wrong key)
    throw new Error("decryption failed");
  }
}
