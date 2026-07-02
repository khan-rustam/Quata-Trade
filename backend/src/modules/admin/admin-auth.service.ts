import { Inject, Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import * as argon2 from "argon2";
import type { Kysely, Selectable } from "kysely";
import { authenticator } from "otplib";
import { RateLimiterMemory } from "rate-limiter-flexible";
import type { AdminLoginRequest, AdminProfile } from "@quatatrade/shared";
import { DB } from "../../db/database.module";
import type { AdminsTable, Database } from "../../db/types";
import type { Env } from "../../config/env";
import { newId } from "../../common/ids";
import { decryptSecret } from "../../common/crypto";
import { AuditService } from "../../common/audit/audit.service";
import type { AccessTokenPayload } from "../../common/auth/jwt.types";
import { AdminAuthError, AdminNotFoundError, AdminVerificationError } from "./admin.errors";

type AdminRow = Selectable<AdminsTable>;

export interface AdminTokens {
  accessToken: string;
  accessTokenExpiresIn: number;
}

const LOGIN_MAX_FAILURES = 5;
const LOGIN_WINDOW_SECONDS = 15 * 60;

/**
 * Admin authentication (Documents/06 "admin + treasury", 08 §E).
 * - argon2id password + MANDATORY TOTP (no optional path — schema enforces it).
 * - Short-lived admin JWT { sub, typ:"admin", role }. NO refresh token in v1:
 *   tokens live ≤10 min and admins re-login (documented deviation).
 * - Every login attempt outcome is hash-chain audit-logged; responses stay
 *   generic (no admin enumeration, no failure-cause oracle).
 * - Strict rate limit: 5 failures / 15 min per email (in-memory, per process)
 *   on top of the route-level throttler.
 */
@Injectable()
export class AdminAuthService {
  /** lazily-built argon2 hash to equalize timing for unknown emails */
  private timingEqualizerHash: string | null = null;

  private readonly loginLimiter = new RateLimiterMemory({
    keyPrefix: "admin_login",
    points: LOGIN_MAX_FAILURES,
    duration: LOGIN_WINDOW_SECONDS,
    blockDuration: LOGIN_WINDOW_SECONDS,
  });

  constructor(
    @Inject(DB) private readonly db: Kysely<Database>,
    private readonly jwt: JwtService,
    private readonly config: ConfigService<Env, true>,
    private readonly audit: AuditService,
  ) {}

  // ── login ────────────────────────────────────────────────────────────────

  async login(dto: AdminLoginRequest, ip: string | null): Promise<AdminTokens> {
    const limiterKey = dto.email; // zod already lower-cased it

    const bucket = await this.loginLimiter.get(limiterKey);
    if (bucket !== null && bucket.remainingPoints <= 0) {
      await this.auditLoginFailure(null, "rate_limited", ip);
      throw new AdminAuthError();
    }

    const admin = await this.db.selectFrom("admins").selectAll().where("email", "=", dto.email).executeTakeFirst();

    if (!admin) {
      // burn the same argon2 time a real admin would cost — no timing oracle
      await argon2.verify(await this.equalizerHash(), dto.password).catch(() => false);
      await this.loginFailed(limiterKey, null, "unknown_email", ip);
      throw new AdminAuthError();
    }
    if (!admin.active) {
      await argon2.verify(await this.equalizerHash(), dto.password).catch(() => false);
      await this.loginFailed(limiterKey, admin.id, "inactive", ip);
      throw new AdminAuthError();
    }

    const passwordOk = await argon2.verify(admin.password_hash, dto.password).catch(() => false);
    if (!passwordOk) {
      await this.loginFailed(limiterKey, admin.id, "bad_password", ip);
      throw new AdminAuthError();
    }

    // TOTP is MANDATORY for admins — there is no fallback path.
    if (!this.totpMatches(admin, dto.totpCode)) {
      await this.loginFailed(limiterKey, admin.id, "bad_totp", ip);
      throw new AdminAuthError();
    }

    await this.loginLimiter.delete(limiterKey);

    const payload: AccessTokenPayload = { sub: admin.id, typ: "admin", role: admin.role };
    const accessToken = await this.jwt.signAsync(payload);
    await this.audit.log({
      actorType: "admin",
      actorId: admin.id,
      action: "admin.login",
      targetType: "admin",
      targetId: admin.id,
      ip: ip ?? undefined,
    });

    return {
      accessToken,
      accessTokenExpiresIn: this.config.get("JWT_ACCESS_TTL_SECONDS", { infer: true }),
    };
  }

  // ── step-up verification for sensitive actions ───────────────────────────

  /**
   * Verify the admin's OWN TOTP code before a sensitive action (withdrawal
   * approve/reject, kill switch, settings edit, ledger adjustment).
   * Failure is generic; the attempt is audited with the action name only —
   * the code itself is never logged anywhere.
   */
  async verifyTotp(adminId: string, code: string, action: string, ip?: string): Promise<void> {
    const admin = await this.db.selectFrom("admins").selectAll().where("id", "=", adminId).executeTakeFirst();
    if (!admin || !admin.active || !this.totpMatches(admin, code)) {
      await this.audit.log({
        actorType: "admin",
        actorId: adminId,
        action: "admin.totp_failed",
        targetType: "admin",
        targetId: adminId,
        ip,
        metadata: { action },
      });
      throw new AdminVerificationError();
    }
  }

  // ── profile ──────────────────────────────────────────────────────────────

  async getProfile(adminId: string): Promise<AdminProfile> {
    const admin = await this.db
      .selectFrom("admins")
      .select(["id", "email", "role", "active"])
      .where("id", "=", adminId)
      .executeTakeFirst();
    if (!admin || !admin.active) throw new AdminNotFoundError();
    return { id: admin.id, email: admin.email, role: admin.role };
  }

  // ── private ──────────────────────────────────────────────────────────────

  private totpMatches(admin: AdminRow, code: string): boolean {
    let secret: string;
    try {
      secret = decryptSecret(admin.totp_secret_enc, this.config.get("MASTER_ENCRYPTION_KEY", { infer: true }));
    } catch {
      return false; // corrupt/foreign blob — same generic failure as a bad code
    }
    return authenticator.verify({ token: code, secret });
  }

  private async loginFailed(limiterKey: string, adminId: string | null, reason: string, ip: string | null): Promise<void> {
    await this.loginLimiter.consume(limiterKey).catch(() => undefined); // over-limit throw is irrelevant here
    await this.auditLoginFailure(adminId, reason, ip);
  }

  private async auditLoginFailure(adminId: string | null, reason: string, ip: string | null): Promise<void> {
    await this.audit.log({
      actorType: adminId ? "admin" : "system",
      actorId: adminId,
      action: "admin.login_failed",
      targetType: adminId ? "admin" : undefined,
      targetId: adminId ?? undefined,
      ip: ip ?? undefined,
      metadata: { reason },
    });
  }

  private async equalizerHash(): Promise<string> {
    if (!this.timingEqualizerHash) {
      this.timingEqualizerHash = await argon2.hash(`equalizer-${newId()}`, { type: argon2.argon2id });
    }
    return this.timingEqualizerHash;
  }
}
