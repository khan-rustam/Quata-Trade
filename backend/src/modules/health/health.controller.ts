import { Controller, Get, Inject, ServiceUnavailableException } from "@nestjs/common";
import { sql, type Kysely } from "kysely";
import type Redis from "ioredis";
import { Public } from "../../common/auth/decorators";
import { DB } from "../../db/database.module";
import { REDIS } from "../../common/redis/redis.module";
import type { Database } from "../../db/types";
import { SettingsService } from "../settings/settings.service";

@Controller()
export class HealthController {
  constructor(
    @Inject(DB) private readonly db: Kysely<Database>,
    @Inject(REDIS) private readonly redis: Redis,
    private readonly settings: SettingsService,
  ) {}

  @Public()
  @Get("health")
  liveness(): { status: "ok" } {
    return { status: "ok" };
  }

  /**
   * Readiness probe for the load balancer / uptime monitor. Postgres and Redis are
   * core to serving any authenticated request, so either being down returns 503 with
   * per-dependency detail (previously this reported "ok" while Redis was down — a
   * false green). MinIO/chain-RPC/chain-lag readiness belong to the worker-side probe
   * (those clients are not loaded in the API process) and degrade gracefully here.
   */
  @Public()
  @Get("health/ready")
  async readiness(): Promise<Record<string, unknown>> {
    const [db, redis] = await Promise.all([
      sql`SELECT 1`
        .execute(this.db)
        .then(() => "up" as const)
        .catch(() => "down" as const),
      this.redis
        .ping()
        .then(() => "up" as const)
        .catch(() => "down" as const),
    ]);

    if (db === "down" || redis === "down") {
      throw new ServiceUnavailableException({ status: "degraded", db, redis });
    }

    return { status: "ok", db, redis, killSwitches: await this.settings.killSwitches() };
  }
}
