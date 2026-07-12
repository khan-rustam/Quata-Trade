import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { newId } from "../../common/ids";
import { startTestDb, type TestDb } from "../../../test/helpers/pg";
import { createUser } from "../../../test/helpers/fixtures";
import { LedgerService } from "../ledger/ledger.service";
import { AuditService } from "../../common/audit/audit.service";
import { ScreeningService } from "../screening/screening.service";
import { SettingsService } from "../settings/settings.service";
import { PromoService } from "../promo/promo.service";
import type { DepositsConfig } from "./deposits.config";
import type { TronGridClient, Trc20Transfer } from "./trongrid.client";
import { DepositScannerService } from "./deposit-scanner.service";
import { DepositConfirmationService } from "./deposit-confirmation.service";

/**
 * AUDIT GATE 3 (crypto-critical, Documents/05): fake-token rejection, dust,
 * confirmation threshold, exactly-once credit, replay safety, orphan skip.
 * Real Postgres via Testcontainers; TronGrid faked behind TronGridClient.
 */

const CANONICAL_USDT = "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t";
const FAKE_TOKEN = "TFakeTokenContractzzzzzzzzzzzzzzzzz";

const CONFIG: DepositsConfig = {
  trongridUrl: "http://fake.invalid",
  trongridFallbackUrl: "",
  trongridApiKey: "",
  usdtContract: CANONICAL_USDT,
  minAmount: 1_000_000n, // 1 USDT
  confirmations: 19,
};

class FakeTronGrid implements TronGridClient {
  transfersByAddress = new Map<string, Trc20Transfer[]>();
  height = 0n;
  calls = 0;
  failing = false;

  async getTrc20TransfersTo(address: string): Promise<Trc20Transfer[]> {
    this.calls += 1;
    if (this.failing) throw new Error("simulated RPC outage");
    return this.transfersByAddress.get(address) ?? [];
  }

  async getCurrentBlockNumber(): Promise<bigint> {
    if (this.failing) throw new Error("simulated RPC outage");
    return this.height;
  }

  txStatus = new Map<string, { confirmations: number; success: boolean } | null>();
  async getTransactionStatus(txHash: string): Promise<{ confirmations: number; success: boolean } | null> {
    if (this.failing) throw new Error("simulated RPC outage");
    return this.txStatus.get(txHash) ?? null;
  }

  balances = new Map<string, bigint>();
  async getTrc20Balance(address: string): Promise<bigint> {
    if (this.failing) throw new Error("simulated RPC outage");
    return this.balances.get(address) ?? 0n;
  }
}

describe("deposits pipeline (Gate 3)", () => {
  let t: TestDb;
  let ledger: LedgerService;
  let grid: FakeTronGrid;
  let scanner: DepositScannerService;
  let confirmer: DepositConfirmationService;
  let settings: SettingsService;
  let addressSeq = 0;

  /** Overwrite the deposit_policy settings row and drop the cache (test hook). */
  const setDepositPolicy = async (value: unknown): Promise<void> => {
    await t.db.updateTable("settings").set({ value: JSON.stringify(value) }).where("key", "=", "deposit_policy").execute();
    settings.invalidate();
  };
  const treasuryBalance = async (): Promise<bigint> =>
    ledger.balanceOf(await ledger.getOrCreateAccount(null, "platform_treasury", "USDT_TRC20"));

  const makeTransfer = (to: string, overrides: Partial<Trc20Transfer> = {}): Trc20Transfer => ({
    txHash: `tx-${newId()}`,
    logIndex: 0,
    from: "TSenderAddresszzzzzzzzzzzzzzzzzzzzz",
    to,
    contract: CANONICAL_USDT,
    amount: 5_000_000n,
    blockNumber: 1_000n,
    ...overrides,
  });

  /** user + active deposit address, wired into the fake grid. */
  const watchedAddress = async (): Promise<{ userId: string; address: string }> => {
    const userId = await createUser(t.db);
    addressSeq += 1;
    const address = `TWatch${String(addressSeq).padStart(4, "0")}zzzzzzzzzzzzzzzzzzzzzzzz`;
    await t.db
      .insertInto("deposit_addresses")
      .values({
        id: newId(),
        user_id: userId,
        asset: "USDT_TRC20",
        address,
        derivation_index: addressSeq,
        derivation_path: `m/44'/195'/0'/0/${addressSeq}`,
      })
      .execute();
    return { userId, address };
  };

  const depositRows = (address: string) =>
    t.db.selectFrom("deposits").selectAll().where("address", "=", address).execute();

  const availableBalance = async (userId: string): Promise<bigint> => {
    const accountId = await ledger.getOrCreateAccount(userId, "user_available", "USDT_TRC20");
    return ledger.balanceOf(accountId);
  };

  beforeAll(async () => {
    t = await startTestDb();
    ledger = new LedgerService(t.db);
    grid = new FakeTronGrid();
    scanner = new DepositScannerService(t.db, grid, CONFIG);
    settings = new SettingsService(t.db);
    confirmer = new DepositConfirmationService(t.db, grid, CONFIG, ledger, new AuditService(t.db), new ScreeningService(t.db), settings, new PromoService(settings));
  });

  afterEach(async () => {
    // Restore the seeded permissive policy so unrelated tests aren't fee/hold-gated.
    await setDepositPolicy({ min_amount: "1000000", confirmations: 19 });
  });

  afterAll(async () => {
    await t.stop();
  });

  it("REJECTS transfers from a fake token contract — nothing recorded", async () => {
    const { address } = await watchedAddress();
    grid.transfersByAddress.set(address, [makeTransfer(address, { contract: FAKE_TOKEN })]);

    await scanner.scanOnce();

    expect(await depositRows(address)).toHaveLength(0);
  });

  it("records dust below DEPOSIT_MIN_AMOUNT as IGNORED_DUST and never credits it", async () => {
    const { userId, address } = await watchedAddress();
    grid.transfersByAddress.set(address, [makeTransfer(address, { amount: 999_999n, blockNumber: 10n })]);

    await scanner.scanOnce();
    grid.height = 10_000n; // massively past any threshold
    await confirmer.confirmOnce();

    const rows = await depositRows(address);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.status).toBe("IGNORED_DUST");
    expect(rows[0]?.credited_journal_id).toBeNull();
    expect(await availableBalance(userId)).toBe(0n);
  });

  it("does NOT credit below the confirmation threshold (SEEN → CONFIRMING only)", async () => {
    const { userId, address } = await watchedAddress();
    grid.transfersByAddress.set(address, [makeTransfer(address, { blockNumber: 100_000n })]);

    await scanner.scanOnce();
    grid.height = 100_000n + 18n; // 18 < 19
    await confirmer.confirmOnce();

    const rows = await depositRows(address);
    expect(rows[0]?.status).toBe("CONFIRMING");
    expect(rows[0]?.confirmations).toBe(18);
    expect(rows[0]?.credited_journal_id).toBeNull();
    expect(await availableBalance(userId)).toBe(0n);
  });

  it("credits EXACTLY once at the threshold, in one tx with status + outbox", async () => {
    const { userId, address } = await watchedAddress();
    const transfer = makeTransfer(address, { amount: 7_500_000n, blockNumber: 200_000n });
    grid.transfersByAddress.set(address, [transfer]);

    await scanner.scanOnce();
    grid.height = 200_000n + 19n;
    await confirmer.confirmOnce();

    const rows = await depositRows(address);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.status).toBe("CREDITED");
    expect(rows[0]?.credited_journal_id).not.toBeNull();
    expect(await availableBalance(userId)).toBe(7_500_000n);

    const outbox = await t.db
      .selectFrom("outbox")
      .selectAll()
      .where("event_type", "=", "deposit.credited")
      .execute();
    expect(outbox.some((e) => JSON.stringify(e.payload).includes(transfer.txHash))).toBe(true);

    // run the whole pipeline again — nothing moves twice
    await confirmer.confirmOnce();
    await scanner.scanOnce();
    await confirmer.confirmOnce();
    expect(await availableBalance(userId)).toBe(7_500_000n);

    const journals = await t.db
      .selectFrom("journal_entries")
      .selectAll()
      .where("idempotency_key", "=", `deposit:${transfer.txHash}:${transfer.logIndex}`)
      .execute();
    expect(journals).toHaveLength(1);
  });

  it("HOLDS (never credits) a deposit from a blacklisted sender and raises aml.hit exactly once", async () => {
    const BAD_SENDER = "TBadSenderAMLzzzzzzzzzzzzzzzzzzzzzz";
    await new ScreeningService(t.db).block(
      { asset: "USDT_TRC20", address: BAD_SENDER, category: "sanctions", reason: "tainted source" },
      "admin-aml",
    );
    const { userId, address } = await watchedAddress();
    const transfer = makeTransfer(address, { from: BAD_SENDER, amount: 4_000_000n, blockNumber: 400_000n });
    grid.transfersByAddress.set(address, [transfer]);

    await scanner.scanOnce();
    grid.height = 400_000n + 25n;
    await confirmer.confirmOnce();

    const rows = await depositRows(address);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.aml_hold).toBe(true);
    expect(rows[0]?.status).not.toBe("CREDITED");
    expect(rows[0]?.credited_journal_id).toBeNull();
    expect(await availableBalance(userId)).toBe(0n); // tainted funds never credited

    const amlCount = async () =>
      (await t.db.selectFrom("outbox").selectAll().where("event_type", "=", "aml.hit").execute()).filter((e) =>
        JSON.stringify(e.payload).includes(BAD_SENDER),
      ).length;
    expect(await amlCount()).toBe(1);

    // A held deposit is excluded from the pending scan — no re-credit, no duplicate alert.
    await confirmer.confirmOnce();
    expect(await amlCount()).toBe(1);
    expect(await availableBalance(userId)).toBe(0n);
  });

  it("replay of the same (tx_hash, log_index) never duplicates the row or the credit", async () => {
    const { userId, address } = await watchedAddress();
    const transfer = makeTransfer(address, { blockNumber: 300_000n });
    grid.transfersByAddress.set(address, [transfer, { ...transfer }]); // duplicate in one batch

    await scanner.scanOnce();
    await scanner.scanOnce(); // and replayed across passes
    expect(await depositRows(address)).toHaveLength(1);

    grid.height = 300_000n + 25n;
    await confirmer.confirmOnce();
    await scanner.scanOnce(); // scanner replay AFTER credit must not reset anything
    await confirmer.confirmOnce();

    const rows = await depositRows(address);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.status).toBe("CREDITED");
    expect(await availableBalance(userId)).toBe(5_000_000n);
  });

  it("distinct log_index values in one tx are independent deposits", async () => {
    const { userId, address } = await watchedAddress();
    const txHash = `tx-${newId()}`;
    grid.transfersByAddress.set(address, [
      makeTransfer(address, { txHash, logIndex: 0, amount: 2_000_000n, blockNumber: 400_000n }),
      makeTransfer(address, { txHash, logIndex: 1, amount: 3_000_000n, blockNumber: 400_000n }),
    ]);

    await scanner.scanOnce();
    grid.height = 400_000n + 19n;
    await confirmer.confirmOnce();

    expect(await depositRows(address)).toHaveLength(2);
    expect(await availableBalance(userId)).toBe(5_000_000n);
  });

  it("ORPHANED handling: block_number null is recorded but SKIPPED, then recovers once resolved", async () => {
    const { userId, address } = await watchedAddress();
    const transfer = makeTransfer(address, { blockNumber: null });
    grid.transfersByAddress.set(address, [transfer]);

    await scanner.scanOnce();
    grid.height = 999_999_999n;
    await confirmer.confirmOnce();

    let rows = await depositRows(address);
    expect(rows[0]?.status).toBe("SEEN"); // untouched — depth unknowable
    expect(rows[0]?.credited_journal_id).toBeNull();
    expect(await availableBalance(userId)).toBe(0n);

    // next scan resolves the block number → normal confirmation path resumes
    grid.transfersByAddress.set(address, [{ ...transfer, blockNumber: 500_000n }]);
    await scanner.scanOnce();
    grid.height = 500_000n + 19n;
    await confirmer.confirmOnce();

    rows = await depositRows(address);
    expect(rows[0]?.status).toBe("CREDITED");
    expect(await availableBalance(userId)).toBe(5_000_000n);
  });

  it("charges the platform deposit fee: net to the user, fee to treasury, journal balanced", async () => {
    // min 20 USDT, flat 1 USDT fee. Deposit 100 → user 99, platform 1.
    await setDepositPolicy({ min_amount: "20000000", max_amount: "1000000000000", fee_fixed: "1000000", fee_bps: 0, confirmations: 19 });
    const treasuryBefore = await treasuryBalance();
    const { userId, address } = await watchedAddress();
    const transfer = makeTransfer(address, { amount: 100_000_000n, blockNumber: 300_000n });
    grid.transfersByAddress.set(address, [transfer]);

    await scanner.scanOnce();
    grid.height = 300_000n + 19n;
    await confirmer.confirmOnce();

    const rows = await depositRows(address);
    expect(rows[0]?.status).toBe("CREDITED");
    expect(rows[0]?.fee).toBe(1_000_000n);
    expect(await availableBalance(userId)).toBe(99_000_000n); // net
    expect((await treasuryBalance()) - treasuryBefore).toBe(1_000_000n); // fee revenue

    const outbox = await t.db
      .selectFrom("outbox")
      .selectAll()
      .where("event_type", "=", "deposit.credited")
      .execute();
    const payload = outbox.map((e) => String(e.payload)).find((p) => p.includes(transfer.txHash));
    expect(payload).toContain('"fee":"1000000"');
    expect(payload).toContain('"net":"99000000"');
  });

  it("HOLDS a below-minimum deposit for manual review (never auto-credited)", async () => {
    await setDepositPolicy({ min_amount: "20000000", fee_fixed: "1000000", fee_bps: 0, confirmations: 19 });
    const { userId, address } = await watchedAddress();
    // 10 USDT: above the env dust floor (SEEN), below the 20 USDT policy minimum.
    grid.transfersByAddress.set(address, [makeTransfer(address, { amount: 10_000_000n, blockNumber: 310_000n })]);

    await scanner.scanOnce();
    grid.height = 310_000n + 19n;
    await confirmer.confirmOnce();

    const rows = await depositRows(address);
    expect(rows[0]?.status).not.toBe("CREDITED");
    expect(rows[0]?.policy_hold).toBe(true);
    expect(rows[0]?.policy_reason).toContain("minimum");
    expect(rows[0]?.credited_journal_id).toBeNull();
    expect(await availableBalance(userId)).toBe(0n);
  });

  it("HOLDS an above-maximum deposit for manual review", async () => {
    await setDepositPolicy({ min_amount: "20000000", max_amount: "50000000", fee_fixed: "1000000", fee_bps: 0, confirmations: 19 });
    const { userId, address } = await watchedAddress();
    grid.transfersByAddress.set(address, [makeTransfer(address, { amount: 100_000_000n, blockNumber: 320_000n })]);

    await scanner.scanOnce();
    grid.height = 320_000n + 19n;
    await confirmer.confirmOnce();

    const rows = await depositRows(address);
    expect(rows[0]?.policy_hold).toBe(true);
    expect(rows[0]?.policy_reason).toContain("maximum");
    expect(await availableBalance(userId)).toBe(0n);
  });

  it("RPC failure: pass aborts without throwing; 5 consecutive failures pause the scanner", async () => {
    grid.failing = true;
    await expect(scanner.scanOnce()).resolves.toBeUndefined(); // 1st failure inside scanOnce

    for (let i = 0; i < 4; i += 1) {
      await scanner.tick(); // failures 2..5 → breaker opens
    }
    const callsWhenPaused = grid.calls;
    await scanner.tick(); // paused — must not touch the RPC
    expect(grid.calls).toBe(callsWhenPaused);

    grid.failing = false;
  });
});
