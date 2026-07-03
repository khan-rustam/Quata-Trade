import {
  Body,
  ConflictException,
  Controller,
  Delete,
  Get,
  HttpCode,
  Inject,
  NotFoundException,
  Param,
  Patch,
  Post,
  Query,
} from "@nestjs/common";
import type { Kysely } from "kysely";
import {
  zCreateOfferRequest,
  zOffersQuery,
  zUpdateOfferRequest,
  zUuid,
  type CreateOfferRequest,
  type Offer,
  type OffersQuery,
  type Ok,
  type UpdateOfferRequest,
} from "@quatatrade/shared";
import { CurrentUserId } from "../../common/auth/decorators";
import { ZodPipe } from "../../common/zod.pipe";
import { DB } from "../../db/database.module";
import type { Database } from "../../db/types";
import { OfferUnavailableError } from "../escrow/escrow.errors";
import { OffersService, type OfferRow } from "./offers.service";
import { fetchTraders, mapOffer } from "./offers.mapper";

interface OffersListResponse {
  items: Offer[];
  page: number;
  pageSize: number;
  total: number;
}

/** Domain error → HTTP. OfferUnavailable (inactive account, unbacked SELL) → 409. */
function rethrowAsHttp(err: unknown): never {
  if (err instanceof OfferUnavailableError) throw new ConflictException(err.message);
  throw err;
}

@Controller("offers")
export class OffersController {
  constructor(
    @Inject(DB) private readonly db: Kysely<Database>,
    private readonly offers: OffersService,
  ) {}

  @Post()
  async create(
    @CurrentUserId() userId: string,
    @Body(new ZodPipe(zCreateOfferRequest)) dto: CreateOfferRequest,
  ): Promise<Offer> {
    const row = await this.offers.create(userId, dto).catch(rethrowAsHttp);
    return this.toWire(row);
  }

  /** Marketplace browse — ACTIVE offers only (service enforces). */
  @Get()
  async list(@Query(new ZodPipe(zOffersQuery)) query: OffersQuery): Promise<OffersListResponse> {
    const { items, total } = await this.offers.list(query);
    const traders = await fetchTraders(this.db, items.map((o) => o.user_id));
    const mapped: Offer[] = [];
    for (const row of items) {
      const trader = traders.get(row.user_id);
      if (trader) mapped.push(mapOffer(row, trader));
    }
    return { items: mapped, page: query.page, pageSize: query.pageSize, total };
  }

  /**
   * The caller's own offers for self-service management (edit / pause / delete).
   * Declared BEFORE `:id` so the literal "mine" is not matched as an offer id.
   */
  @Get("mine")
  async mine(@CurrentUserId() userId: string): Promise<{ items: Offer[] }> {
    const rows = await this.offers.listForUser(userId);
    const traders = await fetchTraders(this.db, rows.map((o) => o.user_id));
    const items: Offer[] = [];
    for (const row of rows) {
      const trader = traders.get(row.user_id);
      if (trader) items.push(mapOffer(row, trader));
    }
    return { items };
  }

  /** 404 when missing or soft-DELETED — deleted offers are indistinguishable from absent. */
  @Get(":id")
  async detail(@Param("id", new ZodPipe(zUuid)) id: string): Promise<Offer> {
    const row = await this.offers.getPublic(id);
    if (!row) throw new NotFoundException("offer not found");
    return this.toWire(row);
  }

  /** Owner-scoped via service WHERE user_id — non-owners get 404, never 403. */
  @Patch(":id")
  async update(
    @CurrentUserId() userId: string,
    @Param("id", new ZodPipe(zUuid)) id: string,
    @Body(new ZodPipe(zUpdateOfferRequest)) dto: UpdateOfferRequest,
  ): Promise<Offer> {
    const row = await this.offers.update(userId, id, dto);
    return this.toWire(row);
  }

  @Post(":id/pause")
  @HttpCode(200)
  async pause(@CurrentUserId() userId: string, @Param("id", new ZodPipe(zUuid)) id: string): Promise<Offer> {
    const row = await this.offers.setStatus(userId, id, "PAUSED");
    return this.toWire(row);
  }

  @Post(":id/activate")
  @HttpCode(200)
  async activate(@CurrentUserId() userId: string, @Param("id", new ZodPipe(zUuid)) id: string): Promise<Offer> {
    const row = await this.offers.setStatus(userId, id, "ACTIVE");
    return this.toWire(row);
  }

  /** Soft delete — the row stays for referential integrity of past trades. */
  @Delete(":id")
  async remove(@CurrentUserId() userId: string, @Param("id", new ZodPipe(zUuid)) id: string): Promise<Ok> {
    await this.offers.setStatus(userId, id, "DELETED");
    return { ok: true };
  }

  private async toWire(row: OfferRow): Promise<Offer> {
    const traders = await fetchTraders(this.db, [row.user_id]);
    const trader = traders.get(row.user_id);
    if (!trader) throw new NotFoundException("offer not found"); // owner row missing — treat as absent
    return mapOffer(row, trader);
  }
}
