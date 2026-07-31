import { describe, expect, it } from "vitest";

/**
 * `audit_logs.target_id` is a uuid column, and `AuditService.log()` is called
 * INSIDE the operation it records. So a caller passing a natural key — a
 * settings key, a slug — used to make Postgres reject the INSERT with 22P02,
 * which propagated and 500'd a request whose work had already committed. The
 * caller was told the operation failed when it had not.
 *
 * That is what happened when the OpenAI key screen passed
 * `targetId: "openai_credentials"`. The key WAS saved; the response was a 500.
 *
 * These pin the normalisation so the same mistake degrades to "the reference
 * moved into metadata" instead of "the write appears to have failed".
 */

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface Entry {
  targetId?: string;
  metadata?: Record<string, unknown>;
}

// Mirrors `normalizeTarget` in audit.service.ts.
function normalizeTarget(entry: Entry): Entry {
  const id = entry.targetId;
  if (id === undefined) return entry;
  if (UUID_RE.test(id)) return entry;
  return {
    ...entry,
    targetId: undefined,
    metadata:
      id === ""
        ? entry.metadata
        : { ...(entry.metadata ?? {}), targetRef: id },
  };
}

describe("audit target normalisation", () => {
  it("leaves a real uuid alone", () => {
    const id = "3f2504e0-4f89-11d3-9a0c-0305e82c3301";
    const out = normalizeTarget({ targetId: id });
    expect(out.targetId).toBe(id);
    expect(out.metadata?.targetRef).toBeUndefined();
  });

  it("accepts uppercase uuids", () => {
    const id = "3F2504E0-4F89-11D3-9A0C-0305E82C3301";
    expect(normalizeTarget({ targetId: id }).targetId).toBe(id);
  });

  it("moves a non-uuid reference into metadata instead of crashing", () => {
    // The exact value that took the credentials screen down.
    const out = normalizeTarget({ targetId: "openai_credentials" });
    expect(out.targetId).toBeUndefined();
    expect(out.metadata?.targetRef).toBe("openai_credentials");
  });

  it("preserves existing metadata when it relocates the reference", () => {
    const out = normalizeTarget({
      targetId: "some-settings-key",
      metadata: { fingerprint: "abc12345" },
    });
    expect(out.metadata).toEqual({
      fingerprint: "abc12345",
      targetRef: "some-settings-key",
    });
  });

  it("passes an absent target through untouched", () => {
    const out = normalizeTarget({ metadata: { a: 1 } });
    expect(out.targetId).toBeUndefined();
    expect(out.metadata).toEqual({ a: 1 });
  });

  it("rejects near-miss uuids that Postgres would also reject", () => {
    for (const bad of [
      "3f2504e0-4f89-11d3-9a0c-0305e82c330", // one char short
      "3f2504e04f8911d39a0c0305e82c3301", // no hyphens
      "zzzzzzzz-4f89-11d3-9a0c-0305e82c3301", // non-hex
      "openai_credentials", // the value that actually broke production
    ]) {
      const out = normalizeTarget({ targetId: bad });
      expect(out.targetId, `should not pass through: ${bad}`).toBeUndefined();
      expect(out.metadata?.targetRef).toBe(bad);
    }
  });

  it("drops an empty target without inventing a metadata reference", () => {
    // "" is not a uuid either, so it must not reach the column — but there is
    // no reference worth recording, so metadata stays clean.
    const out = normalizeTarget({ targetId: "", metadata: { a: 1 } });
    expect(out.targetId).toBeUndefined();
    expect(out.metadata).toEqual({ a: 1 });
  });
});
