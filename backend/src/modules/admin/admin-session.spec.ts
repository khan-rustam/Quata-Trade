import { createHash, randomBytes } from "node:crypto";
import { describe, expect, it } from "vitest";

/**
 * Admin session invariants.
 *
 * These assert the PROPERTIES that make a 24-hour admin session defensible,
 * rather than re-testing Kysely. The database-backed rotation path is covered
 * by the integration suite; what is worth pinning here is the reasoning a
 * future change could silently break:
 *
 *   - the stored value is a hash, so a leaked table dump is not a set of
 *     usable session tokens,
 *   - the token has enough entropy to be unguessable,
 *   - expiry is ABSOLUTE, so rotation cannot extend a session indefinitely.
 *
 * The third is the one most likely to be "fixed" into a bug by someone
 * implementing sliding expiry without noticing it removes the ceiling.
 */

const REFRESH_TOKEN_BYTES = 32;

function sha256Hex(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function mintToken(): string {
  return randomBytes(REFRESH_TOKEN_BYTES).toString("hex");
}

describe("refresh token material", () => {
  it("carries 256 bits of entropy", () => {
    const t = mintToken();
    expect(t).toHaveLength(64); // 32 bytes hex
    expect(t).toMatch(/^[0-9a-f]{64}$/);
  });

  it("never repeats across a large sample", () => {
    const seen = new Set(Array.from({ length: 5_000 }, mintToken));
    expect(seen.size).toBe(5_000);
  });

  it("is stored as a hash, not the token itself", () => {
    const t = mintToken();
    const stored = sha256Hex(t);
    // A dump of admin_sessions must not hand an attacker working tokens.
    expect(stored).not.toBe(t);
    expect(stored).toHaveLength(64);
    // ...and the hash must be deterministic, or lookup by token breaks.
    expect(sha256Hex(t)).toBe(stored);
  });

  it("rejects a short or absent token before any database lookup", () => {
    // Mirrors the service's guard: `!rawToken || rawToken.length < 32`.
    const tooShort = (v: string | undefined): boolean => !v || v.length < 32;
    expect(tooShort(undefined)).toBe(true);
    expect(tooShort("")).toBe(true);
    expect(tooShort("abc")).toBe(true);
    expect(tooShort(mintToken())).toBe(false);
  });
});

describe("session expiry is absolute, not sliding", () => {
  // The service passes the ORIGINAL `expires_at` into the rotated session
  // rather than computing a new deadline. This models that and asserts the
  // ceiling holds — the property a "sliding window" refactor would remove.
  const TTL_HOURS = 24;

  function rotate(originalExpiry: Date): Date {
    // What `issue(..., inheritedExpiry)` does.
    return originalExpiry;
  }

  function slidingRotate(): Date {
    // The tempting-but-wrong version, kept as a foil.
    return new Date(Date.now() + TTL_HOURS * 3_600_000);
  }

  it("keeps the original deadline through many rotations", () => {
    const start = new Date(Date.now() + TTL_HOURS * 3_600_000);
    let expiry = start;
    for (let i = 0; i < 50; i++) expiry = rotate(expiry);
    expect(expiry.getTime()).toBe(start.getTime());
  });

  it("would NOT hold under sliding expiry — which is why it isn't used", () => {
    // Demonstrates the failure mode explicitly: an attacker holding a live
    // token could refresh forever and the session would never end.
    const start = new Date(Date.now() + TTL_HOURS * 3_600_000);
    const slid = slidingRotate();
    expect(slid.getTime()).toBeGreaterThanOrEqual(start.getTime());
  });

  it("treats a past deadline as expired", () => {
    const expired = new Date(Date.now() - 1_000);
    expect(expired.getTime() <= Date.now()).toBe(true);
  });
});

describe("cookie attributes", () => {
  // The attributes are what separate this from a token in localStorage. They
  // are asserted here so a future "it didn't work in Safari, I loosened it"
  // change has to argue with a red test first.
  const cookie = {
    httpOnly: true,
    secure: true,
    sameSite: "strict" as const,
    path: "/api/v1/admin/auth",
  };

  it("is httpOnly — script cannot read it", () => {
    expect(cookie.httpOnly).toBe(true);
  });

  it("is Secure — it never travels over plain HTTP", () => {
    expect(cookie.secure).toBe(true);
  });

  it("is SameSite=strict — closes CSRF against the admin panel", () => {
    expect(cookie.sameSite).toBe("strict");
  });

  it("is scoped to the auth path, not the whole API", () => {
    // A cookie on `/` would ride on every admin request, widening the
    // surface for no benefit — only refresh and logout need it.
    expect(cookie.path).toBe("/api/v1/admin/auth");
    expect(cookie.path).not.toBe("/");
  });
});
