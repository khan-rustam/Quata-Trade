import { randomBytes } from "node:crypto";
import { describe, expect, it } from "vitest";
import { decryptSecret, encryptSecret } from "../../common/crypto";
import { fingerprintOf } from "./ai-credentials.service";

/**
 * This is QuataTrade's first admin-writable secret, so the tests concentrate
 * on the properties that make that safe rather than on CRUD mechanics:
 *
 *   • the plaintext never survives a round-trip through storage,
 *   • the fingerprint identifies without reconstructing,
 *   • a wrong master key fails closed rather than returning garbage.
 *
 * The database wiring itself is covered by the integration suite; a mocked
 * Kysely here would assert that my mock works, not that the store does.
 */

const KEY = "sk-live-abcdefghijklmnopqrstuvwxyz0123456789";
const MASTER = randomBytes(32).toString("base64");

describe("fingerprintOf", () => {
  it("is stable, short, and reveals nothing about the key", () => {
    const fp = fingerprintOf(KEY);
    expect(fp).toHaveLength(8);
    expect(fp).toMatch(/^[0-9a-f]{8}$/);
    expect(fingerprintOf(KEY)).toBe(fp);
    // The point of a fingerprint: it is not a prefix of the secret.
    expect(KEY).not.toContain(fp);
  });

  it("separates two different keys", () => {
    expect(fingerprintOf(KEY)).not.toBe(fingerprintOf(`${KEY}x`));
  });

  it("cannot be reversed by comparing against a wrong guess", () => {
    // 32 bits is enough to spot a paste error and far too little to be a
    // meaningful preimage target for a high-entropy key. Asserted as a
    // property rather than a claim: neighbouring keys do not collide.
    const fps = new Set(
      Array.from({ length: 200 }, (_, i) => fingerprintOf(`${KEY}${i}`)),
    );
    expect(fps.size).toBe(200);
  });
});

describe("at-rest encryption of the stored key", () => {
  it("round-trips the key without the ciphertext containing it", () => {
    const blob = encryptSecret(KEY, MASTER);
    const stored = blob.toString("base64");

    // What actually lands in the settings row must not contain the key in
    // any encoding an accidental log or a DB dump would render.
    expect(stored).not.toContain(KEY);
    expect(blob.toString("utf8")).not.toContain(KEY);
    expect(blob.toString("hex")).not.toContain(
      Buffer.from(KEY, "utf8").toString("hex"),
    );

    expect(decryptSecret(Buffer.from(stored, "base64"), MASTER)).toBe(KEY);
  });

  it("produces a different ciphertext each time (fresh IV)", () => {
    // Deterministic ciphertext would let anyone with read access to the
    // settings table tell whether the key had actually changed.
    const a = encryptSecret(KEY, MASTER).toString("base64");
    const b = encryptSecret(KEY, MASTER).toString("base64");
    expect(a).not.toBe(b);
  });

  it("fails closed under a different master key", () => {
    const blob = encryptSecret(KEY, MASTER);
    const otherMaster = randomBytes(32).toString("base64");
    // GCM's auth tag means a wrong key is a hard failure, never plausible
    // garbage that would be sent to OpenAI as if it were the real key.
    expect(() => decryptSecret(blob, otherMaster)).toThrow();
  });

  it("fails closed on a truncated blob", () => {
    const blob = encryptSecret(KEY, MASTER);
    expect(() => decryptSecret(blob.subarray(0, 10), MASTER)).toThrow();
  });
});
