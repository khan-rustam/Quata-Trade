import { createHash, randomBytes } from "node:crypto";
import { Inject, Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import { sql, type Kysely, type Transaction } from "kysely";
import { AuditService } from "../../common/audit/audit.service";
import type { AccessTokenPayload } from "../../common/auth/jwt.types";
import { newId } from "../../common/ids";
import { DB } from "../../db/database.module";
import type { Database } from "../../db/types";
import type { Env } from "../../config/env";
import { AdminAuthError } from "./admin.errors";

/**
 * Rotating refresh sessions for the admin panel.
 *
 * ## Why this exists (reverses Documents/10 D20)
 *
 * D20 gave admins a 10-minute access token and no refresh, reasoning that
 * fewer long-lived credentials for the highest-privilege principals is safer.
 * That reasoning is right about credentials and wrong about people: it logged
 * admins out several times an hour, mid-task, and the failure surfaced as an
 * unexplained error rather than "your session expired". The observed result
 * was an admin re-typing a SUPER_ADMIN password many times a day — which is a
 * worse security posture than one rotating credential, because it is exactly
 * the reflex phishing relies on.
 *
 * So: the access token stays short (unchanged, memory only). The session that
 * survives a page refresh is a rotating refresh token that never touches
 * JavaScript.
 *
 * ## The four properties that make a 24-hour session defensible
 *
 * - **httpOnly** — the controller sets it as an httpOnly, Secure,
 *   SameSite=strict cookie scoped to the admin auth path. XSS cannot read it,
 *   which is the entire difference between this and a token in localStorage.
 * - **Rotated on every use** — each refresh mints a new token and revokes the
 *   old one, so a captured token has a useful life measured in minutes.
 * - **Reuse detection** — a revoked token coming back means someone replayed
 *   a copy. That kills the whole rotation chain, including the thief's live
 *   token. A stolen session is therefore self-limiting: using it is what
 *   destroys it.
 * - **Revocable and re-checked** — every refresh re-reads the admin row. An
 *   admin who is deactivated mid-session cannot mint another access token,
 *   which a self-contained 24-hour JWT could not offer at any price.
 *
 * This is the same algorithm as `AuthService`'s user sessions, deliberately.
 * Two implementations of session rotation is one implementation too many.
 */

/** 32 bytes → 64 hex chars. The token is a bearer secret; entropy is the point. */
const REFRESH_TOKEN_BYTES = 32;

function sha256Hex(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

export interface AdminSessionTokens {
  accessToken: string;
  accessTokenExpiresIn: number;
  /** Raw refresh token — travels ONLY in the httpOnly cookie, never a body. */
  refreshToken: string;
  refreshExpiresAt: Date;
}

export interface AdminRequestMeta {
  ip: string | null;
  userAgent: string | null;
}

@Injectable()
export class AdminSessionService {
  constructor(
    @Inject(DB) private readonly db: Kysely<Database>,
    private readonly jwt: JwtService,
    private readonly config: ConfigService<Env, true>,
    private readonly audit: AuditService,
  ) {}

  private ttlMs(): number {
    return this.config.get("ADMIN_SESSION_TTL_HOURS", { infer: true }) * 3_600_000;
  }

  /**
   * Mint a session. Called on login, and again on every rotation with
   * `rotatedFrom` set so the chain stays walkable.
   *
   * The refresh lifetime is ABSOLUTE, not sliding: a rotation inherits the
   * original deadline rather than extending it. A sliding window would let an
   * attacker with a live token keep the session alive forever by refreshing,
   * which quietly turns a 24-hour session into a permanent one.
   */
  async issue(
    trx: Transaction<Database> | Kysely<Database>,
    adminId: string,
    meta: AdminRequestMeta,
    rotatedFrom: string | null,
    inheritedExpiry?: Date,
  ): Promise<AdminSessionTokens> {
    const sessionId = newId();
    const refreshToken = randomBytes(REFRESH_TOKEN_BYTES).toString("hex");
    const refreshExpiresAt = inheritedExpiry ?? new Date(Date.now() + this.ttlMs());

    await trx
      .insertInto("admin_sessions")
      .values({
        id: sessionId,
        admin_id: adminId,
        refresh_hash: sha256Hex(refreshToken),
        ip: meta.ip,
        user_agent: meta.userAgent,
        expires_at: refreshExpiresAt,
        rotated_from: rotatedFrom,
      })
      .execute();

    const admin = await trx
      .selectFrom("admins")
      .select(["role"])
      .where("id", "=", adminId)
      .executeTakeFirst();
    if (!admin) throw new AdminAuthError();

    const payload: AccessTokenPayload = {
      sub: adminId,
      typ: "admin",
      role: admin.role,
    };
    return {
      accessToken: await this.jwt.signAsync(payload),
      accessTokenExpiresIn: this.config.get("JWT_ACCESS_TTL_SECONDS", {
        infer: true,
      }),
      refreshToken,
      refreshExpiresAt,
    };
  }

  /**
   * Open a brand-new session at login. Thin wrapper over `issue` so the
   * controller never touches the service's database handle — a controller
   * holding a Kysely instance is how transaction boundaries start leaking
   * into HTTP code.
   */
  async open(adminId: string, meta: AdminRequestMeta): Promise<AdminSessionTokens> {
    return this.issue(this.db, adminId, meta, null);
  }

  /**
   * Exchange a refresh token for a fresh pair, rotating the session.
   *
   * Every failure path throws the same `AdminAuthError`. The caller must not
   * distinguish "unknown token" from "expired" from "replayed" — that
   * difference is exactly what an attacker probing a stolen cookie wants to
   * learn.
   */
  async refresh(
    rawToken: string | undefined,
    meta: AdminRequestMeta,
  ): Promise<AdminSessionTokens> {
    if (!rawToken || rawToken.length < 32) throw new AdminAuthError();

    const session = await this.db
      .selectFrom("admin_sessions")
      .selectAll()
      .where("refresh_hash", "=", sha256Hex(rawToken))
      .executeTakeFirst();
    if (!session) throw new AdminAuthError();

    if (session.revoked_at) {
      // REUSE DETECTION. A rotated-away token came back, so a copy exists.
      // Kill the entire chain — the thief's currently-valid token dies with it.
      await this.revokeChain(session.id, session.admin_id, "revoked_token_replayed");
      throw new AdminAuthError();
    }
    if (session.expires_at.getTime() <= Date.now()) throw new AdminAuthError();

    // Re-read the admin every time. A deactivated admin must not be able to
    // mint another access token, and this re-check is the whole reason a
    // rotating session beats a long self-contained JWT.
    const admin = await this.db
      .selectFrom("admins")
      .select(["active"])
      .where("id", "=", session.admin_id)
      .executeTakeFirst();
    if (!admin || !admin.active) {
      await this.revokeChain(session.id, session.admin_id, "admin_not_active");
      throw new AdminAuthError();
    }

    const rotated = await this.db.transaction().execute(async (trx) => {
      // Guarded revoke: `WHERE revoked_at IS NULL` means exactly one rotation
      // can win even if two requests race on the same token. The loser gets
      // null and is treated as a replay below.
      const res = await trx
        .updateTable("admin_sessions")
        .set({ revoked_at: new Date() })
        .where("id", "=", session.id)
        .where("revoked_at", "is", null)
        .executeTakeFirst();
      if (res.numUpdatedRows === 0n) return null;
      // Absolute expiry: inherit, never extend.
      return this.issue(trx, session.admin_id, meta, session.id, session.expires_at);
    });

    if (!rotated) {
      await this.revokeChain(session.id, session.admin_id, "concurrent_rotation");
      throw new AdminAuthError();
    }
    return rotated;
  }

  /** End one session (logout). Idempotent — a second call is a no-op. */
  async revoke(rawToken: string | undefined): Promise<void> {
    if (!rawToken) return;
    await this.db
      .updateTable("admin_sessions")
      .set({ revoked_at: new Date() })
      .where("refresh_hash", "=", sha256Hex(rawToken))
      .where("revoked_at", "is", null)
      .execute();
  }

  /** End every session for an admin — used when an account is deactivated. */
  async revokeAllForAdmin(adminId: string, why: string): Promise<void> {
    await this.db
      .updateTable("admin_sessions")
      .set({ revoked_at: new Date() })
      .where("admin_id", "=", adminId)
      .where("revoked_at", "is", null)
      .execute();
    await this.audit.log({
      actorType: "system",
      actorId: null,
      action: "admin.sessions.revoked_all",
      targetType: "admin",
      targetId: adminId,
      metadata: { reason: why },
    });
  }

  /**
   * Revoke every session reachable from `sessionId` through `rotated_from`,
   * in BOTH directions.
   *
   * Both directions matters: a replayed token might be an old link in the
   * chain (walk forward to reach the live one) or the newest (walk backward
   * to catch siblings). Killing only descendants would leave the token the
   * attacker is actually holding alive.
   */
  private async revokeChain(
    sessionId: string,
    adminId: string,
    why: string,
  ): Promise<void> {
    await sql`
      WITH RECURSIVE fwd AS (
        SELECT id, rotated_from FROM admin_sessions WHERE id = ${sessionId}
        UNION ALL
        SELECT s.id, s.rotated_from FROM admin_sessions s JOIN fwd f ON s.rotated_from = f.id
      ), bwd AS (
        SELECT id, rotated_from FROM admin_sessions WHERE id = ${sessionId}
        UNION ALL
        SELECT s.id, s.rotated_from FROM admin_sessions s JOIN bwd b ON b.rotated_from = s.id
      )
      UPDATE admin_sessions SET revoked_at = now()
      WHERE id IN (SELECT id FROM fwd UNION SELECT id FROM bwd)
        AND revoked_at IS NULL
    `.execute(this.db);

    // A replay is a security event, not a routine expiry — it means a token
    // left the browser it was issued to. It gets an audit row so someone can
    // see it happened.
    await this.audit.log({
      actorType: "system",
      actorId: null,
      action: "admin.session.chain_revoked",
      targetType: "admin",
      targetId: adminId,
      metadata: { reason: why },
    });
  }
}
