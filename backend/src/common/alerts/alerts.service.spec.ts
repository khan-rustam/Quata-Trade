import { describe, expect, it, vi } from "vitest";
import { ConfigService } from "@nestjs/config";
import type { Env } from "../../config/env";
import { AlertsService } from "./alerts.service";

const make = (webhook = ""): AlertsService =>
  new AlertsService(new ConfigService<Env, true>({ ALERT_WEBHOOK_URL: webhook }));

describe("AlertsService", () => {
  it("delivers security events to the webhook", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("ok"));
    await make("https://hooks.example/x").fromEvent("user.frozen", { userId: "u1", score: 95 });
    expect(fetchMock).toHaveBeenCalledOnce();
    const [, init] = fetchMock.mock.calls[0]!;
    expect(String(init?.body)).toContain("user.frozen");
    fetchMock.mockRestore();
  });

  it("is a no-op for non-security events (no webhook call)", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("ok"));
    await make("https://hooks.example/x").fromEvent("trade.opened", { tradeId: "t1" });
    expect(fetchMock).not.toHaveBeenCalled();
    fetchMock.mockRestore();
  });

  it("does not call the webhook when disabled (empty URL) but still resolves", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch");
    await expect(make("").fromEvent("reconciliation.mismatch", {})).resolves.toBeUndefined();
    expect(fetchMock).not.toHaveBeenCalled();
    fetchMock.mockRestore();
  });

  it("never throws when the webhook fails", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("boom"));
    await expect(make("https://hooks.example/x").fromEvent("ledger.adjustment", {})).resolves.toBeUndefined();
    fetchMock.mockRestore();
  });
});
