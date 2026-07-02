import { Inject, Injectable, Logger } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import { sql, type Kysely } from "kysely";
import { DB } from "../../db/database.module";
import type { Database } from "../../db/types";
import { AuditService } from "../../common/audit/audit.service";
import { MinioService } from "../../common/storage/minio.service";

const PURGE_NOTE = "files purged per retention";
const BATCH_LIMIT = 200;

/**
 * Retention purge (Documents/08 §F/§I — Cameroon Law 2024/017 schedule):
 * daily, deletes MinIO objects for submissions past retention_delete_after,
 * keeps the row (files := []) and appends a purge note. Idempotent — purged
 * rows have files = [] and never match again; a failed row retries next run.
 * Runs in the WORKER (ScheduleModule) — the API context leaves @Cron inert.
 */
@Injectable()
export class KycRetentionJob {
  private readonly logger = new Logger(KycRetentionJob.name);
  private running = false;

  constructor(
    @Inject(DB) private readonly db: Kysely<Database>,
    private readonly minio: MinioService,
    private readonly audit: AuditService,
  ) {}

  @Cron(CronExpression.EVERY_DAY_AT_3AM)
  async run(): Promise<void> {
    if (this.running) return;
    this.running = true;
    try {
      await this.purgeExpired();
    } finally {
      this.running = false;
    }
  }

  /** Exposed for tests. Returns the number of submissions purged. */
  async purgeExpired(now: Date = new Date()): Promise<number> {
    const due = await this.db
      .selectFrom("kyc_submissions")
      .select(["id", "user_id", "files", "review_notes"])
      .where("retention_delete_after", "<", now)
      .where(sql<boolean>`files <> '[]'::jsonb`)
      .orderBy("retention_delete_after", "asc")
      .limit(BATCH_LIMIT)
      .execute();

    let purged = 0;
    for (const row of due) {
      try {
        for (const key of row.files) {
          await this.minio.removeObject("kyc", key); // S3 semantics: missing object is a no-op
        }
        await this.db
          .updateTable("kyc_submissions")
          .set({
            files: JSON.stringify([]),
            review_notes: row.review_notes ? `${row.review_notes}\n${PURGE_NOTE}` : PURGE_NOTE,
          })
          .where("id", "=", row.id)
          .execute();
        await this.audit.log({
          actorType: "system",
          actorId: null,
          action: "kyc.retention_purged",
          targetType: "kyc_submission",
          targetId: row.id,
          metadata: { userId: row.user_id, fileCount: row.files.length },
        });
        purged += 1;
      } catch (err) {
        // Object deletion failed → row keeps its keys and is retried tomorrow.
        this.logger.error(`retention purge for submission ${row.id} failed — will retry next run: ${String(err)}`);
      }
    }
    if (purged > 0) this.logger.log(`purged files of ${purged} KYC submission(s) past retention`);
    return purged;
  }
}
