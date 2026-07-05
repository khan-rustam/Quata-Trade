import { describe, expect, it } from "vitest";
import type { PromoCampaignsValue } from "@quatatrade/shared";
import { resolvePromoBps } from "./promo.service";

/**
 * Pure resolver semantics (no I/O, no real clock): a campaign matches when its
 * feeType equals the query, its country is null (all markets) or the caller's,
 * and now ∈ [startsAt, endsAt). When several match, the MOST GENEROUS (lowest
 * discountBps) wins. No match → null (caller falls back to the normal fee).
 */
describe("resolvePromoBps", () => {
  const at = (iso: string) => new Date(iso);
  const campaign = (over: Partial<PromoCampaignsValue[number]>): PromoCampaignsValue[number] => ({
    id: "11111111-1111-1111-1111-111111111111",
    feeType: "trading",
    country: null,
    startsAt: "2026-01-01T00:00:00.000Z",
    endsAt: "2026-12-31T00:00:00.000Z",
    discountBps: 0,
    ...over,
  });

  it("returns null for an empty campaign list", () => {
    expect(resolvePromoBps([], "trading", "CM", at("2026-06-01T00:00:00.000Z"))).toBeNull();
  });

  it("ignores a campaign of a different fee type", () => {
    const c = [campaign({ feeType: "deposit" })];
    expect(resolvePromoBps(c, "trading", "CM", at("2026-06-01T00:00:00.000Z"))).toBeNull();
  });

  it("ignores a campaign scoped to a different country", () => {
    const c = [campaign({ country: "GA" })];
    expect(resolvePromoBps(c, "trading", "CM", at("2026-06-01T00:00:00.000Z"))).toBeNull();
  });

  it("matches a country-scoped campaign for that country", () => {
    const c = [campaign({ country: "CM", discountBps: 0 })];
    expect(resolvePromoBps(c, "trading", "CM", at("2026-06-01T00:00:00.000Z"))).toBe(0);
  });

  it("a global (country=null) campaign matches any market", () => {
    const c = [campaign({ country: null, discountBps: 25 })];
    expect(resolvePromoBps(c, "trading", "CM", at("2026-06-01T00:00:00.000Z"))).toBe(25);
    expect(resolvePromoBps(c, "trading", "GA", at("2026-06-01T00:00:00.000Z"))).toBe(25);
  });

  it("startsAt is inclusive, endsAt is exclusive", () => {
    const c = [campaign({ startsAt: "2026-06-01T00:00:00.000Z", endsAt: "2026-06-02T00:00:00.000Z" })];
    // one ms before start → no match
    expect(resolvePromoBps(c, "trading", "CM", at("2026-05-31T23:59:59.999Z"))).toBeNull();
    // exactly at start → match
    expect(resolvePromoBps(c, "trading", "CM", at("2026-06-01T00:00:00.000Z"))).toBe(0);
    // one ms before end → still match
    expect(resolvePromoBps(c, "trading", "CM", at("2026-06-01T23:59:59.999Z"))).toBe(0);
    // exactly at end → no match (exclusive)
    expect(resolvePromoBps(c, "trading", "CM", at("2026-06-02T00:00:00.000Z"))).toBeNull();
  });

  it("returns the most generous (lowest) discount among overlapping campaigns", () => {
    const c = [
      campaign({ discountBps: 30 }),
      campaign({ country: "CM", discountBps: 10 }),
      campaign({ discountBps: 20 }),
    ];
    expect(resolvePromoBps(c, "trading", "CM", at("2026-06-01T00:00:00.000Z"))).toBe(10);
  });

  it("a zero-discount campaign wins over a nonzero one (0% fee promo)", () => {
    const c = [campaign({ discountBps: 15 }), campaign({ country: "CM", discountBps: 0 })];
    expect(resolvePromoBps(c, "trading", "CM", at("2026-06-01T00:00:00.000Z"))).toBe(0);
  });
});
