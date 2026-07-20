import { describe, expect, it } from "vitest";
import { decideUpdate, DEFAULT_MIN_SUPPORTED, type ReleaseFacts } from "./updates.rules";

const release = (over: Partial<ReleaseFacts> = {}): ReleaseFacts => ({
  versionCode: 10,
  updateType: "optional",
  minSupportedCode: 5,
  ...over,
});

describe("decideUpdate", () => {
  it("does nothing when no release is published", () => {
    expect(decideUpdate(null, 1)).toEqual({
      updateAvailable: false,
      supported: true,
      mustUpdate: false,
      updateType: null,
      minSupportedCode: DEFAULT_MIN_SUPPORTED,
    });
  });

  it("reports no update when the client is on the latest code", () => {
    const d = decideUpdate(release(), 10);
    expect(d.updateAvailable).toBe(false);
    expect(d.updateType).toBeNull();
    expect(d.mustUpdate).toBe(false);
    expect(d.supported).toBe(true);
  });

  it("reports no update when the client is somehow ahead (pre-release build)", () => {
    const d = decideUpdate(release(), 11);
    expect(d.updateAvailable).toBe(false);
    expect(d.mustUpdate).toBe(false);
  });

  it("offers an OPTIONAL update without forcing it", () => {
    const d = decideUpdate(release({ updateType: "optional" }), 8);
    expect(d.updateAvailable).toBe(true);
    expect(d.updateType).toBe("optional");
    expect(d.mustUpdate).toBe(false);
    expect(d.supported).toBe(true);
  });

  it("forces a MANDATORY update even when the build is still supported", () => {
    const d = decideUpdate(release({ updateType: "mandatory" }), 8);
    expect(d.updateAvailable).toBe(true);
    expect(d.mustUpdate).toBe(true);
    expect(d.supported).toBe(true); // supported, but must update
  });

  it("forces a SECURITY update", () => {
    const d = decideUpdate(release({ updateType: "security" }), 8);
    expect(d.mustUpdate).toBe(true);
    expect(d.updateType).toBe("security");
  });

  it("blocks a build below minSupportedCode even for an optional release", () => {
    const d = decideUpdate(release({ updateType: "optional", minSupportedCode: 9 }), 8);
    expect(d.supported).toBe(false);
    expect(d.mustUpdate).toBe(true);
  });

  it("treats exactly minSupportedCode as supported (boundary)", () => {
    const d = decideUpdate(release({ minSupportedCode: 8 }), 8);
    expect(d.supported).toBe(true);
    expect(d.mustUpdate).toBe(false);
  });

  it("does not force when already on the latest, even if that release was mandatory", () => {
    const d = decideUpdate(release({ updateType: "mandatory" }), 10);
    expect(d.updateAvailable).toBe(false);
    expect(d.mustUpdate).toBe(false);
  });

  it("passes the release's minSupportedCode through", () => {
    expect(decideUpdate(release({ minSupportedCode: 7 }), 9).minSupportedCode).toBe(7);
  });
});
