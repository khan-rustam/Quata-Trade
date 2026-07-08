import { Inject, Injectable, Logger } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import type { Kysely } from "kysely";
import { DB } from "../db/database.module";
import type { Database } from "../db/types";
import { newId } from "../common/ids";
import { MarketsService } from "../modules/markets/markets.service";

function fmt(n: number): string {
  return "$" + new Intl.NumberFormat("en", { maximumFractionDigits: n < 1 ? 6 : 2, minimumFractionDigits: 2 }).format(n);
}

/**
 * Price-alert checker (Markets Phase G). Every 5 minutes: fetch current prices
 * for the distinct coins with active alerts (one /simple/price call), fire any
 * that crossed their target — deactivate under a guarded UPDATE so a re-run
 * can't double-fire — and emit a `price_alert.triggered` outbox event, which the
 * OutboxRelayJob delivers as an in-app notification + email via NotifyService.
 */
@Injectable()
export class PriceAlertsJob {
  private readonly logger = new Logger(PriceAlertsJob.name);

  constructor(
    @Inject(DB) private readonly db: Kysely<Database>,
    private readonly markets: MarketsService,
  ) {}

  @Cron(CronExpression.EVERY_5_MINUTES)
  async check(): Promise<void> {
    const alerts = await this.db.selectFrom("price_alerts").selectAll().where("active", "=", true).execute();
    if (alerts.length === 0) return;

    const ids = [...new Set(alerts.map((a) => a.coin_id))];
    let prices: Record<string, number>;
    try {
      prices = await this.markets.simplePrices(ids);
    } catch (err) {
      this.logger.warn(`price-alert price fetch failed: ${err instanceof Error ? err.message : "unknown"}`);
      return;
    }

    for (const a of alerts) {
      const price = prices[a.coin_id];
      if (typeof price !== "number") continue;
      const hit = a.direction === "above" ? price >= a.target : price <= a.target;
      if (!hit) continue;

      // Guarded deactivation — the WHERE active makes a concurrent re-run a no-op.
      const res = await this.db
        .updateTable("price_alerts")
        .set({ active: false, triggered_at: new Date() })
        .where("id", "=", a.id)
        .where("active", "=", true)
        .executeTakeFirst();
      if (res.numUpdatedRows === 0n) continue;

      await this.db
        .insertInto("outbox")
        .values({
          id: newId(),
          event_type: "price_alert.triggered",
          payload: JSON.stringify({
            userId: a.user_id,
            symbol: a.symbol,
            direction: a.direction,
            targetDisplay: fmt(a.target),
            priceDisplay: fmt(price),
          }),
        })
        .execute();
    }
  }
}
