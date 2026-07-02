import { Inject, Injectable, Logger } from "@nestjs/common";
import type { Kysely } from "kysely";
import type Redis from "ioredis";
import { DB } from "../../db/database.module";
import type { Database } from "../../db/types";
import { REDIS } from "../../common/redis/redis.module";
import { AuditService } from "../../common/audit/audit.service";
import { newId } from "../../common/ids";
import { SettingsService } from "../settings/settings.service";
import { RiskSubjectNotFoundError } from "./risk.errors";
import {
  actionForScore,
  computeScore,
  DEFAULT_RISK_CONFIG,
  type RiskConfig,
  type RiskKind,
  type RiskScore,
} from "./risk.rules";

/** Short key segment per kind — keys look like risk:wd:{userId}:{hourBucket}. */
const VELOCITY_KEY_SEGMENT: Record<RiskKind, string> = {
  login: "login",
  trade_open: "trade",
  withdrawal: "wd",
};

const HOUR_MS = 3_600_000;
/** counters live two hour-buckets so a bucket never expires mid-window */
const VELOCITY_TTL_SECONDS = 2 * 3600;

export interface LoginContext {
  ip?: string | null;
  deviceFingerprint?: string | null;
}

/**
 * risk — deterministic scoring only (Documents/06 "risk", CLAUDE.md).
 * NO LLM calls, NO auto-approve paths; rules are pure functions in risk.rules.ts.
 * Every call persists a risk_events row. score >= 70 → escalate (outbox
 * risk.flagged); score >= 90 → auto-freeze the user + audit + outbox user.frozen.
 * Callers: auth (login), trades (open), withdrawals (request). No HTTP surface —
 * the admin module reads risk_events directly.
 */
@Injectable()
export class RiskService {
  private readonly logger = new Logger(RiskService.name);
  private readonly config: RiskConfig = DEFAULT_RISK_CONFIG;

  constructor(
    @Inject(DB) private readonly db: Kysely<Database>,
    @Inject(REDIS) private readonly redis: Redis,
    private readonly audit: AuditService,
    private readonly settings: SettingsService,
  ) {}

  /** Score a (successful) login attempt. `ip` is accepted for future GeoIP rules. */
  async scoreLogin(userId: string, ctx: LoginContext): Promise<RiskScore> {
    const user = await this.loadUser(userId);
    const eventsThisHour = await this.velocity("login", userId);
    const isNewDevice = await this.isNewDevice(userId, ctx.deviceFingerprint ?? null);
    const result = computeScore(
      {
        kind: "login",
        eventsThisHour,
        amount: null,
        tierLimit: null,
        accountAgeMs: this.ageMs(user.created_at),
        isNewDevice,
      },
      this.config,
    );
    await this.persist(userId, "login", result);
    return result;
  }

  /** Score a trade-open request; amount judged against the KYC tier max trade. */
  async scoreTradeOpen(userId: string, amount: bigint): Promise<RiskScore> {
    const user = await this.loadUser(userId);
    const { maxTrade } = await this.settings.kycTierLimits(user.kyc_tier);
    const eventsThisHour = await this.velocity("trade_open", userId);
    const result = computeScore(
      {
        kind: "trade_open",
        eventsThisHour,
        amount,
        tierLimit: maxTrade,
        accountAgeMs: this.ageMs(user.created_at),
        isNewDevice: false,
      },
      this.config,
    );
    await this.persist(userId, "trade_open", result);
    return result;
  }

  /** Score a withdrawal request; amount judged against the tier DAILY limit. */
  async scoreWithdrawal(userId: string, amount: bigint): Promise<RiskScore> {
    const user = await this.loadUser(userId);
    const { dailyWithdrawal } = await this.settings.kycTierLimits(user.kyc_tier);
    const eventsThisHour = await this.velocity("withdrawal", userId);
    const result = computeScore(
      {
        kind: "withdrawal",
        eventsThisHour,
        amount,
        tierLimit: dailyWithdrawal,
        accountAgeMs: this.ageMs(user.created_at),
        isNewDevice: false,
      },
      this.config,
    );
    await this.persist(userId, "withdrawal", result);
    return result;
  }

  private async loadUser(userId: string): Promise<{ created_at: Date; kyc_tier: number }> {
    const user = await this.db
      .selectFrom("users")
      .select(["created_at", "kyc_tier"])
      .where("id", "=", userId)
      .executeTakeFirst();
    if (!user) throw new RiskSubjectNotFoundError(userId);
    return user;
  }

  private ageMs(createdAt: Date): number {
    return Math.max(0, Date.now() - createdAt.getTime());
  }

  /**
   * Velocity = events this hour, current one included. Primary counter is a
   * Redis INCR with EXPIRE (risk:wd:{userId}:{hour}); if Redis is unavailable
   * we fall back to counting persisted rows in the DB (+1 for this event).
   */
  private async velocity(kind: RiskKind, userId: string): Promise<number> {
    const hourBucket = Math.floor(Date.now() / HOUR_MS);
    const key = `risk:${VELOCITY_KEY_SEGMENT[kind]}:${userId}:${hourBucket}`;
    try {
      const count = await this.redis.incr(key);
      await this.redis.expire(key, VELOCITY_TTL_SECONDS);
      return count;
    } catch {
      this.logger.warn(`redis velocity counter unavailable — using db fallback for ${kind}`);
      return (await this.dbEventsLastHour(kind, userId)) + 1;
    }
  }

  /** DB fallback counts — persisted rows for this user in the last hour. */
  private async dbEventsLastHour(kind: RiskKind, userId: string): Promise<number> {
    const since = new Date(Date.now() - HOUR_MS);
    if (kind === "withdrawal") {
      const row = await this.db
        .selectFrom("withdrawals")
        .select((eb) => eb.fn.countAll<bigint>().as("n"))
        .where("user_id", "=", userId)
        .where("created_at", ">=", since)
        .executeTakeFirstOrThrow();
      return Number(row.n);
    }
    if (kind === "trade_open") {
      const row = await this.db
        .selectFrom("trades")
        .select((eb) => eb.fn.countAll<bigint>().as("n"))
        .where((eb) => eb.or([eb("buyer_id", "=", userId), eb("seller_id", "=", userId)]))
        .where("created_at", ">=", since)
        .executeTakeFirstOrThrow();
      return Number(row.n);
    }
    const row = await this.db
      .selectFrom("sessions")
      .select((eb) => eb.fn.countAll<bigint>().as("n"))
      .where("user_id", "=", userId)
      .where("created_at", ">=", since)
      .executeTakeFirstOrThrow();
    return Number(row.n);
  }

  /**
   * New device = a fingerprint was presented and no session of this user has
   * ever carried it. (If the caller creates the session row BEFORE scoring,
   * it must call scoreLogin first — otherwise the flag can never trigger.)
   */
  private async isNewDevice(userId: string, fingerprint: string | null): Promise<boolean> {
    if (!fingerprint) return false;
    const seen = await this.db
      .selectFrom("sessions")
      .select("id")
      .where("user_id", "=", userId)
      .where("device_fingerprint", "=", fingerprint)
      .limit(1)
      .executeTakeFirst();
    return seen === undefined;
  }

  /**
   * Persist the risk event and apply consequences atomically:
   * escalate → outbox risk.flagged; freeze → users.status=frozen (from active
   * only) + hash-chained audit row + outbox user.frozen, all in ONE tx.
   */
  private async persist(userId: string, kind: RiskKind, result: RiskScore): Promise<void> {
    const action = actionForScore(result.score, this.config);
    await this.db.transaction().execute(async (trx) => {
      await trx
        .insertInto("risk_events")
        .values({
          id: newId(),
          user_id: userId,
          kind,
          score: result.score,
          flags: JSON.stringify(result.flags),
          action_taken: action,
        })
        .execute();

      if (action === "none") return;

      await trx
        .insertInto("outbox")
        .values({
          id: newId(),
          event_type: "risk.flagged",
          payload: JSON.stringify({
            userId,
            kind,
            score: result.score,
            rules: Object.keys(result.flags),
          }),
        })
        .execute();

      if (action !== "freeze") return;

      const frozen = await trx
        .updateTable("users")
        .set({ status: "frozen", updated_at: new Date() })
        .where("id", "=", userId)
        .where("status", "=", "active")
        .executeTakeFirst();
      if (frozen.numUpdatedRows === 0n) return; // already frozen/suspended/closed

      await this.audit.log(
        {
          actorType: "system",
          actorId: null,
          action: "risk.auto_freeze",
          targetType: "user",
          targetId: userId,
          metadata: { kind, score: result.score, rules: Object.keys(result.flags) },
        },
        trx,
      );

      await trx
        .insertInto("outbox")
        .values({
          id: newId(),
          event_type: "user.frozen",
          payload: JSON.stringify({
            userId,
            reason: "risk_auto_freeze",
            kind,
            score: result.score,
          }),
        })
        .execute();

      this.logger.warn(`user ${userId} auto-frozen by risk (${kind}, score ${result.score})`);
    });
  }
}
