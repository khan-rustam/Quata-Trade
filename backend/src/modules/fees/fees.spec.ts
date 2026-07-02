import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { computeFee, fiatValueXaf, split } from "./fees";

const arbAmount = fc.bigInt({ min: 0n, max: 10n ** 15n }); // up to 10^9 USDT in units
const arbBps = fc.constantFrom(30, 50); // QuataPay / MoMo & Orange

describe("computeFee", () => {
  it("is floor(amount*bps/10000) for thousands of random cases", () => {
    fc.assert(
      fc.property(arbAmount, arbBps, (amount, bps) => {
        const fee = computeFee(amount, bps);
        expect(fee).toBe((amount * BigInt(bps)) / 10_000n);
        expect(fee >= 0n).toBe(true);
        expect(fee <= amount).toBe(true);
      }),
      { numRuns: 5_000 },
    );
  });

  it("fee is strictly less than amount for any positive amount and bps < 10000", () => {
    fc.assert(
      fc.property(fc.bigInt({ min: 1n, max: 10n ** 15n }), arbBps, (amount, bps) => {
        expect(computeFee(amount, bps) < amount).toBe(true);
      }),
      { numRuns: 5_000 },
    );
  });

  it("rejects invalid inputs", () => {
    expect(() => computeFee(-1n, 30)).toThrow();
    expect(() => computeFee(100n, -1)).toThrow();
    expect(() => computeFee(100n, 10_001)).toThrow();
    expect(() => computeFee(100n, 0.5)).toThrow();
  });

  it("handles exact known values", () => {
    expect(computeFee(1_000_000n, 30)).toBe(3_000n); // 1 USDT @0.3% = 0.003
    expect(computeFee(1_000_000n, 50)).toBe(5_000n);
    expect(computeFee(1n, 30)).toBe(0n); // dust rounds down, never up
    expect(computeFee(0n, 50)).toBe(0n);
  });
});

describe("split — golden invariant", () => {
  it("buyerCredit + fee === amount, exactly, always (no rounding leak)", () => {
    fc.assert(
      fc.property(arbAmount, arbBps, (amount, bps) => {
        const { buyerCredit, fee } = split(amount, bps);
        expect(buyerCredit + fee).toBe(amount);
        expect(buyerCredit >= 0n).toBe(true);
        expect(fee >= 0n).toBe(true);
      }),
      { numRuns: 10_000 },
    );
  });

  it("sum over many trades loses/gains nothing vs inputs", () => {
    fc.assert(
      fc.property(fc.array(fc.tuple(arbAmount, arbBps), { maxLength: 200 }), (trades) => {
        let totalIn = 0n;
        let totalOut = 0n;
        for (const [amount, bps] of trades) {
          const { buyerCredit, fee } = split(amount, bps);
          totalIn += amount;
          totalOut += buyerCredit + fee;
        }
        expect(totalOut).toBe(totalIn);
      }),
      { numRuns: 500 },
    );
  });
});

describe("fiatValueXaf", () => {
  it("computes floor(amount*price/10^decimals)", () => {
    // 150 USDT (150_000_000 units) @ 650 XAF/USDT = 97_500 XAF
    expect(fiatValueXaf(150_000_000n, 650n, 6)).toBe(97_500n);
    // sub-unit truncates down
    expect(fiatValueXaf(1n, 650n, 6)).toBe(0n);
  });

  it("never creates value out of thin air", () => {
    fc.assert(
      fc.property(arbAmount, fc.bigInt({ min: 1n, max: 10n ** 9n }), (amount, price) => {
        const fiat = fiatValueXaf(amount, price, 6);
        expect(fiat * 10n ** 6n <= amount * price).toBe(true);
        expect((fiat + 1n) * 10n ** 6n > amount * price).toBe(true);
      }),
      { numRuns: 5_000 },
    );
  });

  it("rejects invalid input", () => {
    expect(() => fiatValueXaf(-1n, 650n, 6)).toThrow();
    expect(() => fiatValueXaf(1n, 0n, 6)).toThrow();
    expect(() => fiatValueXaf(1n, 650n, 19)).toThrow();
    expect(() => fiatValueXaf(1n, 650n, 1.5)).toThrow();
  });
});
