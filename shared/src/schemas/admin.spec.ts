import { describe, expect, it } from "vitest";
import { PAYMENT_METHODS } from "../constants.js";
import {
  zFeeBpsValue,
  zLedgerAdjustmentRequest,
  zWithdrawalCapsValue,
} from "./admin.js";

/**
 * Shared money-config contracts (2.D). The admin FE and the backend validate the
 * SAME schemas, so these tests pin the contract both sides depend on.
 */

const validAdjustment = {
  userId: "11111111-1111-1111-1111-111111111111",
  accountKind: "user_available" as const,
  asset: "USDT_TRC20" as const,
  amount: "-1500000",
  reason: "reversing an erroneous double credit",
  idempotencyKey: "adjustment-0001-abcdef", // >= 16 chars (zIdempotencyKey)
  totpCode: "123456",
};

describe("zLedgerAdjustmentRequest", () => {
  it("accepts a valid signed adjustment", () => {
    expect(zLedgerAdjustmentRequest.safeParse(validAdjustment).success).toBe(true);
  });
  it("defaults asset to USDT_TRC20", () => {
    const { asset: _asset, ...noAsset } = validAdjustment;
    const parsed = zLedgerAdjustmentRequest.safeParse(noAsset);
    expect(parsed.success && parsed.data.asset).toBe("USDT_TRC20");
  });
  it("rejects a zero amount", () => {
    expect(zLedgerAdjustmentRequest.safeParse({ ...validAdjustment, amount: "0" }).success).toBe(false);
  });
  it("rejects a non-integer / non-signed amount", () => {
    expect(zLedgerAdjustmentRequest.safeParse({ ...validAdjustment, amount: "1.5" }).success).toBe(false);
    expect(zLedgerAdjustmentRequest.safeParse({ ...validAdjustment, amount: "abc" }).success).toBe(false);
  });
  it("rejects a reason shorter than 10 chars", () => {
    expect(zLedgerAdjustmentRequest.safeParse({ ...validAdjustment, reason: "too short" }).success).toBe(false);
  });
  it("rejects an account kind other than user_available", () => {
    expect(zLedgerAdjustmentRequest.safeParse({ ...validAdjustment, accountKind: "platform_treasury" }).success).toBe(false);
  });
  it("rejects unknown (extra) fields", () => {
    expect(zLedgerAdjustmentRequest.safeParse({ ...validAdjustment, sneaky: true }).success).toBe(false);
  });
});

describe("zFeeBpsValue (full-rail snapshot)", () => {
  const full = (bps = 50) => Object.fromEntries(PAYMENT_METHODS.map((m) => [m, bps]));
  it("accepts a full snapshot; rejects a dropped rail and out-of-range bps", () => {
    expect(zFeeBpsValue.safeParse(full(50)).success).toBe(true);
    const missing = full(50);
    delete missing[PAYMENT_METHODS[0]!];
    expect(zFeeBpsValue.safeParse(missing).success).toBe(false);
    expect(zFeeBpsValue.safeParse({ ...full(50), QUATAPAY: 10_000 }).success).toBe(false);
  });
});

describe("zWithdrawalCapsValue (ordering, BigInt)", () => {
  const caps = (o = {}) => ({
    per_tx_max: "1000000000",
    daily_max: "2000000000",
    dual_approval_threshold: "500000000",
    auto_approve_below: "0",
    ...o,
  });
  it("accepts a coherent config and rejects violations of the ordering chain", () => {
    expect(zWithdrawalCapsValue.safeParse(caps()).success).toBe(true);
    expect(zWithdrawalCapsValue.safeParse(caps({ per_tx_max: "0" })).success).toBe(false);
    expect(zWithdrawalCapsValue.safeParse(caps({ dual_approval_threshold: "1500000000" })).success).toBe(false);
  });
});
