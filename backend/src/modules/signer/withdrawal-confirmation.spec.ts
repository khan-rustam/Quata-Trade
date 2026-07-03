import { describe, expect, it, vi } from "vitest";
import { WithdrawalConfirmationService } from "./withdrawal-confirmation.service";
import type { WithdrawalsService } from "../withdrawals/withdrawals.service";
import type { TronGridClient } from "../deposits/trongrid.client";
import type { DepositsConfig } from "../deposits/deposits.config";
import type { SignerClient } from "./signer.types";

const CFG = { confirmations: 19 } as unknown as DepositsConfig;

interface Overrides {
  status?: { confirmations: number; success: boolean } | null;
  settled?: boolean;
  broadcast?: { id: string; txHash: string; broadcastAt: Date }[];
  mode?: "mock" | "remote";
}

function make(o: Overrides) {
  const settleConfirmed = vi.fn(async () => o.settled ?? true);
  const listBroadcast = vi.fn(async () => o.broadcast ?? []);
  const withdrawals = { settleConfirmed, listBroadcast } as unknown as WithdrawalsService;
  const getTransactionStatus = vi.fn(async () => o.status ?? null);
  const tron = { getTransactionStatus } as unknown as TronGridClient;
  const signer = { mode: o.mode ?? "remote" } as unknown as SignerClient;
  const svc = new WithdrawalConfirmationService(withdrawals, tron, CFG, signer);
  return { svc, settleConfirmed, listBroadcast, getTransactionStatus };
}

describe("WithdrawalConfirmationService (item 5 — remote confirmation)", () => {
  it("settles once a SUCCESSFUL broadcast tx reaches the finality threshold", async () => {
    const { svc, settleConfirmed } = make({ status: { confirmations: 19, success: true }, settled: true });
    expect(await svc.confirmOne("w1", "tx1")).toBe("settled");
    expect(settleConfirmed).toHaveBeenCalledWith("w1");
  });

  it("does NOT settle below the confirmation threshold", async () => {
    const { svc, settleConfirmed } = make({ status: { confirmations: 18, success: true } });
    expect(await svc.confirmOne("w1", "tx1")).toBe("pending");
    expect(settleConfirmed).not.toHaveBeenCalled();
  });

  it("NEVER settles a mined-but-reverted tx even past finality — funds stayed in custody", async () => {
    const { svc, settleConfirmed } = make({ status: { confirmations: 50, success: false }, settled: true });
    expect(await svc.confirmOne("w1", "tx1")).toBe("reverted");
    expect(settleConfirmed).not.toHaveBeenCalled();
  });

  it("treats an unresolved tx (not mined / result unknown) as retry-later — never settles", async () => {
    const { svc, settleConfirmed } = make({ status: null });
    expect(await svc.confirmOne("w1", "tx1")).toBe("unresolved");
    expect(settleConfirmed).not.toHaveBeenCalled();
  });

  it("reports pending when settle is a no-op (already settled / lost the race)", async () => {
    const { svc } = make({ status: { confirmations: 30, success: true }, settled: false });
    expect(await svc.confirmOne("w1", "tx1")).toBe("pending");
  });

  it("run() is a deliberate no-op in mock mode (mock settles inline)", async () => {
    const { svc, listBroadcast } = make({ mode: "mock" });
    await svc.run();
    expect(listBroadcast).not.toHaveBeenCalled();
  });

  it("run() polls each broadcast withdrawal and settles the confirmed ones", async () => {
    const { svc, settleConfirmed } = make({
      mode: "remote",
      status: { confirmations: 25, success: true },
      settled: true,
      broadcast: [
        { id: "w1", txHash: "t1", broadcastAt: new Date(0) },
        { id: "w2", txHash: "t2", broadcastAt: new Date(0) },
      ],
    });
    await svc.run();
    expect(settleConfirmed).toHaveBeenCalledTimes(2);
  });
});
