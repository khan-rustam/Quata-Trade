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
