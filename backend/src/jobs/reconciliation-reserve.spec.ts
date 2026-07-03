import { describe, expect, it } from "vitest";
import { reserveShortfall } from "./reconciliation.job";

const TOL = 1_000_000n; // 1 USDT tolerance

describe("reserveShortfall (item 5b — on-chain reserve check)", () => {
  it("is healthy when on-chain custody exceeds obligations", () => {
    expect(reserveShortfall(100_000_000n, 90_000_000n, TOL)).toEqual({ breached: false, shortfall: 0n });
  });

  it("is healthy when the deficit is within tolerance (rounding / timing slack)", () => {
    // obligations exceed custody by exactly the tolerance → not breached
    expect(reserveShortfall(90_000_000n, 91_000_000n, TOL)).toEqual({ breached: false, shortfall: 1_000_000n });
  });

  it("breaches when the deficit exceeds tolerance", () => {
    const res = reserveShortfall(90_000_000n, 92_000_000n, TOL);
    expect(res.breached).toBe(true);
    expect(res.shortfall).toBe(2_000_000n);
  });

  it("reports zero shortfall (never negative) when over-reserved", () => {
    expect(reserveShortfall(200_000_000n, 50_000_000n, TOL).shortfall).toBe(0n);
  });

  it("with zero tolerance, any deficit breaches", () => {
    expect(reserveShortfall(10n, 11n, 0n)).toEqual({ breached: true, shortfall: 1n });
    expect(reserveShortfall(11n, 11n, 0n)).toEqual({ breached: false, shortfall: 0n });
  });
});
