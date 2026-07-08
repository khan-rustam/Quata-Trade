import { Inject, Injectable } from "@nestjs/common";
import type { Kysely, Selectable } from "kysely";
import type { CreatePriceAlertRequest, PriceAlert, AlertDirection } from "@quatatrade/shared";
import { DB } from "../../db/database.module";
import type { Database, PriceAlertsTable } from "../../db/types";
import { newId } from "../../common/ids";

type AlertRow = Selectable<PriceAlertsTable>;

function toAlert(r: AlertRow): PriceAlert {
  return {
    id: r.id,
    coinId: r.coin_id,
    symbol: r.symbol,
    direction: r.direction as AlertDirection,
    target: r.target,
    active: r.active,
    triggeredAt: r.triggered_at ? r.triggered_at.toISOString() : null,
    createdAt: r.created_at.toISOString(),
  };
}

/** Max active alerts per user — a cheap abuse guard on the cron price checker. */
const MAX_ACTIVE_PER_USER = 50;

@Injectable()
export class PriceAlertsService {
  constructor(@Inject(DB) private readonly db: Kysely<Database>) {}

  async list(userId: string): Promise<PriceAlert[]> {
    const rows = await this.db
      .selectFrom("price_alerts")
      .selectAll()
      .where("user_id", "=", userId)
      .orderBy("created_at", "desc")
      .execute();
    return rows.map(toAlert);
  }

  async create(userId: string, dto: CreatePriceAlertRequest): Promise<PriceAlert> {
    const active = await this.db
      .selectFrom("price_alerts")
      .select((eb) => eb.fn.countAll<bigint>().as("n"))
      .where("user_id", "=", userId)
      .where("active", "=", true)
      .executeTakeFirstOrThrow();
    if (Number(active.n) >= MAX_ACTIVE_PER_USER) {
      throw new PriceAlertLimitError();
    }
    const row = await this.db
      .insertInto("price_alerts")
      .values({
        id: newId(),
        user_id: userId,
        coin_id: dto.coinId,
        symbol: dto.symbol.toUpperCase(),
        direction: dto.direction,
        target: dto.target,
      })
      .returningAll()
      .executeTakeFirstOrThrow();
    return toAlert(row);
  }

  async remove(userId: string, id: string): Promise<void> {
    await this.db.deleteFrom("price_alerts").where("id", "=", id).where("user_id", "=", userId).execute();
  }
}

/** Per-user active-alert cap reached. */
export class PriceAlertLimitError extends Error {
  constructor() {
    super("too many active price alerts");
    this.name = "PriceAlertLimitError";
  }
}
