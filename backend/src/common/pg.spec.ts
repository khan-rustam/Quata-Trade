import { describe, expect, it } from "vitest";
import { parsePgEnumArray } from "./pg";

describe("parsePgEnumArray", () => {
  it("parses a Postgres enum-array literal into a JS array", () => {
    expect(parsePgEnumArray("{MTN_MOMO,ORANGE_MONEY}")).toEqual(["MTN_MOMO", "ORANGE_MONEY"]);
  });

  it("parses a single-element literal", () => {
    expect(parsePgEnumArray("{QUATAPAY}")).toEqual(["QUATAPAY"]);
  });

  it("returns [] for an empty literal", () => {
    expect(parsePgEnumArray("{}")).toEqual([]);
  });

  it("passes an already-parsed array through unchanged (copy)", () => {
    const input = ["MTN_MOMO", "QUATAPAY"];
    const out = parsePgEnumArray(input);
    expect(out).toEqual(["MTN_MOMO", "QUATAPAY"]);
    expect(out).not.toBe(input); // defensive copy, not the same reference
  });

  it("returns [] for null / undefined", () => {
    expect(parsePgEnumArray(null)).toEqual([]);
    expect(parsePgEnumArray(undefined)).toEqual([]);
  });

  it("trims incidental whitespace between tokens", () => {
    expect(parsePgEnumArray("{MTN_MOMO, ORANGE_MONEY}")).toEqual(["MTN_MOMO", "ORANGE_MONEY"]);
  });
});
