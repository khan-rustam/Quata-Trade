import { Inject, Injectable } from "@nestjs/common";
import type { ExpressionBuilder, Kysely } from "kysely";
import type { OpenTradeRequest, SubmitPaymentRequest } from "@quatatrade/shared";
import { ASSET_DECIMALS } from "@quatatrade/shared";
import { DB } from "../../db/database.module";
import type { Database } from "../../db/types";
import { newId, newShortRef } from "../../common/ids";
import { parsePgEnumArray } from "../../common/pg";
import { MinioService } from "../../common/storage/minio.service";
import { fiatValueXaf, split } from "../fees/fees";
import { LedgerService } from "../ledger/ledger.service";
import { EscrowService, type TradeRow } from "../escrow/escrow.service";
import {
  EscrowError,
  IllegalTransitionError,
  InvalidProofError,
  OfferUnavailableError,
  TradeNotFoundError,
  TradesPausedError,
} from "../escrow/escrow.errors";
import { validateChatAttachment } from "../chat/chat.validators";
import { SettingsService } from "../settings/settings.service";

const PROOF_PRESIGN_TTL_SECONDS = 120;

/**
 * trades — lifecycle orchestration (Documents/06-backend-modules.md).
 * Opening a trade is ONE transaction: offer lock + validation + trade insert +
 * escrow lock (available→escrow) + offer.remaining decrement + events.
 * LOCK ORDER: offer row → balance rows (see EscrowService.restockOffer note).
 */
@Injectable()
export class TradesService {
  constructor(
    @Inject(DB) private readonly db: Kysely<Database>,
    private readonly ledger: LedgerService,
    private readonly escrow: EscrowService,
    private readonly settings: SettingsService,
    private readonly minio: MinioService,
  ) {}

  async openTrade(takerId: string, dto: OpenTradeRequest): Promise<TradeRow> {
    const { tradesPaused } = await this.settings.killSwitches();
    if (tradesPaused) throw new TradesPausedError();

    const amount = BigInt(dto.amount);
    const windowMinutes = await this.settings.tradePaymentWindowMinutes();
    const feeBps = await this.settings.feeBps(dto.paymentMethod);

    return this.ledger.withMoneyTransaction(async (trx) => {
      // 1. Lock the offer row — the single serialization point against oversell.
      const offer = await trx
        .selectFrom("offers")
        .selectAll()
        .where("id", "=", dto.offerId)
        .forUpdate()
        .executeTakeFirst();
      if (!offer) throw new OfferUnavailableError("not found");
      if (offer.status !== "ACTIVE") throw new OfferUnavailableError(`status ${offer.status}`);
      if (offer.user_id === takerId) throw new OfferUnavailableError("cannot trade with yourself");
      // pg returns enum-array columns as a raw literal string — normalize before membership check.
      if (!parsePgEnumArray(offer.payment_methods).includes(dto.paymentMethod)) {
        throw new OfferUnavailableError("payment method not accepted");
      }
      if (amount < offer.min_trade || amount > offer.max_trade) {
        throw new OfferUnavailableError("amount outside offer limits");
      }
      if (offer.remaining < amount) throw new OfferUnavailableError("insufficient remaining");

      // SELL offer: maker sells, taker buys. BUY offer: maker buys, taker sells.
      const sellerId = offer.side === "SELL" ? offer.user_id : takerId;
      const buyerId = offer.side === "SELL" ? takerId : offer.user_id;

      // 2. Both parties must be active; KYC tier caps the trade size.
      const parties = await trx
        .selectFrom("users")
        .select(["id", "status", "kyc_tier"])
        .where("id", "in", [sellerId, buyerId])
        .execute();
      for (const id of [sellerId, buyerId]) {
        const u = parties.find((p) => p.id === id);
        if (!u || u.status !== "active") throw new OfferUnavailableError("party is not active");
        const { maxTrade } = await this.settings.kycTierLimits(u.kyc_tier);
        if (amount > maxTrade) throw new OfferUnavailableError("amount exceeds KYC tier limit");
      }

      // 3. Money math — pure, property-tested functions only.
      const { fee } = split(amount, feeBps);
      const fiatXaf = fiatValueXaf(amount, offer.price_xaf_per_unit, ASSET_DECIMALS[offer.asset]);
      if (fiatXaf <= 0n) throw new OfferUnavailableError("amount too small for fiat conversion");

      // 4. Decrement remaining with a guard — oversell is impossible even if
      // a bug dropped the row lock (remaining >= amount re-checked atomically).
      const decremented = await trx
        .updateTable("offers")
        .set((eb) => ({ remaining: eb("remaining", "-", amount), updated_at: new Date() }))
        .where("id", "=", offer.id)
        .where("remaining", ">=", amount)
        .executeTakeFirst();
      if (decremented.numUpdatedRows === 0n) throw new OfferUnavailableError("insufficient remaining");
      await trx
        .updateTable("offers")
        .set({ status: "EXHAUSTED" })
        .where("id", "=", offer.id)
        .where("remaining", "=", 0n)
        .where("status", "=", "ACTIVE")
        .execute();

      // 5. Create the trade (OPENED) + first event, then lock escrow → ESCROW_LOCKED.
      const tradeId = newId();
      const trade = await trx
        .insertInto("trades")
        .values({
          id: tradeId,
          short_ref: newShortRef(),
          offer_id: offer.id,
          seller_id: sellerId,
          buyer_id: buyerId,
          asset: offer.asset,
          amount,
          price_xaf_per_unit: offer.price_xaf_per_unit,
          fiat_amount_xaf: fiatXaf,
          payment_method: dto.paymentMethod,
          fee_bps: feeBps,
          fee_amount: fee,
        })
        .returningAll()
        .executeTakeFirstOrThrow();

      const actor = offer.side === "SELL" ? `buyer:${takerId}` : `seller:${takerId}`;
      await this.escrow.recordCreation(trx, tradeId, actor);

      const deadline = new Date(Date.now() + windowMinutes * 60_000);
      await this.escrow.lockEscrow(trx, trade, actor, deadline);

      return { ...trade, status: "ESCROW_LOCKED" as const, payment_deadline: deadline };
    });
  }

  /** Buyer submits off-platform payment proof: ESCROW_LOCKED → PAYMENT_SUBMITTED. */
  async submitPayment(tradeId: string, buyerId: string, dto: SubmitPaymentRequest): Promise<TradeRow> {
    // Proof keys are namespaced by trade id at upload — reject any that don't belong here (no cross-trade refs).
    for (const key of dto.proofFiles) {
      if (!key.startsWith(`${tradeId}/`)) throw new InvalidProofError("file does not belong to this trade");
    }
    return this.ledger.withMoneyTransaction(async (trx) => {
      const trade = await this.escrow.lockTrade(trx, tradeId);
      if (trade.buyer_id !== buyerId) throw new TradeNotFoundError(tradeId); // scope to party — no IDOR leak
      if (trade.status !== "ESCROW_LOCKED") {
        throw new IllegalTransitionError(trade.status, "PAYMENT_SUBMITTED");
      }

      try {
        await trx
          .insertInto("trade_payments")
          .values({
            id: newId(),
            trade_id: tradeId,
            reference: dto.reference,
            sender_name: dto.senderName,
            sender_number: dto.senderNumber,
            proof_files: JSON.stringify(dto.proofFiles),
          })
          .execute();
      } catch (err) {
        if (typeof err === "object" && err !== null && "code" in err && (err as { code?: string }).code === "23505") {
          throw new EscrowError("payment proof already submitted");
        }
        throw err;
      }

      await this.escrow.transition(trx, trade, "PAYMENT_SUBMITTED", `buyer:${buyerId}`, {
        reference: dto.reference,
      });
      return { ...trade, status: "PAYMENT_SUBMITTED" as const };
    });
  }

  /**
   * Buyer uploads a payment receipt while the trade is ESCROW_LOCKED. Reuses the
   * chat attachment validator (base64 → 3MB cap → jpeg/png/webp magic bytes; no
   * SVG/PDF) → private "proofs" bucket. Key is namespaced `<tradeId>/<uuid><ext>`
   * so submitPayment can enforce trade scoping.
   */
  async uploadProof(tradeId: string, userId: string, base64: string): Promise<{ key: string }> {
    const trade = await this.db
      .selectFrom("trades")
      .select(["buyer_id", "status"])
      .where("id", "=", tradeId)
      .executeTakeFirst();
    if (!trade || trade.buyer_id !== userId) throw new TradeNotFoundError(tradeId); // only the buyer; 404 for non-party
    if (trade.status !== "ESCROW_LOCKED") throw new IllegalTransitionError(trade.status, "PAYMENT_SUBMITTED");

    const result = validateChatAttachment(base64);
    if (!result.ok) throw new InvalidProofError(result.reason);
    const key = `${tradeId}/${newId()}${result.file.ext}`;
    await this.minio.putObject("proofs", key, result.file.buffer, result.file.mime);
    return { key };
  }

  /** Short-TTL presigned URLs for a trade's submitted proof files — party-scoped (buyer or seller). */
  async proofUrls(tradeId: string, userId: string): Promise<{ urls: string[] }> {
    const trade = await this.db
      .selectFrom("trades")
      .select(["buyer_id", "seller_id"])
      .where("id", "=", tradeId)
      .executeTakeFirst();
    if (!trade || (trade.buyer_id !== userId && trade.seller_id !== userId)) throw new TradeNotFoundError(tradeId);
    const payment = await this.db
      .selectFrom("trade_payments")
      .select("proof_files")
      .where("trade_id", "=", tradeId)
      .executeTakeFirst();
    const keys = payment?.proof_files ?? [];
    const urls = await Promise.all(
      keys.map((key) => this.minio.presignedGet("proofs", key, PROOF_PRESIGN_TTL_SECONDS)),
    );
    return { urls };
  }

  /**
   * Seller confirms fiat received → escrow releases (idempotent).
   * Idempotency is keyed by the trade id inside escrow (status guard +
   * `trade:<id>:release`), so the client key is accepted for HTTP retry
   * semantics but not threaded into the ledger.
   */
  async confirmTrade(tradeId: string, sellerId: string, _idempotencyKey: string): Promise<TradeRow> {
    return this.escrow.confirmRelease(tradeId, sellerId);
  }

  async cancelTrade(tradeId: string, userId: string, _idempotencyKey: string): Promise<TradeRow> {
    return this.escrow.cancelTrade(tradeId, userId);
  }

  /** Party-scoped fetch — returns null (→404) rather than leaking others' trades. */
  async getTradeForParty(tradeId: string, userId: string): Promise<TradeRow | null> {
    const trade = await this.db.selectFrom("trades").selectAll().where("id", "=", tradeId).executeTakeFirst();
    if (!trade || (trade.buyer_id !== userId && trade.seller_id !== userId)) return null;
    return trade;
  }

  async listTradesForUser(
    userId: string,
    filter: { status?: TradeRow["status"]; role?: "buyer" | "seller"; page: number; pageSize: number },
  ): Promise<{ items: TradeRow[]; total: number }> {
    const roleFilter = (eb: ExpressionBuilder<Database, "trades">) =>
      filter.role === "buyer"
        ? eb("buyer_id", "=", userId)
        : filter.role === "seller"
          ? eb("seller_id", "=", userId)
          : eb.or([eb("buyer_id", "=", userId), eb("seller_id", "=", userId)]);

    let query = this.db.selectFrom("trades").selectAll().where(roleFilter);
    let countQuery = this.db
      .selectFrom("trades")
      .select((eb) => eb.fn.countAll<bigint>().as("n"))
      .where(roleFilter);
    if (filter.status) {
      query = query.where("status", "=", filter.status);
      countQuery = countQuery.where("status", "=", filter.status);
    }
    const [items, count] = await Promise.all([
      query
        .orderBy("created_at", "desc")
        .limit(filter.pageSize)
        .offset((filter.page - 1) * filter.pageSize)
        .execute(),
      countQuery.executeTakeFirstOrThrow(),
    ]);
    return { items, total: Number(count.n) };
  }

  async getEvents(tradeId: string): Promise<Array<{ id: string; from_status: string | null; to_status: string; actor: string; created_at: Date }>> {
    return this.db
      .selectFrom("trade_events")
      .select(["id", "from_status", "to_status", "actor", "created_at"])
      .where("trade_id", "=", tradeId)
      .orderBy("created_at", "asc")
      .execute();
  }

  async getPayment(tradeId: string): Promise<{ reference: string; sender_name: string; sender_number: string; proof_files: string[]; submitted_at: Date } | null> {
    const row = await this.db
      .selectFrom("trade_payments")
      .select(["reference", "sender_name", "sender_number", "proof_files", "submitted_at"])
      .where("trade_id", "=", tradeId)
      .executeTakeFirst();
    return row ?? null;
  }
}
