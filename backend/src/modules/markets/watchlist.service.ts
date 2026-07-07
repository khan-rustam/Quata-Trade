import { Inject, Injectable } from "@nestjs/common";
import type { Kysely } from "kysely";
import { DB } from "../../db/database.module";
import type { Database } from "../../db/types";
import { newId } from "../../common/ids";

/**
 * Personal market watchlist (Markets Phase C). A thin bookmark store keyed by
 * (user, CoinGecko coin id). No money involved — plain add/remove/list.
 */
@Injectable()
export class WatchlistService {
  constructor(@Inject(DB) private readonly db: Kysely<Database>) {}

  async list(userId: string): Promise<string[]> {
    const rows = await this.db
      .selectFrom("watchlists")
      .select("coin_id")
      .where("user_id", "=", userId)
      .orderBy("created_at", "desc")
      .execute();
    return rows.map((r) => r.coin_id);
  }

  async add(userId: string, coinId: string): Promise<string[]> {
    await this.db
      .insertInto("watchlists")
      .values({ id: newId(), user_id: userId, coin_id: coinId })
      .onConflict((oc) => oc.columns(["user_id", "coin_id"]).doNothing())
      .execute();
    return this.list(userId);
  }

  async remove(userId: string, coinId: string): Promise<string[]> {
    await this.db.deleteFrom("watchlists").where("user_id", "=", userId).where("coin_id", "=", coinId).execute();
    return this.list(userId);
  }
}
