import { Inject, Injectable, Logger } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import type { Kysely } from "kysely";
import { DB } from "../db/database.module";
import type { Database } from "../db/types";
import { LedgerService } from "../modules/ledger/ledger.service";

/**
 * Reconciliation (Documents/09): cached balances vs recomputed SUM(entries).
 * ANY mismatch = corruption signal → pause withdrawals via kill switch + alert.
 * On-chain vs ledger comparison joins this job when the wallet module lands.
 */
@Injectable()
export class ReconciliationJob {
  private readonly logger = new Logger(ReconciliationJob.name);

  constructor(
    @Inject(DB) private readonly db: Kysely<Database>,
    private readonly ledger: LedgerService,
  ) {}

  @Cron(CronExpression.EVERY_10_MINUTES)
  async run(): Promise<void> {
    const mismatches = await this.ledger.findCacheMismatches();
    if (mismatches.length === 0) {
      this.logger.log("reconciliation clean");
      return;
    }

    const detail = mismatches
      .map((m) => `${m.accountId}: cached=${m.cached} actual=${m.actual}`)
      .join("; ");
    this.logger.error(`LEDGER MISMATCH — pausing withdrawals: ${detail}`);

    // flip ONLY withdrawals_paused; never clobber the trades switch
    const current = await this.db
      .selectFrom("settings")
      .select("value")
      .where("key", "=", "kill_switches")
      .executeTakeFirstOrThrow();
    const switches = { ...(current.value as Record<string, unknown>), withdrawals_paused: true };
    await this.db
      .updateTable("settings")
      .set({ value: JSON.stringify(switches), updated_at: new Date() })
      .where("key", "=", "kill_switches")
      .execute();
    // TODO(alerting): page via monitoring channel once notify module lands.
  }
}
