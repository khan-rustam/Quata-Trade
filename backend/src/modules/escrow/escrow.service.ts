import { Inject, Injectable } from "@nestjs/common";
import type { Kysely, Transaction } from "kysely";
import type { TradeStatus } from "@quatatrade/shared";
import { DB } from "../../db/database.module";
import type { Database, TradesTable } from "../../db/types";
import type { Selectable } from "kysely";
import { newId } from "../../common/ids";
import { LedgerService } from "../ledger/ledger.service";
import { IllegalTransitionError, TradeNotFoundError } from "./escrow.errors";

export type TradeRow = Selectable<TradesTable>;

/**
 * escrow — review priority #1 (Documents/06-backend-modules.md).
 *
 * The ONLY module that mutates trades.status, and the ONLY caller of
 * postJournal for escrow_* reasons. Every transition:
 *   1. runs inside ONE transaction,
 *   2. locks the trade row FOR UPDATE FIRST (then balances, via ledger),
 *   3. flows through the FSM (service check + trade_transitions DB trigger),
 *   4. writes a trade_events row in the SAME transaction,
 *   5. writes an outbox event in the SAME transaction.
 *
 * Escrow is ledger-level (Documents/03): locking = user_available → user_escrow.
 * NOTHING here releases funds while status = DISPUTED except resolveDispute().
 */
@Injectable()
export class EscrowService {
  constructor(
    @Inject(DB) private readonly db: Kysely<Database>,
    private readonly ledger: LedgerService,
  ) {}

  /** Lock the trade row. All money transitions start here — trade first, balances second. */
  async lockTrade(trx: Transaction<Database>, tradeId: string): Promise<TradeRow> {
    const trade = await trx
      .selectFrom("trades")
      .selectAll()
      .where("id", "=", tradeId)
      .forUpdate()
      .executeTakeFirst();
    if (!trade) throw new TradeNotFoundError(tradeId);
    return trade;
  }

  /**
   * FSM transition: guarded UPDATE + trade_events row in the same tx.
   * The WHERE status = from clause makes double-transitions impossible even
   * if two processes somehow both hold stale reads; the DB trigger is backstop.
   */
  async transition(
    trx: Transaction<Database>,
    trade: Pick<TradeRow, "id" | "status">,
    to: TradeStatus,
    actor: string,
    metadata?: Record<string, unknown>,
    extra?: Partial<{
      completed_at: Date;
      escrow_journal_id: string;
      release_journal_id: string;
      payment_deadline: Date;
    }>,
  ): Promise<void> {
    const result = await trx
      .updateTable("trades")
      .set({ status: to, updated_at: new Date(), ...(extra ?? {}) })
      .where("id", "=", trade.id)
      .where("status", "=", trade.status)
      .executeTakeFirst();
    if (result.numUpdatedRows === 0n) {
      throw new IllegalTransitionError(trade.status, to);
    }
    await trx
      .insertInto("trade_events")
      .values({
        id: newId(),
        trade_id: trade.id,
        from_status: trade.status,
        to_status: to,
        actor,
        metadata: metadata ? JSON.stringify(metadata) : null,
      })
      .execute();
    await trx
      .insertInto("outbox")
      .values({
        id: newId(),
        event_type: `trade.${to.toLowerCase()}`,
        payload: JSON.stringify({ tradeId: trade.id, from: trade.status, to, actor }),
      })
      .execute();
  }

  /** Record the very first event when a trade row is created (null → OPENED). */
  async recordCreation(trx: Transaction<Database>, tradeId: string, actor: string): Promise<void> {
    await trx
      .insertInto("trade_events")
      .values({ id: newId(), trade_id: tradeId, from_status: null, to_status: "OPENED", actor, metadata: null })
      .execute();
    await trx
      .insertInto("outbox")
      .values({ id: newId(), event_type: "trade.opened", payload: JSON.stringify({ tradeId, actor }) })
      .execute();
  }

  /**
   * OPENED → ESCROW_LOCKED: move seller available → escrow atomically.
   * Called by TradesService inside the same tx that created the trade row.
   */
  async lockEscrow(
    trx: Transaction<Database>,
    trade: TradeRow,
    actor: string,
    paymentDeadline: Date,
    idempotencyKey: string,
  ): Promise<void> {
    const sellerAvailable = await this.ledger.getOrCreateAccount(trade.seller_id, "user_available", trade.asset, trx);
    const sellerEscrow = await this.ledger.getOrCreateAccount(trade.seller_id, "user_escrow", trade.asset, trx);
    const { journalId } = await this.ledger.postJournal(
      {
        reason: "escrow_lock",
        referenceType: "trade",
        referenceId: trade.id,
        idempotencyKey: `${idempotencyKey}:lock`,
        createdBy: actor,
        asset: trade.asset,
        legs: [
          { accountId: sellerAvailable, amount: -trade.amount },
          { accountId: sellerEscrow, amount: trade.amount },
        ],
      },
      trx,
    );
    await this.transition(trx, trade, "ESCROW_LOCKED", actor, undefined, {
      escrow_journal_id: journalId,
      payment_deadline: paymentDeadline,
    });
  }

  /**
   * PAYMENT_SUBMITTED → COMPLETED (seller confirms fiat received).
   * Releases: escrow −amount / buyer +(amount−fee) / treasury +fee.
   * Idempotent: a second confirm finds status COMPLETED and no-ops.
   */
  async confirmRelease(tradeId: string, sellerId: string, idempotencyKey: string): Promise<TradeRow> {
    return this.ledger.withMoneyTransaction(async (trx) => {
      const trade = await this.lockTrade(trx, tradeId);

      if (trade.status === "COMPLETED" && trade.release_journal_id) {
        return trade; // double-confirm no-op (Gate 4 requirement)
      }
      if (trade.seller_id !== sellerId) throw new TradeNotFoundError(tradeId); // no IDOR leak
      if (trade.status !== "PAYMENT_SUBMITTED") {
        throw new IllegalTransitionError(trade.status, "COMPLETED");
      }

      const journalId = await this.postRelease(trx, trade, `seller:${sellerId}`, idempotencyKey);
      await this.transition(trx, trade, "COMPLETED", `seller:${sellerId}`, undefined, {
        completed_at: new Date(),
        release_journal_id: journalId,
      });
      return { ...trade, status: "COMPLETED" as const, release_journal_id: journalId };
    });
  }

  /** Shared release legs: escrow → buyer (amount − fee) + treasury (fee). */
  private async postRelease(
    trx: Transaction<Database>,
    trade: TradeRow,
    actor: string,
    idempotencyKey: string,
  ): Promise<string> {
    const sellerEscrow = await this.ledger.getOrCreateAccount(trade.seller_id, "user_escrow", trade.asset, trx);
    const buyerAvailable = await this.ledger.getOrCreateAccount(trade.buyer_id, "user_available", trade.asset, trx);
    const treasury = await this.ledger.getOrCreateAccount(null, "platform_treasury", trade.asset, trx);
    const buyerCredit = trade.amount - trade.fee_amount;

    const legs =
      trade.fee_amount > 0n
        ? [
            { accountId: sellerEscrow, amount: -trade.amount },
            { accountId: buyerAvailable, amount: buyerCredit },
            { accountId: treasury, amount: trade.fee_amount },
          ]
        : [
            { accountId: sellerEscrow, amount: -trade.amount },
            { accountId: buyerAvailable, amount: buyerCredit },
          ];

    const { journalId } = await this.ledger.postJournal(
      {
        reason: "escrow_release_buyer",
        referenceType: "trade",
        referenceId: trade.id,
        idempotencyKey: `${idempotencyKey}:release`,
        createdBy: actor,
        asset: trade.asset,
        legs,
      },
      trx,
    );
    return journalId;
  }

  /** Shared refund legs: escrow → seller available (full amount, no fee). */
  private async postRefund(
    trx: Transaction<Database>,
    trade: TradeRow,
    actor: string,
    idempotencyKey: string,
  ): Promise<string> {
    const sellerEscrow = await this.ledger.getOrCreateAccount(trade.seller_id, "user_escrow", trade.asset, trx);
    const sellerAvailable = await this.ledger.getOrCreateAccount(trade.seller_id, "user_available", trade.asset, trx);
    const { journalId } = await this.ledger.postJournal(
      {
        reason: "escrow_refund",
        referenceType: "trade",
        referenceId: trade.id,
        idempotencyKey: `${idempotencyKey}:refund`,
        createdBy: actor,
        asset: trade.asset,
        legs: [
          { accountId: sellerEscrow, amount: -trade.amount },
          { accountId: sellerAvailable, amount: trade.amount },
        ],
      },
      trx,
    );
    return journalId;
  }

  /**
   * Refund paths return inventory to the offer (unless DELETED).
   * LOCK ORDER (deadlock-free, matches TradesService.openTrade):
   * trade row → offer row → balance rows. Never lock the offer after balances.
   */
  private async restockOffer(trx: Transaction<Database>, offerId: string, amount: bigint): Promise<void> {
    const offer = await trx
      .selectFrom("offers")
      .select(["id", "status"])
      .where("id", "=", offerId)
      .forUpdate()
      .executeTakeFirst();
    if (!offer || offer.status === "DELETED") return;
    await trx
      .updateTable("offers")
      .set((eb) => ({
        remaining: eb("remaining", "+", amount),
        status: offer.status === "EXHAUSTED" ? "ACTIVE" : offer.status,
        updated_at: new Date(),
      }))
      .where("id", "=", offerId)
      .execute();
  }

  /**
   * Buyer cancels (ESCROW_LOCKED or PAYMENT_SUBMITTED) → CANCELLED + refund.
   * Also used for OPENED → CANCELLED (no funds moved yet).
   */
  async cancelTrade(tradeId: string, actorUserId: string, idempotencyKey: string): Promise<TradeRow> {
    return this.ledger.withMoneyTransaction(async (trx) => {
      const trade = await this.lockTrade(trx, tradeId);
      if (trade.status === "CANCELLED") return trade; // idempotent

      const isBuyer = trade.buyer_id === actorUserId;
      if (!isBuyer) throw new TradeNotFoundError(tradeId); // only the buyer may cancel; sellers use disputes
      const actor = `buyer:${actorUserId}`;

      if (trade.status === "OPENED") {
        await this.transition(trx, trade, "CANCELLED", actor);
        return { ...trade, status: "CANCELLED" as const };
      }
      if (trade.status !== "ESCROW_LOCKED" && trade.status !== "PAYMENT_SUBMITTED") {
        throw new IllegalTransitionError(trade.status, "CANCELLED");
      }
      await this.restockOffer(trx, trade.offer_id, trade.amount);
      await this.postRefund(trx, trade, actor, idempotencyKey);
      await this.transition(trx, trade, "CANCELLED", actor);
      return { ...trade, status: "CANCELLED" as const };
    });
  }

  /**
   * ESCROW_LOCKED past deadline → EXPIRED + refund seller exactly once.
   * Runs from the worker timeout job; the row lock + guarded UPDATE make the
   * expiry-vs-confirm race resolve to exactly one terminal state.
   */
  async expireTrade(tradeId: string): Promise<boolean> {
    return this.ledger.withMoneyTransaction(async (trx) => {
      const trade = await this.lockTrade(trx, tradeId);
      if (trade.status !== "ESCROW_LOCKED") return false; // confirm/cancel/dispute won the race
      if (!trade.payment_deadline || trade.payment_deadline.getTime() > Date.now()) return false;

      await this.restockOffer(trx, trade.offer_id, trade.amount);
      await this.postRefund(trx, trade, "system", `trade:${trade.id}:expiry`);
      await this.transition(trx, trade, "EXPIRED", "system");
      return true;
    });
  }

  /** ESCROW_LOCKED | PAYMENT_SUBMITTED → DISPUTED. Funds untouched, frozen. */
  async markDisputed(trx: Transaction<Database>, trade: TradeRow, actorUserId: string): Promise<void> {
    if (trade.status !== "ESCROW_LOCKED" && trade.status !== "PAYMENT_SUBMITTED") {
      throw new IllegalTransitionError(trade.status, "DISPUTED");
    }
    await this.transition(trx, trade, "DISPUTED", `user:${actorUserId}`);
  }

  /**
   * DISPUTED → RESOLVED_RELEASE | RESOLVED_REFUND. ONLY admin resolution moves
   * funds out of a disputed escrow (Documents/01 golden invariant #3).
   */
  async resolveDispute(
    tradeId: string,
    adminId: string,
    resolution: "RELEASE_TO_BUYER" | "REFUND_TO_SELLER",
    idempotencyKey: string,
  ): Promise<TradeRow> {
    return this.ledger.withMoneyTransaction(async (trx) => {
      const trade = await this.lockTrade(trx, tradeId);
      const actor = `admin:${adminId}`;

      if (
        (trade.status === "RESOLVED_RELEASE" && resolution === "RELEASE_TO_BUYER") ||
        (trade.status === "RESOLVED_REFUND" && resolution === "REFUND_TO_SELLER")
      ) {
        return trade; // idempotent re-resolve with same outcome
      }
      if (trade.status !== "DISPUTED") {
        throw new IllegalTransitionError(trade.status, resolution === "RELEASE_TO_BUYER" ? "RESOLVED_RELEASE" : "RESOLVED_REFUND");
      }

      if (resolution === "RELEASE_TO_BUYER") {
        const journalId = await this.postRelease(trx, trade, actor, idempotencyKey);
        await this.transition(trx, trade, "RESOLVED_RELEASE", actor, undefined, {
          completed_at: new Date(),
          release_journal_id: journalId,
        });
        return { ...trade, status: "RESOLVED_RELEASE" as const, release_journal_id: journalId };
      }
      await this.restockOffer(trx, trade.offer_id, trade.amount);
      const journalId = await this.postRefund(trx, trade, actor, idempotencyKey);
      await this.transition(trx, trade, "RESOLVED_REFUND", actor, undefined, {
        release_journal_id: journalId,
      });
      return { ...trade, status: "RESOLVED_REFUND" as const, release_journal_id: journalId };
    });
  }
}
