import { createHash, randomBytes, randomInt, timingSafeEqual } from "node:crypto";
import { Inject, Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import * as argon2 from "argon2";
import { sql, type Kysely, type Transaction } from "kysely";
import type { LoginRequest, RegisterRequest, RegisterResponse } from "@quatatrade/shared";
import { DB } from "../../db/database.module";
import type { Database } from "../../db/types";
import type { Env } from "../../config/env";
import { newId } from "../../common/ids";
import { AuditService } from "../../common/audit/audit.service";
import type { AccessTokenPayload } from "../../common/auth/jwt.types";
import { TotpService } from "./totp.service";
import { RiskService } from "../risk/risk.service";
import { InvalidCodeError, InvalidCredentialsError, InvalidTokenError } from "./auth.errors";

const EMAIL_OTP_TTL_MS = 15 * 60_000;
const RESET_TOKEN_TTL_MS = 30 * 60_000;
const MAX_OTP_ATTEMPTS = 5;
const MAX_LOGIN_FAILURES = 5;
const LOGIN_LOCK_MS = 15 * 60_000;
/** Withdrawals are held for 24h after a credential change (password reset) — takeover defense. */
const WITHDRAWAL_HOLD_AFTER_CREDENTIAL_CHANGE_MS = 24 * 60 * 60 * 1000;
const REFRESH_TOKEN_BYTES = 48;
const UNIQUE_VIOLATION = "23505";

export interface RequestMeta {
  ip: string | null;
  userAgent: string | null;
  deviceFingerprint: string | null;
}

export interface IssuedTokens {
  accessToken: string;
  accessTokenExpiresIn: number;
  /** raw refresh token — travels ONLY in the httpOnly cookie, never the body */
  refreshToken: string;
  refreshExpiresAt: Date;
}

export type LoginOutcome = { totpRequired: true } | ({ totpRequired: false } & IssuedTokens);

export function sha256Hex(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function hashMatches(storedHex: string, candidate: string): boolean {
  const stored = Buffer.from(storedHex, "hex");
  const actual = createHash("sha256").update(candidate).digest();
  return stored.length === actual.length && timingSafeEqual(stored, actual);
}

function pgCode(err: unknown): string | undefined {
  if (typeof err === "object" && err !== null && "code" in err) {
    const code = (err as { code?: unknown }).code;
    return typeof code === "string" ? code : undefined;
  }
  return undefined;
}

/**
 * auth — Documents/06 "auth" section, Phase 2.
 * argon2id everywhere; access JWT ≤10 min; rotating hashed refresh tokens with
 * reuse detection; generic failures (no user enumeration); everything audited.
 */
@Injectable()
export class AuthService {
  /** lazily-built argon2 hash used to equalize timing for unknown emails */
  private timingEqualizerHash: string | null = null;

  constructor(
    @Inject(DB) private readonly db: Kysely<Database>,
    private readonly jwt: JwtService,
    private readonly config: ConfigService<Env, true>,
    private readonly audit: AuditService,
    private readonly totp: TotpService,
    private readonly risk: RiskService,
  ) {}

  // ── register ────────────────────────────────────────────────────────────

  async register(dto: RegisterRequest, meta: RequestMeta): Promise<RegisterResponse> {
    // hash BEFORE the duplicate check so both paths cost the same (no timing enumeration)
    const passwordHash = await argon2.hash(dto.password, { type: argon2.argon2id });
    const userId = newId();
    const otp = String(randomInt(0, 1_000_000)).padStart(6, "0");

    try {
      await this.db.transaction().execute(async (trx) => {
        await trx
          .insertInto("users")
          .values({
            id: userId,
            email: dto.email,
            phone: dto.phone ?? null,
            password_hash: passwordHash,
            pin_hash: null,
            first_name: dto.firstName ?? null,
            last_name: dto.lastName ?? null,
            country: dto.country,
            totp_secret_enc: null,
          })
          .execute();
        await trx
          .insertInto("auth_tokens")
          .values({
            id: newId(),
            user_id: userId,
            kind: "email_otp",
            token_hash: sha256Hex(otp),
            expires_at: new Date(Date.now() + EMAIL_OTP_TTL_MS),
          })
          .execute();
        // the OTP travels to the user ONLY via the notify pipeline
        await trx
          .insertInto("notifications")
          .values({
            id: newId(),
            user_id: userId,
            channel: "email",
            template: "email_verify",
            payload: JSON.stringify({ code: otp }),
          })
          .execute();
        await trx
          .insertInto("outbox")
          .values({ id: newId(), event_type: "user.registered", payload: JSON.stringify({ userId }) })
          .execute();
        await this.audit.log(
          {
            actorType: "user",
            actorId: userId,
            action: "auth.register",
            targetType: "user",
            targetId: userId,
            ip: meta.ip ?? undefined,
          },
          trx,
        );
      });
    } catch (err) {
      if (pgCode(err) === UNIQUE_VIOLATION) {
        // email/phone already registered: identical success shape, nothing
        // persisted, opaque id — an attacker learns nothing (Documents/08 §E)
        return { userId: newId(), emailVerificationRequired: true };
      }
      throw err;
    }
    return { userId, emailVerificationRequired: true };
  }

  // ── email verification ──────────────────────────────────────────────────

  async verifyEmail(email: string, code: string): Promise<void> {
    const now = new Date();
    const verified = await this.db.transaction().execute(async (trx) => {
      const user = await trx
        .selectFrom("users")
        .select(["id", "email_verified_at"])
        .where("email", "=", email)
        .executeTakeFirst();
      if (!user) return false;

      const token = await trx
        .selectFrom("auth_tokens")
        .select(["id", "token_hash", "attempts"])
        .where("user_id", "=", user.id)
        .where("kind", "=", "email_otp")
        .where("consumed_at", "is", null)
        .where("expires_at", ">", now)
        .orderBy("created_at", "desc")
        .limit(1)
        .forUpdate()
        .executeTakeFirst();
      if (!token || token.attempts >= MAX_OTP_ATTEMPTS) return false;

      if (!hashMatches(token.token_hash, code)) {
        // commit the attempt counter even though verification failed
        await trx
          .updateTable("auth_tokens")
          .set((eb) => ({ attempts: eb("attempts", "+", 1) }))
          .where("id", "=", token.id)
          .execute();
        return false;
      }

      await trx.updateTable("auth_tokens").set({ consumed_at: now }).where("id", "=", token.id).execute();
      if (!user.email_verified_at) {
        await trx
          .updateTable("users")
          .set({ email_verified_at: now, updated_at: now })
          .where("id", "=", user.id)
          .execute();
      }
      await this.audit.log(
        { actorType: "user", actorId: user.id, action: "auth.email_verified", targetType: "user", targetId: user.id },
        trx,
      );
      return true;
    });
    if (!verified) throw new InvalidCodeError();
  }

  // ── login ───────────────────────────────────────────────────────────────

  async login(dto: LoginRequest, meta: RequestMeta): Promise<LoginOutcome> {
    const user = await this.db.selectFrom("users").selectAll().where("email", "=", dto.email).executeTakeFirst();

    if (!user) {
      // burn the same argon2 time an existing user would cost — no timing oracle
      await argon2.verify(await this.equalizerHash(), dto.password).catch(() => false);
      await this.audit.log({
        actorType: "system",
        actorId: null,
        action: "auth.login_failed",
        metadata: { reason: "unknown_user" },
        ip: meta.ip ?? undefined,
      });
      throw new InvalidCredentialsError();
    }

    if (user.locked_until && user.locked_until.getTime() > Date.now()) {
      await this.audit.log({
        actorType: "user",
        actorId: user.id,
        action: "auth.login_failed",
        targetType: "user",
        targetId: user.id,
        metadata: { reason: "locked" },
        ip: meta.ip ?? undefined,
      });
      throw new InvalidCredentialsError();
    }

    if (user.status === "closed") {
      await this.audit.log({
        actorType: "user",
        actorId: user.id,
        action: "auth.login_failed",
        targetType: "user",
        targetId: user.id,
        metadata: { reason: "account_closed" },
        ip: meta.ip ?? undefined,
      });
      throw new InvalidCredentialsError();
    }

    const passwordOk = await argon2.verify(user.password_hash, dto.password).catch(() => false);
    if (!passwordOk) {
      await this.recordLoginFailure(user.id, "bad_password", meta);
      throw new InvalidCredentialsError();
    }

    if (user.totp_enabled) {
      // password valid, code missing → 200 with totpRequired (client asks for the code)
      if (!dto.totpCode) return { totpRequired: true };
      if (!user.totp_secret_enc || !this.totp.checkEncrypted(user.totp_secret_enc, dto.totpCode)) {
        await this.recordLoginFailure(user.id, "bad_totp", meta);
        throw new InvalidCredentialsError();
      }
    }

    // Deterministic risk scoring on a successful auth: monitoring + new-device
    // detection + auto-freeze on egregious patterns. Scored BEFORE the session row
    // exists so isNewDevice can fire. Fail-open — never block a valid login on a
    // scoring hiccup; a committed auto-freeze still blocks money ops downstream.
    await this.risk
      .scoreLogin(user.id, { ip: meta.ip, deviceFingerprint: dto.deviceFingerprint ?? null })
      .catch(() => undefined);

    const loginMeta: RequestMeta = { ...meta, deviceFingerprint: dto.deviceFingerprint ?? null };
    return this.db.transaction().execute(async (trx) => {
      await trx
        .updateTable("users")
        .set({ failed_login_attempts: 0, locked_until: null, updated_at: new Date() })
        .where("id", "=", user.id)
        .execute();
      const tokens = await this.issueSession(trx, user.id, loginMeta, null);
      await trx
        .insertInto("outbox")
        .values({ id: newId(), event_type: "user.login", payload: JSON.stringify({ userId: user.id }) })
        .execute();
      await this.audit.log(
        {
          actorType: "user",
          actorId: user.id,
          action: "auth.login",
          targetType: "user",
          targetId: user.id,
          ip: meta.ip ?? undefined,
        },
        trx,
      );
      return { totpRequired: false as const, ...tokens };
    });
  }

  private async equalizerHash(): Promise<string> {
    if (!this.timingEqualizerHash) {
      this.timingEqualizerHash = await argon2.hash(`equalizer-${newId()}`, { type: argon2.argon2id });
    }
    return this.timingEqualizerHash;
  }

  private async recordLoginFailure(userId: string, reason: string, meta: RequestMeta): Promise<void> {
    const row = await this.db
      .updateTable("users")
      .set((eb) => ({ failed_login_attempts: eb("failed_login_attempts", "+", 1), updated_at: new Date() }))
      .where("id", "=", userId)
      .returning(["failed_login_attempts"])
      .executeTakeFirst();
    const attempts = row?.failed_login_attempts ?? 0;
    const locked = attempts >= MAX_LOGIN_FAILURES;
    if (locked) {
      await this.db
        .updateTable("users")
        .set({
          locked_until: new Date(Date.now() + LOGIN_LOCK_MS),
          failed_login_attempts: 0,
          updated_at: new Date(),
        })
        .where("id", "=", userId)
        .execute();
    }
    await this.db
      .insertInto("outbox")
      .values({ id: newId(), event_type: "user.login_failed", payload: JSON.stringify({ userId, reason }) })
      .execute();
    await this.audit.log({
      actorType: "user",
      actorId: userId,
      action: "auth.login_failed",
      targetType: "user",
      targetId: userId,
      metadata: { reason },
      ip: meta.ip ?? undefined,
    });
    if (locked) {
      await this.audit.log({
        actorType: "system",
        actorId: null,
        action: "auth.lockout",
        targetType: "user",
        targetId: userId,
        metadata: { minutes: LOGIN_LOCK_MS / 60_000 },
      });
    }
  }

  // ── sessions: issue / refresh (rotation + reuse detection) / logout ─────

  private async issueSession(
    trx: Transaction<Database>,
    userId: string,
    meta: RequestMeta,
    rotatedFrom: string | null,
  ): Promise<IssuedTokens> {
    const sessionId = newId();
    const refreshToken = randomBytes(REFRESH_TOKEN_BYTES).toString("hex");
    const ttlDays = this.config.get("REFRESH_TTL_DAYS", { infer: true });
    const refreshExpiresAt = new Date(Date.now() + ttlDays * 86_400_000);

    await trx
      .insertInto("sessions")
      .values({
        id: sessionId,
        user_id: userId,
        refresh_hash: sha256Hex(refreshToken),
        device_fingerprint: meta.deviceFingerprint,
        ip: meta.ip,
        user_agent: meta.userAgent,
        expires_at: refreshExpiresAt,
        rotated_from: rotatedFrom,
      })
      .execute();

    const payload: AccessTokenPayload = { sub: userId, typ: "user", sid: sessionId };
    const accessToken = await this.jwt.signAsync(payload);
    return {
      accessToken,
      accessTokenExpiresIn: this.config.get("JWT_ACCESS_TTL_SECONDS", { infer: true }),
      refreshToken,
      refreshExpiresAt,
    };
  }

  async refresh(rawToken: string | undefined, meta: RequestMeta): Promise<IssuedTokens> {
    if (!rawToken || rawToken.length < 32) throw new InvalidTokenError();

    const session = await this.db
      .selectFrom("sessions")
      .selectAll()
      .where("refresh_hash", "=", sha256Hex(rawToken))
      .executeTakeFirst();
    if (!session) throw new InvalidTokenError();

    if (session.revoked_at) {
      // REUSE DETECTION: a rotated-away token came back → someone replayed it.
      // Kill the whole rotation chain so the thief's live token dies too.
      await this.revokeSessionChain(session.id, session.user_id, "revoked_token_replayed");
      throw new InvalidTokenError();
    }
    if (session.expires_at.getTime() <= Date.now()) throw new InvalidTokenError();

    const rotateMeta: RequestMeta = { ...meta, deviceFingerprint: meta.deviceFingerprint ?? session.device_fingerprint };
    const rotated = await this.db.transaction().execute(async (trx) => {
      // guarded revoke — exactly ONE rotation can win even under a concurrent replay
      const res = await trx
        .updateTable("sessions")
        .set({ revoked_at: new Date() })
        .where("id", "=", session.id)
        .where("revoked_at", "is", null)
        .executeTakeFirst();
      if (res.numUpdatedRows === 0n) return null;
      return this.issueSession(trx, session.user_id, rotateMeta, session.id);
    });
    if (!rotated) {
      await this.revokeSessionChain(session.id, session.user_id, "concurrent_rotation");
      throw new InvalidTokenError();
    }
    return rotated;
  }

  /** Revoke every session linked to `sessionId` through rotated_from (both directions). */
  private async revokeSessionChain(sessionId: string, userId: string, why: string): Promise<void> {
    await sql`
      WITH RECURSIVE fwd AS (
        SELECT id, rotated_from FROM sessions WHERE id = ${sessionId}
        UNION ALL
        SELECT s.id, s.rotated_from FROM sessions s JOIN fwd f ON s.rotated_from = f.id
      ), bwd AS (
        SELECT id, rotated_from FROM sessions WHERE id = ${sessionId}
        UNION ALL
        SELECT s.id, s.rotated_from FROM sessions s JOIN bwd b ON b.rotated_from = s.id
      )
      UPDATE sessions SET revoked_at = now()
      WHERE revoked_at IS NULL
        AND id IN (SELECT id FROM fwd UNION SELECT id FROM bwd)
    `.execute(this.db);
    await this.audit.log({
      actorType: "system",
      actorId: null,
      action: "session.reuse_detected",
      targetType: "user",
      targetId: userId,
      metadata: { sessionId, why },
    });
  }

  async logout(userId: string, sessionId: string | undefined): Promise<void> {
    if (sessionId) {
      await this.db
        .updateTable("sessions")
        .set({ revoked_at: new Date() })
        .where("id", "=", sessionId)
        .where("user_id", "=", userId) // scope to owner — sid comes from the JWT anyway
        .where("revoked_at", "is", null)
        .execute();
    }
    await this.audit.log({
      actorType: "user",
      actorId: userId,
      action: "auth.logout",
      targetType: "user",
      targetId: userId,
    });
  }

  // ── password reset ──────────────────────────────────────────────────────

  /** Always resolves — response never reveals whether the email exists. */
  async forgotPassword(email: string, meta: RequestMeta): Promise<void> {
    const user = await this.db.selectFrom("users").select(["id"]).where("email", "=", email).executeTakeFirst();
    if (!user) return;

    const token = randomBytes(48).toString("hex");
    await this.db.transaction().execute(async (trx) => {
      await trx
        .insertInto("auth_tokens")
        .values({
          id: newId(),
          user_id: user.id,
          kind: "password_reset",
          token_hash: sha256Hex(token),
          expires_at: new Date(Date.now() + RESET_TOKEN_TTL_MS),
        })
        .execute();
      // raw token reaches the user only via the notify pipeline
      await trx
        .insertInto("notifications")
        .values({
          id: newId(),
          user_id: user.id,
          channel: "email",
          template: "password_reset",
          payload: JSON.stringify({ token }),
        })
        .execute();
      await this.audit.log(
        {
          actorType: "user",
          actorId: user.id,
          action: "auth.password_reset_requested",
          targetType: "user",
          targetId: user.id,
          ip: meta.ip ?? undefined,
        },
        trx,
      );
    });
  }

  /** Single-use token; success revokes ALL sessions (stolen-session kill switch). */
  async resetPassword(rawToken: string, newPassword: string): Promise<void> {
    const newHash = await argon2.hash(newPassword, { type: argon2.argon2id });
    const now = new Date();

    const ok = await this.db.transaction().execute(async (trx) => {
      const token = await trx
        .selectFrom("auth_tokens")
        .select(["id", "user_id"])
        .where("kind", "=", "password_reset")
        .where("token_hash", "=", sha256Hex(rawToken))
        .where("consumed_at", "is", null)
        .where("expires_at", ">", now)
        .forUpdate()
        .executeTakeFirst();
      if (!token) return false;

      // guarded consume — single-use even under a concurrent replay
      const consumed = await trx
        .updateTable("auth_tokens")
        .set({ consumed_at: now })
        .where("id", "=", token.id)
        .where("consumed_at", "is", null)
        .executeTakeFirst();
      if (consumed.numUpdatedRows === 0n) return false;

      await trx
        .updateTable("users")
        .set({
          password_hash: newHash,
          failed_login_attempts: 0,
          locked_until: null,
          withdrawal_hold_until: new Date(now.getTime() + WITHDRAWAL_HOLD_AFTER_CREDENTIAL_CHANGE_MS),
          updated_at: now,
        })
        .where("id", "=", token.user_id)
        .execute();
      await trx
        .updateTable("sessions")
        .set({ revoked_at: now })
        .where("user_id", "=", token.user_id)
        .where("revoked_at", "is", null)
        .execute();
      await this.audit.log(
        {
          actorType: "user",
          actorId: token.user_id,
          action: "auth.password_reset",
          targetType: "user",
          targetId: token.user_id,
        },
        trx,
      );
      return true;
    });
    if (!ok) throw new InvalidTokenError();
  }
}
