import { sql } from "kysely";
import { ConfigService } from "@nestjs/config";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { newId } from "../../common/ids";
import { startTestDb, type TestDb } from "../../../test/helpers/pg";
import { createUser } from "../../../test/helpers/fixtures";
import type { Env } from "../../config/env";
import { LedgerService } from "../ledger/ledger.service";
import { SettingsService } from "../settings/settings.service";
import { MinioService } from "../../common/storage/minio.service";
import { EscrowService } from "./escrow.service";
import { TradesService } from "../trades/trades.service";
import { IllegalTransitionError, OfferUnavailableError, TradeNotFoundError } from "./escrow.errors";

/** TradesService needs a MinioService for proof upload (unused in these escrow flows). */
const testMinio = new MinioService(
  new ConfigService<Env, true>({
    MINIO_ENDPOINT: "localhost",
    MINIO_PORT: 9000,
    MINIO_USE_SSL: false,
    MINIO_ACCESS_KEY: "test",
    MINIO_SECRET_KEY: "test",
    STORAGE_SSE_ENABLED: false,
  }),
);

/**
 * AUDIT GATE 4 — escrow/trade state machine (Documents/05, 08 §B/§C, 09).
 */
describe("Escrow state machine (Gate 4)", () => {
  let t: TestDb;
  let ledger: LedgerService;
  let escrow: EscrowService;
  let trades: TradesService;
  let externalId: string;

  const USDT = 1_000_000n;

  const fundedUser = async (amount: bigint): Promise<string> => {
    const userId = await createUser(t.db);
    await t.db.updateTable("users").set({ kyc_tier: 3 }).where("id", "=", userId).execute();
    if (amount > 0n) {
      const acc = await ledger.getOrCreateAccount(userId, "user_available", "USDT_TRC20");
      await ledger.postJournal({
        reason: "deposit_credit",
        referenceType: "test",
        referenceId: newId(),
        idempotencyKey: `fund-${newId()}`,
        createdBy: "system",
        asset: "USDT_TRC20",
        legs: [
          { accountId: externalId, amount: -amount },
          { accountId: acc, amount },
        ],
      });
    }
    return userId;
  };

  const createOffer = async (sellerId: string, remaining: bigint, minTrade = 1n * USDT, maxTrade = remaining) => {
    return t.db
      .insertInto("offers")
      .values({
        id: newId(),
        user_id: sellerId,
        side: "SELL",
        asset: "USDT_TRC20",
        price_xaf_per_unit: 650n,
        min_trade: minTrade,
        max_trade: maxTrade,
        remaining,
        payment_methods: ["MTN_MOMO", "QUATAPAY"],
        terms: null,
      })
      .returningAll()
      .executeTakeFirstOrThrow();
  };

  const balanceOf = async (userId: string, kind: "user_available" | "user_escrow") =>
    ledger.balanceOf(await ledger.getOrCreateAccount(userId, kind, "USDT_TRC20"));

  const treasuryBalance = async () =>
    ledger.balanceOf(await ledger.getOrCreateAccount(null, "platform_treasury", "USDT_TRC20"));

  const openTrade = (buyerId: string, offerId: string, amount: bigint) =>
    trades.openTrade(buyerId, {
      offerId,
      amount: amount.toString(),
      paymentMethod: "MTN_MOMO",
      idempotencyKey: `open-${newId()}`,
    });

  const submitPayment = (tradeId: string, buyerId: string) =>
    trades.submitPayment(tradeId, buyerId, {
      reference: "MOMO-REF-123",
      senderName: "Test Buyer",
      senderNumber: "+237600000000",
      proofFiles: [],
    });

  const disputeTrade = (tradeId: string, userId: string) =>
    ledger.withMoneyTransaction(async (trx) => {
      const trade = await escrow.lockTrade(trx, tradeId);
      await escrow.markDisputed(trx, trade, userId);
    });

  beforeAll(async () => {
    t = await startTestDb();
    ledger = new LedgerService(t.db);
    escrow = new EscrowService(t.db, ledger);
    trades = new TradesService(t.db, ledger, escrow, new SettingsService(t.db), testMinio);
    externalId = await ledger.getOrCreateAccount(null, "external", "USDT_TRC20");
  });

  afterAll(async () => {
    await t.stop();
  });

  it("happy path: open → lock → pay → confirm; buyer_credit + fee === escrow amount, exactly", async () => {
    const seller = await fundedUser(100n * USDT);
    const buyer = await fundedUser(0n);
    const offer = await createOffer(seller, 100n * USDT);
    const treasuryBefore = await treasuryBalance();

    const trade = await openTrade(buyer, offer.id, 50n * USDT);
    expect(trade.status).toBe("ESCROW_LOCKED");
    expect(trade.fee_bps).toBe(50); // MTN MoMo 0.5%
    expect(trade.fee_amount).toBe(250_000n); // 0.25 USDT of 50
    expect(trade.fiat_amount_xaf).toBe(32_500n); // 50 × 650

    expect(await balanceOf(seller, "user_available")).toBe(50n * USDT);
    expect(await balanceOf(seller, "user_escrow")).toBe(50n * USDT);
    const offerAfter = await t.db.selectFrom("offers").selectAll().where("id", "=", offer.id).executeTakeFirstOrThrow();
    expect(offerAfter.remaining).toBe(50n * USDT);

    await submitPayment(trade.id, buyer);
    const confirmed = await trades.confirmTrade(trade.id, seller, `confirm-${trade.id}`);
    expect(confirmed.status).toBe("COMPLETED");

    const buyerCredit = await balanceOf(buyer, "user_available");
    const treasuryGain = (await treasuryBalance()) - treasuryBefore;
    expect(buyerCredit + treasuryGain).toBe(50n * USDT); // golden invariant
    expect(buyerCredit).toBe(50n * USDT - 250_000n);
    expect(treasuryGain).toBe(250_000n);
    expect(await balanceOf(seller, "user_escrow")).toBe(0n);

    // every transition wrote trade_events in the same tx
    const events = await trades.getEvents(trade.id);
    expect(events.map((e) => e.to_status)).toEqual(["OPENED", "ESCROW_LOCKED", "PAYMENT_SUBMITTED", "COMPLETED"]);
  });

  it("double seller-confirm is idempotent — funds move exactly once", async () => {
    const seller = await fundedUser(10n * USDT);
    const buyer = await fundedUser(0n);
    const offer = await createOffer(seller, 10n * USDT);
    const trade = await openTrade(buyer, offer.id, 10n * USDT);
    await submitPayment(trade.id, buyer);

    const key = `confirm-${trade.id}`;
    await trades.confirmTrade(trade.id, seller, key);
    const buyerAfterFirst = await balanceOf(buyer, "user_available");

    const second = await trades.confirmTrade(trade.id, seller, key);
    expect(second.status).toBe("COMPLETED");
    expect(await balanceOf(buyer, "user_available")).toBe(buyerAfterFirst);

    // and concurrent double-click:
    const third = trades.confirmTrade(trade.id, seller, key);
    const fourth = trades.confirmTrade(trade.id, seller, key);
    await Promise.all([third, fourth]);
    expect(await balanceOf(buyer, "user_available")).toBe(buyerAfterFirst);
  });

  it("DB trigger rejects illegal transitions even via raw SQL", async () => {
    const seller = await fundedUser(5n * USDT);
    const buyer = await fundedUser(0n);
    const offer = await createOffer(seller, 5n * USDT);
    const trade = await openTrade(buyer, offer.id, 5n * USDT);

    await expect(
      sql`UPDATE trades SET status = 'COMPLETED' WHERE id = ${trade.id}`.execute(t.db),
    ).rejects.toThrow(/illegal trade transition/);
    await expect(
      sql`UPDATE trades SET status = 'RESOLVED_RELEASE' WHERE id = ${trade.id}`.execute(t.db),
    ).rejects.toThrow(/illegal trade transition/);
  });

  it("confirm before payment submitted is rejected", async () => {
    const seller = await fundedUser(5n * USDT);
    const buyer = await fundedUser(0n);
    const offer = await createOffer(seller, 5n * USDT);
    const trade = await openTrade(buyer, offer.id, 5n * USDT);

    await expect(trades.confirmTrade(trade.id, seller, `c-${newId()}`)).rejects.toBeInstanceOf(
      IllegalTransitionError,
    );
  });

  it("timeout expiry refunds seller exactly once and restocks the offer", async () => {
    const seller = await fundedUser(20n * USDT);
    const buyer = await fundedUser(0n);
    const offer = await createOffer(seller, 20n * USDT);
    const trade = await openTrade(buyer, offer.id, 20n * USDT);

    await t.db
      .updateTable("trades")
      .set({ payment_deadline: new Date(Date.now() - 60_000) })
      .where("id", "=", trade.id)
      .execute();

    expect(await escrow.expireTrade(trade.id)).toBe(true);
    expect(await escrow.expireTrade(trade.id)).toBe(false); // once only
    expect(await balanceOf(seller, "user_available")).toBe(20n * USDT);
    expect(await balanceOf(seller, "user_escrow")).toBe(0n);
    const offerAfter = await t.db.selectFrom("offers").selectAll().where("id", "=", offer.id).executeTakeFirstOrThrow();
    expect(offerAfter.remaining).toBe(20n * USDT); // restocked
  });

  it("RACE: payment-submit vs expiry resolves to exactly one outcome", async () => {
    const seller = await fundedUser(10n * USDT);
    const buyer = await fundedUser(0n);
    const offer = await createOffer(seller, 10n * USDT);
    const trade = await openTrade(buyer, offer.id, 10n * USDT);
    await t.db
      .updateTable("trades")
      .set({ payment_deadline: new Date(Date.now() - 1_000) })
      .where("id", "=", trade.id)
      .execute();

    const [submitResult, expireResult] = await Promise.allSettled([
      submitPayment(trade.id, buyer),
      escrow.expireTrade(trade.id),
    ]);

    const finalTrade = await t.db.selectFrom("trades").selectAll().where("id", "=", trade.id).executeTakeFirstOrThrow();
    if (finalTrade.status === "EXPIRED") {
      expect(submitResult.status).toBe("rejected"); // buyer lost the race
      expect(await balanceOf(seller, "user_available")).toBe(10n * USDT);
    } else {
      expect(finalTrade.status).toBe("PAYMENT_SUBMITTED");
      expect(expireResult.status === "fulfilled" && expireResult.value === false).toBe(true);
      expect(await balanceOf(seller, "user_escrow")).toBe(10n * USDT);
    }
  });

  it("DISPUTED freezes funds: no confirm, no cancel, no expiry — only admin resolution", async () => {
    const seller = await fundedUser(10n * USDT);
    const buyer = await fundedUser(0n);
    const offer = await createOffer(seller, 10n * USDT);
    const trade = await openTrade(buyer, offer.id, 10n * USDT);
    await submitPayment(trade.id, buyer);
    await disputeTrade(trade.id, buyer);

    await expect(trades.confirmTrade(trade.id, seller, `c-${newId()}`)).rejects.toBeInstanceOf(IllegalTransitionError);
    await expect(trades.cancelTrade(trade.id, buyer, `x-${newId()}`)).rejects.toBeInstanceOf(IllegalTransitionError);
    await t.db
      .updateTable("trades")
      .set({ payment_deadline: new Date(Date.now() - 1_000) })
      .where("id", "=", trade.id)
      .execute();
    expect(await escrow.expireTrade(trade.id)).toBe(false);
    expect(await balanceOf(seller, "user_escrow")).toBe(10n * USDT); // untouched

    // admin resolution RELEASE_TO_BUYER moves funds correctly
    const treasuryBefore = await treasuryBalance();
    const resolved = await escrow.resolveDispute(trade.id, newId(), "RELEASE_TO_BUYER");
    expect(resolved.status).toBe("RESOLVED_RELEASE");
    const buyerCredit = await balanceOf(buyer, "user_available");
    expect(buyerCredit + ((await treasuryBalance()) - treasuryBefore)).toBe(10n * USDT);
    expect(await balanceOf(seller, "user_escrow")).toBe(0n);
  });

  it("resolveDispute on a non-DISPUTED trade is rejected; same-outcome re-resolve is idempotent", async () => {
    const seller = await fundedUser(10n * USDT);
    const buyer = await fundedUser(0n);
    const offer = await createOffer(seller, 10n * USDT);
    const trade = await openTrade(buyer, offer.id, 10n * USDT); // ESCROW_LOCKED, not disputed

    await expect(escrow.resolveDispute(trade.id, newId(), "RELEASE_TO_BUYER")).rejects.toBeInstanceOf(
      IllegalTransitionError,
    );

    // dispute it, resolve, then a same-outcome re-resolve must no-op (not double-pay)
    await disputeTrade(trade.id, buyer);
    await escrow.resolveDispute(trade.id, newId(), "RELEASE_TO_BUYER");
    const buyerAfter = await balanceOf(buyer, "user_available");
    const again = await escrow.resolveDispute(trade.id, newId(), "RELEASE_TO_BUYER");
    expect(again.status).toBe("RESOLVED_RELEASE");
    expect(await balanceOf(buyer, "user_available")).toBe(buyerAfter);
    // a conflicting re-resolve (opposite outcome) is rejected by the FSM
    await expect(escrow.resolveDispute(trade.id, newId(), "REFUND_TO_SELLER")).rejects.toBeInstanceOf(
      IllegalTransitionError,
    );
  });

  it("dispute resolution REFUND_TO_SELLER returns funds + restocks", async () => {
    const seller = await fundedUser(10n * USDT);
    const buyer = await fundedUser(0n);
    const offer = await createOffer(seller, 10n * USDT);
    const trade = await openTrade(buyer, offer.id, 10n * USDT);
    await disputeTrade(trade.id, seller);

    const resolved = await escrow.resolveDispute(trade.id, newId(), "REFUND_TO_SELLER");
    expect(resolved.status).toBe("RESOLVED_REFUND");
    expect(await balanceOf(seller, "user_available")).toBe(10n * USDT);
    expect(await balanceOf(buyer, "user_available")).toBe(0n);
  });

  it("CONCURRENCY: ten parallel 20-USDT trades on a 100-USDT offer → exactly 5 succeed", async () => {
    const seller = await fundedUser(200n * USDT);
    const offer = await createOffer(seller, 100n * USDT, 1n * USDT, 100n * USDT);
    const buyers = await Promise.all(Array.from({ length: 10 }, () => fundedUser(0n)));

    const results = await Promise.all(
      buyers.map((buyerId) =>
        openTrade(buyerId, offer.id, 20n * USDT)
          .then(() => "ok" as const)
          .catch((err: unknown) => {
            if (err instanceof OfferUnavailableError) return "unavailable" as const;
            throw err;
          }),
      ),
    );

    expect(results.filter((r) => r === "ok")).toHaveLength(5);
    const offerAfter = await t.db.selectFrom("offers").selectAll().where("id", "=", offer.id).executeTakeFirstOrThrow();
    expect(offerAfter.remaining).toBe(0n);
    expect(offerAfter.status).toBe("EXHAUSTED");
    expect(await balanceOf(seller, "user_escrow")).toBe(100n * USDT); // never oversold
    expect(await balanceOf(seller, "user_available")).toBe(100n * USDT);
  });

  it("SECURITY: two trades reusing one client idempotencyKey both lock real escrow (no cross-trade collision)", async () => {
    // Regression for the escrow idempotency-scoping finding: a buyer opening two
    // trades on the same offer with ONE reused client key must not let trade 2's
    // escrow lock silently replay trade 1's journal (which oversold the offer and
    // left an unbacked escrow). Keys are now scoped by trade id.
    const seller = await fundedUser(100n * USDT);
    const buyer = await fundedUser(0n);
    const offer = await createOffer(seller, 100n * USDT, 1n * USDT, 100n * USDT);
    const sharedKey = "reused-client-key-0001";

    const t1 = await trades.openTrade(buyer, {
      offerId: offer.id,
      amount: (30n * USDT).toString(),
      paymentMethod: "MTN_MOMO",
      idempotencyKey: sharedKey,
    });
    const t2 = await trades.openTrade(buyer, {
      offerId: offer.id,
      amount: (40n * USDT).toString(),
      paymentMethod: "MTN_MOMO",
      idempotencyKey: sharedKey, // same key — must still lock its own escrow
    });

    expect(t1.status).toBe("ESCROW_LOCKED");
    expect(t2.status).toBe("ESCROW_LOCKED");
    // Both escrows are real: 30 + 40 = 70 locked, 30 available, offer down to 30.
    expect(await balanceOf(seller, "user_escrow")).toBe(70n * USDT);
    expect(await balanceOf(seller, "user_available")).toBe(30n * USDT);
    const offerAfter = await t.db.selectFrom("offers").selectAll().where("id", "=", offer.id).executeTakeFirstOrThrow();
    expect(offerAfter.remaining).toBe(30n * USDT);

    // Each releases independently — the shared client key never collides.
    await submitPayment(t1.id, buyer);
    await trades.confirmTrade(t1.id, seller, sharedKey);
    await submitPayment(t2.id, buyer);
    await trades.confirmTrade(t2.id, seller, sharedKey);
    expect(await balanceOf(seller, "user_escrow")).toBe(0n);
    expect(await balanceOf(buyer, "user_available")).toBe(70n * USDT - 350_000n); // 0.5% of 70
  });

  it("SECURITY: confirm/cancel on a terminal trade by a non-party is 404, never a data leak", async () => {
    const seller = await fundedUser(10n * USDT);
    const buyer = await fundedUser(0n);
    const stranger = await fundedUser(0n);
    const offer = await createOffer(seller, 10n * USDT);
    const trade = await openTrade(buyer, offer.id, 10n * USDT);
    await submitPayment(trade.id, buyer);
    await trades.confirmTrade(trade.id, seller, `k-${newId()}`); // now COMPLETED

    // A stranger probing the terminal trade must get 404 (party check runs first),
    // not the completed trade row.
    await expect(trades.confirmTrade(trade.id, stranger, `k-${newId()}`)).rejects.toBeInstanceOf(TradeNotFoundError);
    await expect(trades.cancelTrade(trade.id, stranger, `k-${newId()}`)).rejects.toBeInstanceOf(TradeNotFoundError);
  });

  it("buyer cancel refunds seller and restocks; only the buyer may cancel", async () => {
    const seller = await fundedUser(10n * USDT);
    const buyer = await fundedUser(0n);
    const offer = await createOffer(seller, 10n * USDT);
    const trade = await openTrade(buyer, offer.id, 10n * USDT);

    await expect(trades.cancelTrade(trade.id, seller, `s-${newId()}`)).rejects.toThrow(); // seller can't
    const cancelled = await trades.cancelTrade(trade.id, buyer, `b-${trade.id}`);
    expect(cancelled.status).toBe("CANCELLED");
    expect(await balanceOf(seller, "user_available")).toBe(10n * USDT);
    const offerAfter = await t.db.selectFrom("offers").selectAll().where("id", "=", offer.id).executeTakeFirstOrThrow();
    expect(offerAfter.remaining).toBe(10n * USDT);
  });

  it("failed transitions leave no partial state (atomicity)", async () => {
    const seller = await fundedUser(10n * USDT);
    const buyer = await fundedUser(0n);
    const offer = await createOffer(seller, 10n * USDT);
    const trade = await openTrade(buyer, offer.id, 10n * USDT);
    const eventsBefore = (await trades.getEvents(trade.id)).length;

    // wrong seller: rejected — must not write events or move funds
    await expect(trades.confirmTrade(trade.id, newId(), `w-${newId()}`)).rejects.toThrow();
    expect((await trades.getEvents(trade.id)).length).toBe(eventsBefore);
    expect(await balanceOf(seller, "user_escrow")).toBe(10n * USDT);
  });

  it("KYC tier limits gate trade size (tier 0 cannot trade)", async () => {
    const seller = await fundedUser(10n * USDT);
    const buyer = await createUser(t.db); // stays tier 0
    const offer = await createOffer(seller, 10n * USDT);
    await expect(openTrade(buyer, offer.id, 10n * USDT)).rejects.toBeInstanceOf(OfferUnavailableError);
  });

  it("kill switch pauses trade opening", async () => {
    const seller = await fundedUser(10n * USDT);
    const buyer = await fundedUser(0n);
    const offer = await createOffer(seller, 10n * USDT);

    await t.db
      .updateTable("settings")
      .set({ value: JSON.stringify({ withdrawals_paused: false, trades_paused: true }) })
      .where("key", "=", "kill_switches")
      .execute();
    // fresh service → no stale cache
    const freshTrades = new TradesService(t.db, ledger, escrow, new SettingsService(t.db), testMinio);
    await expect(freshTrades.openTrade(buyer, {
      offerId: offer.id,
      amount: (5n * USDT).toString(),
      paymentMethod: "MTN_MOMO",
      idempotencyKey: `k-${newId()}`,
    })).rejects.toThrow(/paused/);

    await t.db
      .updateTable("settings")
      .set({ value: JSON.stringify({ withdrawals_paused: false, trades_paused: false }) })
      .where("key", "=", "kill_switches")
      .execute();
  });
});
