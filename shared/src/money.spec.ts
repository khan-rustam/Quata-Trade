import { describe, expect, it } from "vitest";
import { fromDisplay, isAmountString, parseAmount, serializeAmount, toDisplay } from "./money.js";

describe("money helpers", () => {
  it("parses valid amount strings", () => {
    expect(parseAmount("0")).toBe(0n);
    expect(parseAmount("1500000")).toBe(1_500_000n);
    expect(parseAmount("999999999999999999999")).toBe(999999999999999999999n);
  });

  it("rejects malformed amount strings", () => {
    for (const bad of ["", "-1", "1.5", "01", "1e6", " 1", "0x10", "NaN"]) {
      expect(() => parseAmount(bad), bad).toThrow();
      expect(isAmountString(bad), bad).toBe(false);
    }
  });

  it("serializes non-negative bigints and rejects negatives", () => {
    expect(serializeAmount(0n)).toBe("0");
    expect(serializeAmount(123n)).toBe("123");
    expect(() => serializeAmount(-1n)).toThrow();
  });

  it("converts units to display without rounding up", () => {
    expect(toDisplay(1_500_000n)).toBe("1.50");
    expect(toDisplay(1_999_999n)).toBe("1.99"); // truncates, never rounds money up
    expect(toDisplay("2500000", "USDT_TRC20", 6)).toBe("2.500000");
  });

  it("converts display to units exactly", () => {
    expect(fromDisplay("1.5")).toBe(1_500_000n);
    expect(fromDisplay("0.000001")).toBe(1n);
    expect(fromDisplay("200")).toBe(200_000_000n);
  });

  it("rejects excess precision instead of silently rounding", () => {
    expect(() => fromDisplay("0.0000001")).toThrow();
    expect(() => fromDisplay("1,5")).toThrow();
    expect(() => fromDisplay("-1")).toThrow();
  });

  it("round-trips display conversions", () => {
    for (const v of ["0.01", "1", "199.999999", "123456.5"]) {
      expect(toDisplay(fromDisplay(v), "USDT_TRC20", 6)).toBe(
        Number(v).toFixed(6),
      );
    }
  });
});
