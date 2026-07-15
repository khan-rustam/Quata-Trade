import { statfs } from "node:fs/promises";
import { freemem, totalmem } from "node:os";
import { Controller, Get, Inject, Optional, ServiceUnavailableException } from "@nestjs/common";
import { sql, type Kysely } from "kysely";
import type Redis from "ioredis";
import { Public } from "../../common/auth/decorators";
import { DB } from "../../db/database.module";
import { REDIS } from "../../common/redis/redis.module";
import type { Database } from "../../db/types";
import { MinioService } from "../../common/storage/minio.service";
import { SettingsService } from "../settings/settings.service";
import { WalletConfigService } from "../wallet/wallet-config.service";

type Up = "up" | "down";

/** Free-space / free-memory thresholds → ok | warn | critical. */
const DISK_WARN_PCT = 20;
const DISK_CRIT_PCT = 10;
const MEM_WARN_PCT = 15;
const MEM_CRIT_PCT = 7;

function levelForFree(freePct: number, warn: number, crit: number): "ok" | "warn" | "critical" {
  if (freePct <= crit) return "critical";
  if (freePct <= warn) return "warn";
  return "ok";
}

/**
 * Health & readiness (Documents/12). Endpoints:
 *  - GET /live         — process is alive (never touches deps).
 *  - GET /health       — alias of /live (kept for existing probes).
 *  - GET /ready, /health/ready — readiness: Postgres + Redis must be up (503 if not).
 *  - GET /status       — full infra snapshot (db, redis, storage, wallet, disk, memory).
 *
 * Signer + queue processors run ONLY in the worker process (see app.module), so
 * they are reported as `worker_scoped` here, not probed from the API.
 */
@Controller()
export class HealthController {
  constructor(
    @Inject(DB) private readonly db: Kysely<Database>,
    @Inject(REDIS) private readonly redis: Redis,
    private readonly settings: SettingsService,
    @Optional() private readonly storage?: MinioService,
    @Optional() private readonly walletConfig?: WalletConfigService,
  ) {}

  @Public()
  @Get(["live", "health"])
  liveness(): { status: "ok" } {
    return { status: "ok" };
  }

  /**
   * Readiness probe for the load balancer / uptime monitor. Postgres and Redis are
   * core to serving any authenticated request, so either being down returns 503 with
   * per-dependency detail. MinIO/chain-RPC readiness belong to /status + the worker.
   */
  @Public()
  @Get(["ready", "health/ready"])
  async readiness(): Promise<Record<string, unknown>> {
    const [db, redis] = await Promise.all([this.probeDb(), this.probeRedis()]);
    if (db === "down" || redis === "down") {
      throw new ServiceUnavailableException({ status: "degraded", db, redis });
    }
    return { status: "ok", db, redis, killSwitches: await this.settings.killSwitches() };
  }

  /**
   * Full infrastructure snapshot for the status page / monitoring. Always 200 with a
   * `status: ok|degraded` flag (core dep down → degraded). Contains no secrets, no
   * balances, no addresses — infra booleans + resource levels only.
   */
  @Public()
  @Get("status")
  async status(): Promise<Record<string, unknown>> {
    const [db, redis, storage, disk, killSwitches] = await Promise.all([
      this.probeDb(),
      this.probeRedis(),
      this.probeStorage(),
      this.probeDisk(),
      this.settings.killSwitches().catch(() => null),
    ]);
    const memory = this.probeMemory();
    const wallet = await this.probeWallet();

    const degraded = db === "down" || redis === "down";
    return {
      status: degraded ? "degraded" : "ok",
      uptimeSeconds: Math.floor(process.uptime()),
      checks: {
        db,
        redis,
        storage,
        wallet,
        disk,
        memory,
        signer: "worker_scoped",
        queue: "worker_scoped",
      },
      killSwitches,
    };
  }

  // ── probes ─────────────────────────────────────────────────────────────────

  private probeDb(): Promise<Up> {
    return sql`SELECT 1`
      .execute(this.db)
      .then(() => "up" as const)
      .catch(() => "down" as const);
  }

  private probeRedis(): Promise<Up> {
    return this.redis
      .ping()
      .then(() => "up" as const)
      .catch(() => "down" as const);
  }

  private async probeStorage(): Promise<Up | "not_checked"> {
    if (!this.storage) return "not_checked";
    return (await this.storage.ping()) ? "up" : "down";
  }

  /** Deposit-address derivation available = a usable watch-only xpub is configured. */
  private async probeWallet(): Promise<{ depositDerivation: "configured" | "not_configured" | "unknown" }> {
    if (!this.walletConfig) return { depositDerivation: "unknown" };
    try {
      const xpub = await this.walletConfig.getActiveXpub();
      return { depositDerivation: xpub.trim().length > 0 ? "configured" : "not_configured" };
    } catch {
      return { depositDerivation: "unknown" };
    }
  }

  private async probeDisk(): Promise<{ freePercent: number; status: string } | { status: "unknown" }> {
    try {
      const s = await statfs("/");
      const freePercent = Math.round((Number(s.bfree) / Number(s.blocks)) * 1000) / 10;
      return { freePercent, status: levelForFree(freePercent, DISK_WARN_PCT, DISK_CRIT_PCT) };
    } catch {
      return { status: "unknown" };
    }
  }

  private probeMemory(): { rssMb: number; heapUsedMb: number; systemFreePercent: number; status: string } {
    const mem = process.memoryUsage();
    const systemFreePercent = Math.round((freemem() / totalmem()) * 1000) / 10;
    return {
      rssMb: Math.round(mem.rss / 1024 / 1024),
      heapUsedMb: Math.round(mem.heapUsed / 1024 / 1024),
      systemFreePercent,
      status: levelForFree(systemFreePercent, MEM_WARN_PCT, MEM_CRIT_PCT),
    };
  }
}
