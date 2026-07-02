import { Inject, Injectable, Logger } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import type { Kysely } from "kysely";
import { DB } from "../db/database.module";
import type { Database } from "../db/types";
import { EscrowService } from "../modules/escrow/escrow.service";

/**
 * Auto-expiry: ESCROW_LOCKED trades past payment_deadline refund the seller
 * (Documents/01 core flow). Idempotent and race-safe — expireTrade re-checks
 * status + deadline under the trade row lock; running overlapping is harmless.
 */
@Injectable()
export class TradeTimeoutJob {
  private readonly logger = new Logger(TradeTimeoutJob.name);
  private running = false;

  constructor(
    @Inject(DB) private readonly db: Kysely<Database>,
    private readonly escrow: EscrowService,
  ) {}

  @Cron(CronExpression.EVERY_30_SECONDS)
  async run(): Promise<void> {
    if (this.running) return;
    this.running = true;
    try {
      const expired = await this.db
        .selectFrom("trades")
        .select(["id"])
        .where("status", "=", "ESCROW_LOCKED")
        .where("payment_deadline", "<", new Date())
        .limit(100)
        .execute();

      for (const { id } of expired) {
        try {
          const didExpire = await this.escrow.expireTrade(id);
          if (didExpire) this.logger.log(`trade ${id} expired, seller refunded`);
        } catch (err) {
          this.logger.error(`expiry of trade ${id} failed — will retry next tick: ${String(err)}`);
        }
      }
    } finally {
      this.running = false;
    }
  }
}
