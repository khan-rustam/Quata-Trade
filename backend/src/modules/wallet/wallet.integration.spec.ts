import { afterAll, beforeAll, describe, expect, it } from "vitest";
import * as bip39 from "bip39";
import * as ecc from "@bitcoinerlab/secp256k1";
import { BIP32Factory } from "bip32";
import { TronWeb } from "tronweb";
import { newId } from "../../common/ids";
import { startTestDb, type TestDb } from "../../../test/helpers/pg";
import { createUser } from "../../../test/helpers/fixtures";
import { LedgerService } from "../ledger/ledger.service";
import { InsufficientFundsError } from "../ledger/ledger.errors";
import { TRON_ACCOUNT_PATH } from "./derivation";
import { WalletService } from "./wallet.service";
import { PinVerificationError, TransferFailedError } from "./wallet.errors";
import type { PinVerifier } from "./wallet.tokens";

describe("WalletService (Gate 3 — watch-only wallet)", () => {
  let t: TestDb;
  let ledger: LedgerService;
  let xpub: string;
  let externalId: string;

  const okPin: PinVerifier = { verifyPin: async () => undefined };
  const badPin: PinVerifier = {
    verifyPin: async () => {
      throw new Error("wrong PIN");
    },
  };

  const service = (pin: PinVerifier = okPin) => new WalletService(t.db, ledger, xpub, pin);

  const fund = async (userId: string, amount: bigint): Promise<void> => {
    const accountId = await ledger.getOrCreateAccount(userId, "user_available", "USDT_TRC20");
    await ledger.postJournal({
      reason: "deposit_credit",
      referenceType: "test",
      referenceId: newId(),
      idempotencyKey: `fund-${newId()}`,
      createdBy: "system",
      asset: "USDT_TRC20",
      legs: [
        { accountId: externalId, amount: -amount },
        { accountId, amount },
      ],
    });
  };

  const userEmail = async (userId: string): Promise<string> => {
    const row = await t.db
      .selectFrom("users")
      .select("email")
      .where("id", "=", userId)
      .executeTakeFirstOrThrow();
    return row.email;
  };

  beforeAll(async () => {
    t = await startTestDb();
    ledger = new LedgerService(t.db);
    externalId = await ledger.getOrCreateAccount(null, "external", "USDT_TRC20");
    const seed = bip39.mnemonicToSeedSync(bip39.generateMnemonic());
    xpub = BIP32Factory(ecc).fromSeed(seed).derivePath(TRON_ACCOUNT_PATH).neutered().toBase58();
  });

  afterAll(async () => {
    await t.stop();
  });

  it("creates a valid deposit address at index 0 and returns the SAME row afterwards", async () => {
    const userId = await createUser(t.db);
    const first = await service().getOrCreateDepositAddress(userId, "USDT_TRC20");

    expect(first.derivation_index).toBe(0);
    expect(first.derivation_path).toBe(`${TRON_ACCOUNT_PATH}/0/0`);
    expect(TronWeb.isAddress(first.address)).toBe(true);

    const second = await service().getOrCreateDepositAddress(userId, "USDT_TRC20");
    expect(second.id).toBe(first.id);
    expect(second.address).toBe(first.address);
  });

  it("concurrent first requests mint unique sequential indexes — never a duplicate", async () => {
    const users = await Promise.all(Array.from({ length: 5 }, () => createUser(t.db)));
    const rows = await Promise.all(users.map((u) => service().getOrCreateDepositAddress(u, "USDT_TRC20")));

    const indexes = rows.map((r) => r.derivation_index).sort((a, b) => a - b);
    expect(new Set(rows.map((r) => r.address)).size).toBe(5);
    expect(indexes).toEqual([1, 2, 3, 4, 5]); // index 0 was taken by the previous test
  });

  it("balances are ledger-derived (available + escrow)", async () => {
    const userId = await createUser(t.db);
    await fund(userId, 3_000_000n);
    const balances = await service().getBalances(userId);
    expect(balances).toEqual([{ asset: "USDT_TRC20", available: 3_000_000n, inEscrow: 0n }]);
  });

  /**
   * A hold keeps the deposit at SEEN/CONFIRMING (holds are flags, not a status),
   * so the "pending" figure has to distinguish "still confirming" from "an admin
   * already refused this". Without the exclusion a REJECTED deposit sat in the
   * user's pending balance forever — money the platform had decided never arrives.
   */
  it("pending EXCLUDES a compliance-rejected deposit but keeps one still under review", async () => {
    const userId = await createUser(t.db);
    const addr = await service().getOrCreateDepositAddress(userId, "USDT_TRC20");

    const seed = async (txHash: string, amount: bigint, hold: Partial<{ aml_hold: boolean; hold_resolution: "RELEASED" | "REJECTED" }>) => {
      await t.db
        .insertInto("deposits")
        .values({
          id: newId(),
          user_id: userId,
          asset: "USDT_TRC20",
          address: addr.address,
          tx_hash: txHash,
          log_index: 0,
          amount,
          token_contract: "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t",
          status: "CONFIRMING",
          ...hold,
        })
        .execute();
    };

    await seed("tx-plain", 1_000_000n, {});
    await seed("tx-held", 2_000_000n, { aml_hold: true });
    await seed("tx-refused", 4_000_000n, { aml_hold: true, hold_resolution: "REJECTED" });

    const [bal] = await service().getBalances(userId);
    // 1 (confirming) + 2 (under review) — the 4 an admin refused must not appear.
    expect(bal?.pending).toBe(3_000_000n);
  });

  it("internal transfer moves available → available; replaying the key applies once", async () => {
    const sender = await createUser(t.db);
    const recipient = await createUser(t.db);
    await fund(sender, 10_000_000n);
    const dto = {
      toEmail: await userEmail(recipient),
      asset: "USDT_TRC20" as const,
      amount: "4000000",
      pin: "123456",
      idempotencyKey: `transfer-${newId()}`,
    };

    const first = await service().internalTransfer(sender, dto);
    const replay = await service().internalTransfer(sender, dto);

    expect(first.replayed).toBe(false);
    expect(replay.replayed).toBe(true);
    expect(replay.journalId).toBe(first.journalId);

    const [senderBal] = await service().getBalances(sender);
    const [recipientBal] = await service().getBalances(recipient);
    expect(senderBal?.available).toBe(6_000_000n);
    expect(recipientBal?.available).toBe(4_000_000n);
  });

  it("unknown recipient and self-transfer fail with the SAME generic error (no enumeration)", async () => {
    const sender = await createUser(t.db);
    await fund(sender, 2_000_000n);
    const base = { asset: "USDT_TRC20" as const, amount: "1000000", pin: "123456" };

    await expect(
      service().internalTransfer(sender, { ...base, toEmail: "nobody@test.local", idempotencyKey: `t-${newId()}` }),
    ).rejects.toBeInstanceOf(TransferFailedError);
    await expect(
      service().internalTransfer(sender, {
        ...base,
        toEmail: await userEmail(sender),
        idempotencyKey: `t-${newId()}`,
      }),
    ).rejects.toBeInstanceOf(TransferFailedError);

    const [senderBal] = await service().getBalances(sender);
    expect(senderBal?.available).toBe(2_000_000n); // nothing moved
  });

  it("PIN failure blocks the transfer before any money path runs", async () => {
    const sender = await createUser(t.db);
    const recipient = await createUser(t.db);
    await fund(sender, 2_000_000n);

    await expect(
      service(badPin).internalTransfer(sender, {
        toEmail: await userEmail(recipient),
        asset: "USDT_TRC20",
        amount: "1000000",
        pin: "000000",
        idempotencyKey: `t-${newId()}`,
      }),
    ).rejects.toBeInstanceOf(PinVerificationError);

    const [senderBal] = await service().getBalances(sender);
    expect(senderBal?.available).toBe(2_000_000n);
  });

  it("cannot transfer more than available (ledger overdraw guard)", async () => {
    const sender = await createUser(t.db);
    const recipient = await createUser(t.db);
    await fund(sender, 1_000_000n);

    await expect(
      service().internalTransfer(sender, {
        toEmail: await userEmail(recipient),
        asset: "USDT_TRC20",
        amount: "1000001",
        pin: "123456",
        idempotencyKey: `t-${newId()}`,
      }),
    ).rejects.toBeInstanceOf(InsufficientFundsError);
  });

  it("one sender's idempotency key can never replay another sender's journal", async () => {
    const alice = await createUser(t.db);
    const bob = await createUser(t.db);
    const carol = await createUser(t.db);
    await fund(alice, 5_000_000n);
    await fund(bob, 5_000_000n);
    const sharedKey = `shared-${newId()}`;
    const carolEmail = await userEmail(carol);

    await service().internalTransfer(alice, {
      toEmail: carolEmail,
      asset: "USDT_TRC20",
      amount: "1000000",
      pin: "123456",
      idempotencyKey: sharedKey,
    });
    const bobResult = await service().internalTransfer(bob, {
      toEmail: carolEmail,
      asset: "USDT_TRC20",
      amount: "1000000",
      pin: "123456",
      idempotencyKey: sharedKey,
    });

    expect(bobResult.replayed).toBe(false); // namespaced key → bob's transfer really ran
    const [carolBal] = await service().getBalances(carol);
    expect(carolBal?.available).toBe(2_000_000n);
  });

  it("frozen sender is blocked from transferring", async () => {
    const sender = await createUser(t.db);
    const recipient = await createUser(t.db);
    await fund(sender, 2_000_000n);
    await t.db.updateTable("users").set({ status: "frozen", updated_at: new Date() }).where("id", "=", sender).execute();

    await expect(
      service().internalTransfer(sender, {
        toEmail: await userEmail(recipient),
        asset: "USDT_TRC20",
        amount: "1000000",
        pin: "123456",
        idempotencyKey: `t-${newId()}`,
      }),
    ).rejects.toThrow("account is restricted");
  });
});
