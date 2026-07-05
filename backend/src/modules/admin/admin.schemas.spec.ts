import { describe, expect, it } from "vitest";
import { MAX_FEE_BPS, PAYMENT_METHODS } from "@quatatrade/shared";
import { SETTING_VALUE_SCHEMAS } from "./admin.schemas";

/**
 * Money-config write-gate contract (2.D). SETTING_VALUE_SCHEMAS is the ONLY
 * validation between an admin PATCH and a full-value replace of a settings row,
 * so these schemas must reject anything that could brick the app or drop a rail.
 */

const feeSchema = SETTING_VALUE_SCHEMAS.fee_bps!;
const capsSchema = SETTING_VALUE_SCHEMAS.withdrawal_caps!;
const depositSchema = SETTING_VALUE_SCHEMAS.deposit_policy!;
const wFeeSchema = SETTING_VALUE_SCHEMAS.withdrawal_fee!;

/** A valid full-snapshot fee map covering every rail. */
const fullFees = (bps = 50): Record<string, number> =>
  Object.fromEntries(PAYMENT_METHODS.map((m) => [m, bps]));

describe("SETTING_VALUE_SCHEMAS.fee_bps (full-snapshot, all rails)", () => {
  it("accepts a full snapshot of every PAYMENT_METHODS rail", () => {
    expect(feeSchema.safeParse(fullFees(50)).success).toBe(true);
  });

  it("accepts bps at the MAX_FEE_BPS boundary and at 0", () => {
    expect(feeSchema.safeParse(fullFees(MAX_FEE_BPS)).success).toBe(true);
    expect(feeSchema.safeParse(fullFees(0)).success).toBe(true);
  });

  it("REJECTS a snapshot missing any rail (would silently drop it on full-replace)", () => {
    const missing = fullFees(50);
    delete missing[PAYMENT_METHODS[0]!];
    expect(feeSchema.safeParse(missing).success).toBe(false);
  });

  it("REJECTS an unknown rail", () => {
    expect(feeSchema.safeParse({ ...fullFees(50), NOT_A_RAIL: 50 }).success).toBe(false);
  });

  it("REJECTS bps above MAX_FEE_BPS (would collide with the trades fee_amount<amount CHECK)", () => {
    expect(feeSchema.safeParse({ ...fullFees(50), QUATAPAY: MAX_FEE_BPS + 1 }).success).toBe(false);
    expect(feeSchema.safeParse({ ...fullFees(50), QUATAPAY: 10_000 }).success).toBe(false);
  });

  it("REJECTS negative and non-integer bps", () => {
    expect(feeSchema.safeParse({ ...fullFees(50), QUATAPAY: -1 }).success).toBe(false);
    expect(feeSchema.safeParse({ ...fullFees(50), QUATAPAY: 12.5 }).success).toBe(false);
  });
});

describe("SETTING_VALUE_SCHEMAS.withdrawal_caps (ordering + backstop bound)", () => {
  const caps = (o: Partial<Record<string, string>> = {}) => ({
    per_tx_max: "1000000000",
    daily_max: "2000000000",
    dual_approval_threshold: "500000000",
    auto_approve_below: "0",
    ...o,
  });

  it("accepts a coherent seeded config", () => {
    expect(capsSchema.safeParse(caps()).success).toBe(true);
  });

  it("REJECTS per_tx_max = 0 (would block all withdrawals)", () => {
    expect(capsSchema.safeParse(caps({ per_tx_max: "0" })).success).toBe(false);
  });

  it("REJECTS daily_max < per_tx_max", () => {
    expect(capsSchema.safeParse(caps({ daily_max: "999999999", per_tx_max: "1000000000" })).success).toBe(false);
  });

  it("REJECTS auto_approve_below > dual_approval_threshold", () => {
    expect(capsSchema.safeParse(caps({ auto_approve_below: "600000000" })).success).toBe(false);
  });

  it("REJECTS dual_approval_threshold > per_tx_max", () => {
    expect(capsSchema.safeParse(caps({ dual_approval_threshold: "1500000000" })).success).toBe(false);
  });

  it("compares as BigInt (values above 2^53 do not lose precision to Number)", () => {
    // 18-digit values: above 2^53 (~9e15, where Number would round) but within int8.
    const big = "100000000000000000"; // 1e17
    const bigger = "100000000000000001"; // 1e17 + 1
    expect(capsSchema.safeParse(caps({ per_tx_max: big, daily_max: bigger, dual_approval_threshold: big, auto_approve_below: "0" })).success).toBe(true);
    expect(capsSchema.safeParse(caps({ per_tx_max: bigger, daily_max: big, dual_approval_threshold: big, auto_approve_below: "0" })).success).toBe(false);
  });

  it("REJECTS a cap above the PG int8 max (would overflow the trigger's bigint cast)", () => {
    expect(capsSchema.safeParse(caps({ per_tx_max: "9999999999999999999999999999", daily_max: "9999999999999999999999999999" })).success).toBe(false);
  });
});

describe("SETTING_VALUE_SCHEMAS.deposit_policy (min/max + fee, gross-based)", () => {
  const policy = (o: Record<string, unknown> = {}) => ({
    min_amount: "20000000", // 20 USDT
    max_amount: "100000000000", // 100k USDT
    fee_fixed: "1000000", // 1 USDT
    fee_bps: 0,
    confirmations: 19,
    ...o,
  });

  it("accepts a coherent Phase-1 policy (min 20, fee 1 USDT)", () => {
    expect(depositSchema.safeParse(policy()).success).toBe(true);
  });

  it("accepts a null / absent maximum (no cap)", () => {
    expect(depositSchema.safeParse(policy({ max_amount: null })).success).toBe(true);
    const { max_amount: _m, ...noMax } = policy();
    expect(depositSchema.safeParse(noMax).success).toBe(true);
  });

  it("REJECTS min_amount = 0", () => {
    expect(depositSchema.safeParse(policy({ min_amount: "0" })).success).toBe(false);
  });

  it("REJECTS max_amount below min_amount", () => {
    expect(depositSchema.safeParse(policy({ max_amount: "10000000" })).success).toBe(false);
  });

  it("REJECTS a fee that meets or exceeds the minimum deposit (net would be <= 0)", () => {
    expect(depositSchema.safeParse(policy({ fee_fixed: "20000000" })).success).toBe(false); // fee == min
    expect(depositSchema.safeParse(policy({ fee_fixed: "19500000", fee_bps: 500 })).success).toBe(false); // fixed+pct >= min
  });

  it("REJECTS a percentage above MAX_FEE_BPS and an unknown field", () => {
    expect(depositSchema.safeParse(policy({ fee_bps: MAX_FEE_BPS + 1 })).success).toBe(false);
    expect(depositSchema.safeParse({ ...policy(), sneaky: 1 }).success).toBe(false);
  });
});

describe("SETTING_VALUE_SCHEMAS.withdrawal_fee (fixed + percentage, legacy compat)", () => {
  it("accepts the legacy fixed-only string and the new { fixed, bps } form", () => {
    expect(wFeeSchema.safeParse({ USDT_TRC20: "1000000" }).success).toBe(true);
    expect(wFeeSchema.safeParse({ USDT_TRC20: { fixed: "1000000", bps: 50 } }).success).toBe(true);
  });
  it("REJECTS a payload missing USDT_TRC20 and an out-of-range bps", () => {
    expect(wFeeSchema.safeParse({}).success).toBe(false);
    expect(wFeeSchema.safeParse({ USDT_TRC20: { fixed: "0", bps: MAX_FEE_BPS + 1 } }).success).toBe(false);
  });
});

describe("SETTING_VALUE_SCHEMAS action fees (advertisement_fee / dispute_fee)", () => {
  it("accept a smallest-unit amount string (0 = disabled) and reject non-integers", () => {
    expect(SETTING_VALUE_SCHEMAS.advertisement_fee!.safeParse("0").success).toBe(true);
    expect(SETTING_VALUE_SCHEMAS.dispute_fee!.safeParse("500000").success).toBe(true);
    expect(SETTING_VALUE_SCHEMAS.advertisement_fee!.safeParse("1.5").success).toBe(false);
  });
});

describe("SETTING_VALUE_SCHEMAS.seller_fee_bps (Phase-2 per-side fee)", () => {
  const s = SETTING_VALUE_SCHEMAS.seller_fee_bps!;
  it("accepts 0 (disabled) and a Phase-2 rate (20–50 bps)", () => {
    expect(s.safeParse(0).success).toBe(true);
    expect(s.safeParse(30).success).toBe(true);
    expect(s.safeParse(MAX_FEE_BPS).success).toBe(true);
  });
  it("REJECTS negatives, non-integers, and out-of-range (>= 100% would brick escrow math)", () => {
    expect(s.safeParse(-1).success).toBe(false);
    expect(s.safeParse(12.5).success).toBe(false);
    expect(s.safeParse(MAX_FEE_BPS + 1).success).toBe(false);
  });
});

describe("SETTING_VALUE_SCHEMAS.promo_campaigns (time + country + fee override)", () => {
  const promoSchema = SETTING_VALUE_SCHEMAS.promo_campaigns!;
  const promo = (o: Record<string, unknown> = {}) => ({
    id: "launch-2026",
    feeType: "trading",
    country: "CM",
    startsAt: "2026-01-01T00:00:00.000Z",
    endsAt: "2026-12-31T00:00:00.000Z",
    discountBps: 0,
    ...o,
  });

  it("accepts an empty array (no active promos — the seeded default)", () => {
    expect(promoSchema.safeParse([]).success).toBe(true);
  });

  it("accepts a country-scoped and a global (null) campaign", () => {
    expect(promoSchema.safeParse([promo()]).success).toBe(true);
    expect(promoSchema.safeParse([promo({ country: null })]).success).toBe(true);
  });

  it("REJECTS endsAt <= startsAt", () => {
    expect(promoSchema.safeParse([promo({ endsAt: "2026-01-01T00:00:00.000Z" })]).success).toBe(false);
  });

  it("REJECTS an unknown fee type, a bad country length, and out-of-range discount", () => {
    expect(promoSchema.safeParse([promo({ feeType: "listing" })]).success).toBe(false);
    expect(promoSchema.safeParse([promo({ country: "CMR" })]).success).toBe(false);
    expect(promoSchema.safeParse([promo({ discountBps: MAX_FEE_BPS + 1 })]).success).toBe(false);
  });

  it("REJECTS an unknown field (strict)", () => {
    expect(promoSchema.safeParse([promo({ sneaky: 1 })]).success).toBe(false);
  });
});
