import { Inject, Injectable } from "@nestjs/common";
import { sql, type Kysely } from "kysely";
import type Redis from "ioredis";
import type { ServiceStatus, SystemHealthResponse } from "@quatatrade/shared";
import { DB } from "../../db/database.module";
import { REDIS } from "../../common/redis/redis.module";
import type { Database } from "../../db/types";
import { SettingsService } from "../settings/settings.service";

/** A BROADCAST withdrawal older than this is "stuck" (matches the reconciliation job's intent). */
const STALE_BROADCAST_MS = 30 * 60_000;

/**
 * Read-only system-health snapshot for the admin monitoring page (Layer A).
 * Everything is queried live from Postgres + Redis + settings in the API
 * process. NOTE: this cannot detect the app being wholly down — that needs the
 * external watchdog (Uptime Kuma / cron pinger on /health).
 */
@Injectable()
export class SystemHealthService {
  constructor(
    @Inject(DB) private readonly db: Kysely<Database>,
    @Inject(REDIS) private readonly redis: Redis,
    private readonly settings: SettingsService,
  ) {}

  async snapshot(): Promise<SystemHealthResponse> {
    const [db, redis] = await Promise.all([
      sql`SELECT 1`
        .execute(this.db)
        .then((): ServiceStatus => "up")
        .catch((): ServiceStatus => "down"),
      this.redis
        .ping()
        .then((): ServiceStatus => "up")
        .catch((): ServiceStatus => "down"),
    ]);

    // If Postgres is down every count below would throw — short-circuit to a
    // degraded snapshot rather than 500 the monitoring page itself.
    if (db === "down") {
      return {
        checkedAt: new Date().toISOString(),
        services: { api: "up", db, redis },
        killSwitches: { withdrawalsPaused: false, tradesPaused: false },
        outbox: { pending: 0, retrying: 0, oldestPendingAgeSec: null },
        withdrawals: { stuckBroadcast: 0, riskHold: 0, pendingApproval: 0 },
        workload: { openDisputes: 0, pendingKyc: 0 },
      };
    }

    const staleCutoff = new Date(Date.now() - STALE_BROADCAST_MS);
    const [kill, outboxPending, outboxRetry, oldestPending, stuck, riskHold, pendingApproval, openDisputes, pendingKyc] =
      await Promise.all([
        this.settings.killSwitches(),
        this.db
          .selectFrom("outbox")
          .select((eb) => eb.fn.countAll<bigint>().as("n"))
          .where("processed_at", "is", null)
          .executeTakeFirstOrThrow(),
        this.db
          .selectFrom("outbox")
          .select((eb) => eb.fn.countAll<bigint>().as("n"))
          .where("processed_at", "is", null)
          .where("attempts", ">", 0)
          .executeTakeFirstOrThrow(),
        this.db
          .selectFrom("outbox")
          .select(sql<Date | null>`MIN(created_at)`.as("oldest"))
          .where("processed_at", "is", null)
          .executeTakeFirst(),
        this.db
          .selectFrom("withdrawals")
          .select((eb) => eb.fn.countAll<bigint>().as("n"))
          .where("status", "=", "BROADCAST")
          .where("updated_at", "<", staleCutoff)
          .executeTakeFirstOrThrow(),
        this.db
          .selectFrom("withdrawals")
          .select((eb) => eb.fn.countAll<bigint>().as("n"))
          .where("status", "=", "RISK_HOLD")
          .executeTakeFirstOrThrow(),
        this.db
          .selectFrom("withdrawals")
          .select((eb) => eb.fn.countAll<bigint>().as("n"))
          .where("status", "=", "PENDING_APPROVAL")
          .executeTakeFirstOrThrow(),
        this.db
          .selectFrom("disputes")
          .select((eb) => eb.fn.countAll<bigint>().as("n"))
          .where("status", "!=", "RESOLVED")
          .executeTakeFirstOrThrow(),
        this.db
          .selectFrom("kyc_submissions")
          .select((eb) => eb.fn.countAll<bigint>().as("n"))
          .where("status", "=", "PENDING")
          .executeTakeFirstOrThrow(),
      ]);

    const oldest = oldestPending?.oldest ?? null;
    const oldestPendingAgeSec = oldest ? Math.max(0, Math.floor((Date.now() - new Date(oldest).getTime()) / 1000)) : null;

    return {
      checkedAt: new Date().toISOString(),
      services: { api: "up", db, redis },
      killSwitches: {
        withdrawalsPaused: kill.withdrawalsPaused,
        tradesPaused: kill.tradesPaused,
      },
      outbox: {
        pending: Number(outboxPending.n),
        retrying: Number(outboxRetry.n),
        oldestPendingAgeSec,
      },
      withdrawals: {
        stuckBroadcast: Number(stuck.n),
        riskHold: Number(riskHold.n),
        pendingApproval: Number(pendingApproval.n),
      },
      workload: {
        openDisputes: Number(openDisputes.n),
        pendingKyc: Number(pendingKyc.n),
      },
    };
  }
}
