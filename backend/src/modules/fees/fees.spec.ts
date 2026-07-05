import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { MAX_FEE_BPS } from "@quatatrade/shared";
import { computeDepositFee, computeFee, fiatValueXaf, split, splitPerSide } from "./fees";

const arbAmount = fc.bigInt({ min: 0n, max: 10n ** 15n }); // up to 10^9 USDT in units
// Exercise the FULL editable bps range (0..MAX_FEE_BPS), not just the seeded 30/50 —
// an admin can now set any rail's fee, so the invariants must hold across the range.
const arbBps = fc.integer({ min: 0, max: MAX_FEE_BPS });

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

  it("fee is strictly less than amount for any positive amount and bps <= MAX_FEE_BPS", () => {
    // Guarantees the trades `fee_amount < amount` CHECK can never be violated by a
    // configured fee — the whole reason MAX_FEE_BPS is < 10000.
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

  it("rejects bps above MAX_FEE_BPS (100% fee would brick the trades CHECK) but accepts the boundary", () => {
    expect(() => computeFee(100n, 10_000)).toThrow(); // 100% no longer allowed
    expect(() => computeFee(100n, MAX_FEE_BPS + 1)).toThrow();
    expect(computeFee(100n, MAX_FEE_BPS)).toBe((100n * BigInt(MAX_FEE_BPS)) / 10_000n);
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

describe("splitPerSide — per-side (buyer + seller) trading fee", () => {
  it("escrow conservation: sellerLock === buyerCredit + totalFee, exactly, always", () => {
    fc.assert(
      fc.property(arbAmount, arbBps, arbBps, (amount, buyerBps, sellerBps) => {
        const s = splitPerSide(amount, buyerBps, sellerBps);
        // Whatever the seller locks leaves escrow exactly: buyer credit + treasury fee.
        expect(s.sellerLock).toBe(s.buyerCredit + s.totalFee);
        expect(s.sellerLock).toBe(amount + s.sellerFee);
        expect(s.buyerCredit).toBe(amount - s.buyerFee);
        expect(s.totalFee).toBe(s.buyerFee + s.sellerFee);
        expect(s.buyerFee >= 0n && s.sellerFee >= 0n).toBe(true);
      }),
      { numRuns: 10_000 },
    );
  });

  it("buyerCredit stays strictly positive for any positive amount (buyer never over-charged)", () => {
    fc.assert(
      fc.property(fc.bigInt({ min: 1n, max: 10n ** 15n }), arbBps, arbBps, (amount, buyerBps, sellerBps) => {
        expect(splitPerSide(amount, buyerBps, sellerBps).buyerCredit > 0n).toBe(true);
      }),
      { numRuns: 5_000 },
    );
  });

  it("Phase-1 (0/0): seller locks exactly amount, buyer receives amount, no fee", () => {
    const s = splitPerSide(100n * 1_000_000n, 0, 0);
    expect(s.sellerLock).toBe(100n * 1_000_000n);
    expect(s.buyerCredit).toBe(100n * 1_000_000n);
    expect(s.totalFee).toBe(0n);
  });

  it("Phase-2 seller fee (0.3%): seller locks amount+sellerFee, buyer gets full amount", () => {
    // buyer 0% + seller 0.30% on 100 USDT: sellerFee 0.30, buyer receives 100, treasury 0.30
    const s = splitPerSide(100n * 1_000_000n, 0, 30);
    expect(s.sellerFee).toBe(300_000n);
    expect(s.buyerFee).toBe(0n);
    expect(s.buyerCredit).toBe(100n * 1_000_000n);
    expect(s.sellerLock).toBe(100_300_000n);
    expect(s.totalFee).toBe(300_000n);
  });

  it("both sides charged: fees accrue independently to treasury", () => {
    // buyer 0.50% + seller 0.30% on 100 USDT
    const s = splitPerSide(100n * 1_000_000n, 50, 30);
    expect(s.buyerFee).toBe(500_000n);
    expect(s.sellerFee).toBe(300_000n);
    expect(s.buyerCredit).toBe(99_500_000n);
    expect(s.sellerLock).toBe(100_300_000n);
    expect(s.totalFee).toBe(800_000n);
  });

  it("rejects an out-of-range bps on either side", () => {
    expect(() => splitPerSide(100n, MAX_FEE_BPS + 1, 0)).toThrow();
    expect(() => splitPerSide(100n, 0, MAX_FEE_BPS + 1)).toThrow();
    expect(() => splitPerSide(-1n, 0, 0)).toThrow();
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

describe("computeDepositFee", () => {
  const USDT = 1_000_000n;

  it("fixed-only fee (Phase 1: 1 USDT flat)", () => {
    expect(computeDepositFee(100n * USDT, 1n * USDT, 0)).toBe(1n * USDT); // deposit 100 → fee 1
    expect(computeDepositFee(20n * USDT, 1n * USDT, 0)).toBe(1n * USDT);
  });

  it("fixed + percentage", () => {
    // 100 USDT @ 1 USDT fixed + 0.5% = 1 + 0.5 = 1.5 USDT
    expect(computeDepositFee(100n * USDT, 1n * USDT, 50)).toBe(1_500_000n);
  });

  it("percentage-only (fixed = 0) equals computeFee", () => {
    expect(computeDepositFee(100n * USDT, 0n, 50)).toBe(computeFee(100n * USDT, 50));
  });

  it("is always >= 0 and (fixed + floor(amount*bps/10000)) for random inputs", () => {
    fc.assert(
      fc.property(arbAmount, fc.bigInt({ min: 0n, max: 10n ** 9n }), arbBps, (amount, fixed, bps) => {
        const fee = computeDepositFee(amount, fixed, bps);
        expect(fee).toBe(fixed + (amount * BigInt(bps)) / 10_000n);
        expect(fee >= 0n).toBe(true);
      }),
      { numRuns: 5_000 },
    );
  });

  it("rejects a negative fixed fee, a negative amount, and an out-of-range bps", () => {
    expect(() => computeDepositFee(100n, -1n, 0)).toThrow();
    expect(() => computeDepositFee(-1n, 1n, 0)).toThrow();
    expect(() => computeDepositFee(100n, 1n, MAX_FEE_BPS + 1)).toThrow();
  });
});
