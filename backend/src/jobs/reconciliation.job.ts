import { Inject, Injectable, Logger } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import type { Kysely } from "kysely";
import { DB } from "../db/database.module";
import type { Database } from "../db/types";
import { LedgerService } from "../modules/ledger/ledger.service";
import { newId } from "../common/ids";

/** A withdrawal broadcast on-chain but not confirmed within this window is stuck. */
const STALE_BROADCAST_MS = 2 * 60 * 60 * 1000;

/**
 * Reconciliation (Documents/09): cached balances vs recomputed SUM(entries).
 * ANY mismatch = corruption signal → pause withdrawals via kill switch + alert.
 * Also flags withdrawals stuck in BROADCAST (item 5) — a dropped tx or an
 * under-funded hot wallet needs human reconciliation with Host B.
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
    await this.reconcileLedgerCache();
    await this.alertStuckBroadcasts();
  }

  /** cached balances vs recomputed SUM(entries) — mismatch pauses withdrawals. */
  private async reconcileLedgerCache(): Promise<void> {
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
    // Emit a security event; the outbox relay routes it to AlertsService so a
    // human is paged (webhook + error log), not just a silent kill-switch flip.
    await this.db
      .insertInto("outbox")
      .values({
        id: newId(),
        event_type: "reconciliation.mismatch",
        payload: JSON.stringify({ mismatchCount: mismatches.length, detail: detail.slice(0, 1000) }),
      })
      .execute();
  }

  /**
   * Withdrawals broadcast on-chain but not confirmed within STALE_BROADCAST_MS.
   * Aggregated so a stuck tx pages on-call (via AlertsService) every cycle until
   * a human reconciles it with Host B — a dropped tx or under-funded hot wallet.
   */
  private async alertStuckBroadcasts(): Promise<void> {
    const cutoff = new Date(Date.now() - STALE_BROADCAST_MS);
    const stuck = await this.db
      .selectFrom("withdrawals")
      .select((eb) => eb.fn.countAll<bigint>().as("n"))
      .where("status", "=", "BROADCAST")
      .where("updated_at", "<", cutoff)
      .executeTakeFirstOrThrow();
    const count = Number(stuck.n);
    if (count === 0) return;
    this.logger.error(`${count} withdrawal(s) stuck in BROADCAST > ${STALE_BROADCAST_MS / 3_600_000}h — human reconciliation`);
    await this.db
      .insertInto("outbox")
      .values({
        id: newId(),
        event_type: "withdrawal.broadcast_stale",
        payload: JSON.stringify({ count, staleHours: STALE_BROADCAST_MS / 3_600_000 }),
      })
      .execute();
  }
}
