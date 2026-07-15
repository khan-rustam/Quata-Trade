import { describe, expect, it } from "vitest";
import { authenticator } from "otplib";
import { matchedTotpStep } from "./totp-step";

describe("matchedTotpStep — TOTP single-use step", () => {
  const secret = authenticator.generateSecret();

  it("returns the current absolute step for a valid code", () => {
    const code = authenticator.generate(secret);
    const step = matchedTotpStep(code, secret);
    expect(step).not.toBeNull();
    expect(step).toBe(Math.floor(Date.now() / 1000 / 30));
  });

  it("returns null for an invalid code", () => {
    expect(matchedTotpStep("000000", secret === "000000" ? "XXXX" : secret)).toBeNull();
    expect(matchedTotpStep("not-a-code", secret)).toBeNull();
  });

  it("the same valid code always maps to the same step (so a replay is detectable)", () => {
    const code = authenticator.generate(secret);
    expect(matchedTotpStep(code, secret)).toBe(matchedTotpStep(code, secret));
  });
});
