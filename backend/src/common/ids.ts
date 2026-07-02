import { randomBytes } from "node:crypto";
import { uuidv7 } from "uuidv7";

/** App-generated UUIDv7 primary keys (Documents/04-database-schema.md). */
export function newId(): string {
  return uuidv7();
}

const SHORT_REF_ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ"; // Crockford base32 — no I/L/O/U

/** Human-readable trade reference, e.g. QT-8F3K2. Uniqueness enforced by DB; caller retries on collision. */
export function newShortRef(): string {
  const bytes = randomBytes(5);
  let ref = "";
  for (let i = 0; i < 5; i += 1) {
    const byte = bytes[i] ?? 0;
    ref += SHORT_REF_ALPHABET[byte % 32];
  }
  return `QT-${ref}`;
}
