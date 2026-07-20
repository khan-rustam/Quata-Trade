import { describe, expect, it } from "vitest";
import { zAdminHeldDepositDecision, zAdminHeldDepositQuery, zAdminHeldDepositRow } from "@quatatrade/shared";
import { RBAC } from "./admin.rbac";

/**
 * Held-deposit review contract (audit M1).
 *
 * These two routes are the ONLY exit from an aml_hold / policy_hold — a deposit
 * that reaches one is skipped by the confirmation job on every tick, so without
 * a decision the user's on-chain funds stay permanently uncreditable. That makes
 * the input contract and the role gate money-path surface, not cosmetics.
 */

describe("held-deposit decision contract", () => {
  it("REQUIRES a substantive reason — releasing a screening hold moves real money", () => {
    expect(zAdminHeldDepositDecision.safeParse({}).success).toBe(false);
    expect(zAdminHeldDepositDecision.safeParse({ reason: "" }).success).toBe(false);
    expect(zAdminHeldDepositDecision.safeParse({ reason: "ok" }).success).toBe(false); // too short to be an audit record
    expect(zAdminHeldDepositDecision.safeParse({ reason: "verified source with the counterparty" }).success).toBe(true);
  });

  it("rejects unknown body fields (no smuggling an amount or a user id past the gate)", () => {
    const res = zAdminHeldDepositDecision.safeParse({
      reason: "verified source with the counterparty",
      amount: "1000000",
    });
    expect(res.success).toBe(false);
  });

  it("caps the reason so it cannot be used to bloat an audit row", () => {
    expect(zAdminHeldDepositDecision.safeParse({ reason: "x".repeat(4001) }).success).toBe(false);
  });
});

describe("held-deposit queue contract", () => {
  it("defaults to showing BOTH hold kinds — an aml-only default would hide policy holds", () => {
    const parsed = zAdminHeldDepositQuery.parse({ page: 1, pageSize: 20 });
    expect(parsed.hold).toBe("all");
  });

  it("accepts only the three known filters", () => {
    for (const hold of ["all", "aml", "policy"]) {
      expect(zAdminHeldDepositQuery.safeParse({ page: 1, pageSize: 20, hold }).success).toBe(true);
    }
    expect(zAdminHeldDepositQuery.safeParse({ page: 1, pageSize: 20, hold: "released" }).success).toBe(false);
  });

  it("carries the amount as a smallest-unit STRING, never a number", () => {
    const row = {
      id: "00000000-0000-4000-8000-000000000001",
      userId: "00000000-0000-4000-8000-000000000002",
      userEmail: "u@example.com",
      asset: "USDT",
      amount: "150000000",
      address: "TXxx",
      txHash: "0xabc",
      fromAddress: "TYyy",
      confirmations: 20,
      amlHold: true,
      amlReason: "sanctioned counterparty",
      policyHold: false,
      policyReason: null,
      createdAt: new Date().toISOString(),
    };
    expect(zAdminHeldDepositRow.safeParse(row).success).toBe(true);
    expect(zAdminHeldDepositRow.safeParse({ ...row, amount: 150000000 }).success).toBe(false);
  });
});

describe("held-deposit RBAC", () => {
  it("is a COMPLIANCE decision — FINANCE cannot release a screening hold", () => {
    expect([...RBAC.reviewHeldDeposit]).toEqual(["SUPER_ADMIN", "COMPLIANCE_ADMIN"]);
    expect(RBAC.reviewHeldDeposit).not.toContain("FINANCE_ADMIN");
    expect(RBAC.reviewHeldDeposit).not.toContain("SUPPORT_ADMIN");
  });
});
