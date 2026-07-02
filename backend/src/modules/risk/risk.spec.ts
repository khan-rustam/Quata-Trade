import { describe, expect, it } from "vitest";
import {
  actionForScore,
  computeScore,
  DEFAULT_RISK_CONFIG,
  type RiskInputs,
} from "./risk.rules";

const DAY_MS = 24 * 60 * 60 * 1000;

/** A boring, established account doing one small withdrawal: zero risk. */
const clean: RiskInputs = {
  kind: "withdrawal",
  eventsThisHour: 1,
  amount: 1_000_000n, // 1 USDT
  tierLimit: 100_000_000n, // 100 USDT daily limit
  accountAgeMs: 30 * DAY_MS,
  isNewDevice: false,
};

describe("computeScore — baseline", () => {
  it("scores 0 with no flags for a clean event", () => {
    const { score, flags } = computeScore(clean);
    expect(score).toBe(0);
    expect(flags).toEqual({});
  });

  it("is deterministic — same inputs, same output", () => {
    expect(computeScore(clean)).toEqual(computeScore(clean));
  });
});

describe("velocity rule (+30)", () => {
  it("does NOT flag at exactly 3 withdrawals/hour", () => {
    const { score, flags } = computeScore({ ...clean, eventsThisHour: 3 });
    expect(score).toBe(0);
    expect(flags["velocity_exceeded"]).toBeUndefined();
  });

  it("flags at >3 withdrawals/hour", () => {
    const { score, flags } = computeScore({ ...clean, eventsThisHour: 4 });
    expect(score).toBe(30);
    expect(flags["velocity_exceeded"]?.points).toBe(30);
    expect(flags["velocity_exceeded"]?.detail).toContain("4 withdrawal events");
  });

  it("uses a per-kind threshold (login allows more)", () => {
    const login: RiskInputs = { ...clean, kind: "login", amount: null, tierLimit: null };
    expect(computeScore({ ...login, eventsThisHour: 10 }).score).toBe(0);
    expect(computeScore({ ...login, eventsThisHour: 11 }).score).toBe(30);
  });
});

describe("near-tier-limit rule (+25) — exact bigint math", () => {
  it("does NOT flag at exactly 80% of the limit", () => {
    const { score } = computeScore({ ...clean, amount: 80_000_000n, tierLimit: 100_000_000n });
    expect(score).toBe(0);
  });

  it("flags one smallest-unit above 80%", () => {
    const { score, flags } = computeScore({ ...clean, amount: 80_000_001n, tierLimit: 100_000_000n });
    expect(score).toBe(25);
    expect(flags["near_tier_limit"]?.points).toBe(25);
  });

  it("flags any positive amount against a tier-0 (zero) limit", () => {
    const { flags } = computeScore({ ...clean, amount: 1n, tierLimit: 0n });
    expect(flags["near_tier_limit"]).toBeDefined();
  });

  it("skips the rule when amount or limit is not applicable (login)", () => {
    const { flags } = computeScore({ ...clean, amount: null, tierLimit: null });
    expect(flags["near_tier_limit"]).toBeUndefined();
  });
});

describe("young-account rule (+20)", () => {
  it("flags an account younger than 24h", () => {
    const { score, flags } = computeScore({ ...clean, accountAgeMs: DAY_MS - 1 });
    expect(score).toBe(20);
    expect(flags["new_account"]?.points).toBe(20);
  });

  it("does NOT flag at exactly 24h", () => {
    expect(computeScore({ ...clean, accountAgeMs: DAY_MS }).score).toBe(0);
  });
});

describe("new-device rule (+15)", () => {
  it("flags an unseen device fingerprint", () => {
    const { score, flags } = computeScore({ ...clean, isNewDevice: true });
    expect(score).toBe(15);
    expect(flags["new_device"]?.points).toBe(15);
  });
});

describe("combination, cap and explainability", () => {
  const worst: RiskInputs = {
    kind: "withdrawal",
    eventsThisHour: 10,
    amount: 99_000_000n,
    tierLimit: 100_000_000n,
    accountAgeMs: 60_000,
    isNewDevice: true,
  };

  it("sums all triggered rules (30+25+20+15 = 90) and stays within 0–100", () => {
    const { score, flags } = computeScore(worst);
    expect(score).toBe(90);
    expect(Object.keys(flags).sort()).toEqual([
      "near_tier_limit",
      "new_account",
      "new_device",
      "velocity_exceeded",
    ]);
    const total = Object.values(flags).reduce((sum, f) => sum + f.points, 0);
    expect(total).toBe(90);
  });

  it("caps the score at 100 even with inflated config points", () => {
    const inflated = { ...DEFAULT_RISK_CONFIG, velocityPoints: 300 };
    expect(computeScore(worst, inflated).score).toBe(100);
  });

  it("every flag carries points and a non-empty explanation", () => {
    for (const flag of Object.values(computeScore(worst).flags)) {
      expect(flag.points).toBeGreaterThan(0);
      expect(flag.detail.length).toBeGreaterThan(0);
    }
  });
});

describe("actionForScore thresholds", () => {
  it("none below 70", () => {
    expect(actionForScore(0)).toBe("none");
    expect(actionForScore(69)).toBe("none");
  });

  it("escalate at 70–89", () => {
    expect(actionForScore(70)).toBe("escalate");
    expect(actionForScore(89)).toBe("escalate");
  });

  it("freeze at >= 90", () => {
    expect(actionForScore(90)).toBe("freeze");
    expect(actionForScore(100)).toBe("freeze");
  });

  it("respects config overrides", () => {
    const strict = { ...DEFAULT_RISK_CONFIG, escalateAt: 40, freezeAt: 60 };
    expect(actionForScore(45, strict)).toBe("escalate");
    expect(actionForScore(60, strict)).toBe("freeze");
  });
});
