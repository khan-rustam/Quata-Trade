import { describe, expect, it } from "vitest";
import { missingSecondFactor } from "./second-factors";

describe("missingSecondFactor — trade-confirm second-factor presence", () => {
  it("requires TOTP when enrolled and omitted", () => {
    expect(missingSecondFactor({ totpEnabled: true, hasPin: false }, {})).toBe("totp");
    expect(missingSecondFactor({ totpEnabled: true, hasPin: false }, { totpCode: "" })).toBe("totp");
  });

  it("requires PIN when set and omitted — the stolen-session bypass this fixes", () => {
    expect(missingSecondFactor({ totpEnabled: false, hasPin: true }, {})).toBe("pin");
    expect(missingSecondFactor({ totpEnabled: false, hasPin: true }, { pin: "" })).toBe("pin");
  });

  it("reports TOTP first when both are enrolled and both omitted", () => {
    expect(missingSecondFactor({ totpEnabled: true, hasPin: true }, {})).toBe("totp");
    expect(missingSecondFactor({ totpEnabled: true, hasPin: true }, { totpCode: "123456" })).toBe("pin");
  });

  it("passes when every enrolled factor is present", () => {
    expect(missingSecondFactor({ totpEnabled: true, hasPin: true }, { totpCode: "123456", pin: "1234" })).toBeNull();
    expect(missingSecondFactor({ totpEnabled: false, hasPin: true }, { pin: "1234" })).toBeNull();
    expect(missingSecondFactor({ totpEnabled: true, hasPin: false }, { totpCode: "123456" })).toBeNull();
  });

  it("requires nothing when the user enrolled no factors", () => {
    expect(missingSecondFactor({ totpEnabled: false, hasPin: false }, {})).toBeNull();
  });
});
