import { Inject, Injectable, Logger } from "@nestjs/common";
import { Cron } from "@nestjs/schedule";
import type { Kysely } from "kysely";
import { DB } from "../db/database.module";
import type { Database } from "../db/types";
import { NotifyService } from "../modules/notify/notify.service";

const BATCH_SIZE = 50;
/** after this many failed attempts the event is dead-lettered */
const MAX_ATTEMPTS = 8;
const MAX_BACKOFF_MINUTES = 60;

/**
 * Outbox relay (Documents/03 outbox pattern): domain events are written to the
 * outbox table in the SAME transaction as the state change; this worker job
 * publishes them to NotifyService so consumers never miss an event. Unknown
 * event types are a successful no-op inside dispatch. Retries back off
 * exponentially (min(2^attempts, 60) minutes); after MAX_ATTEMPTS the row is
 * dead-lettered: processed_at set + a flag noted in the payload + error log.
 * Runs every 15s with a running-flag guard — overlapping ticks never double-run.
 */
@Injectable()
export class OutboxRelayJob {
  private readonly logger = new Logger(OutboxRelayJob.name);
  private running = false;

  constructor(
    @Inject(DB) private readonly db: Kysely<Database>,
    private readonly notify: NotifyService,
  ) {}

  @Cron("*/15 * * * * *")
  async run(): Promise<void> {
    if (this.running) return;
    this.running = true;
    try {
      const events = await this.db
        .selectFrom("outbox")
        .selectAll()
        .where("processed_at", "is", null)
        .where((eb) => eb.or([eb("next_attempt_at", "is", null), eb("next_attempt_at", "<", new Date())]))
        .orderBy("created_at", "asc")
        .limit(BATCH_SIZE)
        .execute();

      for (const event of events) {
        try {
          await this.notify.dispatch(event.event_type, event.payload);
          await this.db
            .updateTable("outbox")
            .set({ processed_at: new Date() })
            .where("id", "=", event.id)
            .execute();
        } catch (err) {
          await this.recordFailure(event.id, event.event_type, event.attempts, event.payload, err);
        }
      }
    } finally {
      this.running = false;
    }
  }

  private async recordFailure(
    id: string,
    eventType: string,
    priorAttempts: number,
    payload: Record<string, unknown>,
    err: unknown,
  ): Promise<void> {
    const attempts = priorAttempts + 1;
    const reason = err instanceof Error ? err.message : "unknown error";

    if (attempts > MAX_ATTEMPTS) {
      this.logger.error(`outbox event ${id} (${eventType}) DEAD-LETTERED after ${attempts} attempts: ${reason}`);
      await this.db
        .updateTable("outbox")
        .set({
          attempts,
          processed_at: new Date(),
          payload: JSON.stringify({ ...payload, _deadLetter: true, _lastError: reason.slice(0, 500) }),
        })
        .where("id", "=", id)
        .execute();
      return;
    }

    const backoffMinutes = Math.min(2 ** attempts, MAX_BACKOFF_MINUTES);
    this.logger.warn(
      `outbox event ${id} (${eventType}) attempt ${attempts} failed — retrying in ${backoffMinutes}m: ${reason}`,
    );
    await this.db
      .updateTable("outbox")
      .set({ attempts, next_attempt_at: new Date(Date.now() + backoffMinutes * 60_000) })
      .where("id", "=", id)
      .execute();
  }
}
