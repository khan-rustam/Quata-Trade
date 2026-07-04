import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import type { Kysely, Selectable } from "kysely";
import type { CreateOfferRequest, OffersQuery, UpdateOfferRequest } from "@quatatrade/shared";
import { DB } from "../../db/database.module";
import type { Database, OffersTable } from "../../db/types";
import { newId } from "../../common/ids";
import { LedgerService } from "../ledger/ledger.service";
import { CountriesService } from "../countries/countries.service";
import { OfferUnavailableError } from "../escrow/escrow.errors";

export type OfferRow = Selectable<OffersTable>;

/**
 * offers — CRUD + limits (Documents/06-backend-modules.md).
 * SELL offers get a soft balance check at create; the HARD check is the
 * escrow lock at trade open (funds are never reserved by an offer alone).
 */
@Injectable()
export class OffersService {
  constructor(
    @Inject(DB) private readonly db: Kysely<Database>,
    private readonly ledger: LedgerService,
    private readonly countries: CountriesService,
  ) {}

  /** The market the caller trades in — derived per request (country is not in the JWT). */
  private async viewerCountry(userId: string): Promise<string> {
    const u = await this.db.selectFrom("users").select("country").where("id", "=", userId).executeTakeFirst();
    if (!u) throw new NotFoundException(); // authenticated but no row — treat as absent
    return u.country;
  }

  async create(userId: string, dto: CreateOfferRequest): Promise<OfferRow> {
    const user = await this.db
      .selectFrom("users")
      .select(["status", "country"])
      .where("id", "=", userId)
      .executeTakeFirst();
    if (!user || user.status !== "active") throw new OfferUnavailableError("account is not active");
    // A disabled market accepts no new offers (mirrors the openTrade enabled gate).
    if (!(await this.countries.isEnabled(user.country))) {
      throw new OfferUnavailableError("your market is not currently available");
    }

    if (dto.side === "SELL") {
      const accountId = await this.ledger.getOrCreateAccount(userId, "user_available", dto.asset);
      const available = await this.ledger.balanceOf(accountId);
      if (available < BigInt(dto.totalAmount)) {
        throw new OfferUnavailableError("available balance does not back this offer");
      }
    }

    return this.db
      .insertInto("offers")
      .values({
        id: newId(),
        user_id: userId,
        country: user.country, // stamp the maker's market — the browse/trade scope key
        side: dto.side,
        asset: dto.asset,
        price_xaf_per_unit: BigInt(dto.priceXafPerUnit),
        min_trade: BigInt(dto.minTrade),
        max_trade: BigInt(dto.maxTrade),
        remaining: BigInt(dto.totalAmount),
        payment_methods: dto.paymentMethods,
        terms: dto.terms ?? null,
      })
      .returningAll()
      .executeTakeFirstOrThrow();
  }

  async update(userId: string, offerId: string, dto: UpdateOfferRequest): Promise<OfferRow> {
    const updated = await this.db
      .updateTable("offers")
      .set({
        ...(dto.priceXafPerUnit !== undefined ? { price_xaf_per_unit: BigInt(dto.priceXafPerUnit) } : {}),
        ...(dto.minTrade !== undefined ? { min_trade: BigInt(dto.minTrade) } : {}),
        ...(dto.maxTrade !== undefined ? { max_trade: BigInt(dto.maxTrade) } : {}),
        ...(dto.paymentMethods !== undefined ? { payment_methods: dto.paymentMethods } : {}),
        ...(dto.terms !== undefined ? { terms: dto.terms } : {}),
        updated_at: new Date(),
      })
      .where("id", "=", offerId)
      .where("user_id", "=", userId) // owner-scoped — no IDOR
      .where("status", "in", ["ACTIVE", "PAUSED"])
      .returningAll()
      .executeTakeFirst();
    if (!updated) throw new NotFoundException();
    return updated;
  }

  async setStatus(userId: string, offerId: string, status: "ACTIVE" | "PAUSED" | "DELETED"): Promise<OfferRow> {
    const updated = await this.db
      .updateTable("offers")
      .set({ status, updated_at: new Date() })
      .where("id", "=", offerId)
      .where("user_id", "=", userId)
      .where("status", "!=", "DELETED")
      .returningAll()
      .executeTakeFirst();
    if (!updated) throw new NotFoundException();
    return updated;
  }

  async getPublic(viewerUserId: string, offerId: string): Promise<OfferRow | null> {
    const country = await this.viewerCountry(viewerUserId);
    const offer = await this.db
      .selectFrom("offers")
      .selectAll()
      .where("id", "=", offerId)
      .where("status", "!=", "DELETED")
      .where("country", "=", country) // cross-market offers are invisible → 404
      .executeTakeFirst();
    return offer ?? null;
  }

  async list(viewerUserId: string, query: OffersQuery): Promise<{ items: OfferRow[]; total: number }> {
    const country = await this.viewerCountry(viewerUserId);
    // country is the mandatory first filter — a user only ever sees their own market.
    let qb = this.db.selectFrom("offers").selectAll().where("country", "=", country).where("status", "=", "ACTIVE");
    let cq = this.db
      .selectFrom("offers")
      .select((eb) => eb.fn.countAll<bigint>().as("n"))
      .where("country", "=", country)
      .where("status", "=", "ACTIVE");

    if (query.side) {
      qb = qb.where("side", "=", query.side);
      cq = cq.where("side", "=", query.side);
    }
    if (query.method) {
      qb = qb.where((eb) => eb(eb.val(query.method), "=", eb.fn.any("payment_methods")));
      cq = cq.where((eb) => eb(eb.val(query.method), "=", eb.fn.any("payment_methods")));
    }
    if (query.minAmount) {
      qb = qb.where("max_trade", ">=", BigInt(query.minAmount));
      cq = cq.where("max_trade", ">=", BigInt(query.minAmount));
    }
    if (query.maxAmount) {
      qb = qb.where("min_trade", "<=", BigInt(query.maxAmount));
      cq = cq.where("min_trade", "<=", BigInt(query.maxAmount));
    }

    const [items, count] = await Promise.all([
      qb
        .orderBy("price_xaf_per_unit", query.side === "BUY" ? "desc" : "asc")
        .limit(query.pageSize)
        .offset((query.page - 1) * query.pageSize)
        .execute(),
      cq.executeTakeFirstOrThrow(),
    ]);
    return { items, total: Number(count.n) };
  }

  async listForUser(userId: string): Promise<OfferRow[]> {
    return this.db
      .selectFrom("offers")
      .selectAll()
      .where("user_id", "=", userId)
      .where("status", "!=", "DELETED")
      .orderBy("created_at", "desc")
      .execute();
  }
}
