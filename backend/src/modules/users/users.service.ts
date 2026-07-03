import { createHash, randomInt, timingSafeEqual } from "node:crypto";
import { Inject, Injectable, Logger } from "@nestjs/common";
import * as argon2 from "argon2";
import type { Kysely, Selectable } from "kysely";
import { reputationTier } from "@quatatrade/shared";
import type {
  AvatarStyle,
  PaymentAccounts,
  PublicTrader,
  Session,
  UpdatePaymentAccountsRequest,
  UpdateProfileRequest,
  UserProfile,
} from "@quatatrade/shared";
import { DB } from "../../db/database.module";
import type { Database, UsersTable } from "../../db/types";
import { AuditService } from "../../common/audit/audit.service";
import { MAILER, type Mailer } from "../notify/notify.mailer";
import { fetchTraders, type TraderStats } from "../offers/offers.mapper";
import { displayNameOf } from "../trades/trades.mapper";
import {
  EmailUnavailableError,
  InvalidEmailCodeError,
  SessionNotFoundError,
  UserNotActiveError,
  UserNotFoundError,
  WrongPasswordError,
} from "./users.errors";

type UserRow = Selectable<UsersTable>;

function toProfile(row: UserRow, stats: TraderStats): UserProfile {
  const terminalTotal = Math.max(1, stats.completed + stats.cancelled + stats.expired);
  const completionRate = Math.round((stats.completed / terminalTotal) * 100);
  return {
    id: row.id,
    email: row.email,
    phone: row.phone,
    firstName: row.first_name,
    lastName: row.last_name,
    displayName: row.display_name,
    bio: row.bio,
    avatarStyle: row.avatar_style as AvatarStyle | null, // constrained to AVATAR_STYLES on write
    avatarSeed: row.avatar_seed,
    country: row.country,
    emailVerified: row.email_verified_at !== null,
    phoneVerified: row.phone_verified_at !== null,
    pendingEmail: row.pending_email,
    kycTier: row.kyc_tier,
    kycStatus: row.kyc_status,
    totpEnabled: row.totp_enabled,
    pinSet: row.pin_hash !== null, // never expose the hash itself
    status: row.status,
    reputationScore: row.reputation_score,
    reputationTier: reputationTier(stats.completed, completionRate),
    completedTrades: stats.completed,
    completionRate,
    paymentAccounts: row.payment_accounts ?? {},
    createdAt: row.created_at.toISOString(),
  };
}

const EMPTY_STATS: TraderStats = { completed: 0, cancelled: 0, expired: 0 };
const EMAIL_CHANGE_TTL_MS = 15 * 60_000;

function sha256Hex(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}
function tokenMatches(storedHex: string, candidate: string): boolean {
  const stored = Buffer.from(storedHex, "hex");
  const actual = createHash("sha256").update(candidate).digest();
  return stored.length === actual.length && timingSafeEqual(stored, actual);
}
function isUniqueViolation(err: unknown): boolean {
  return typeof err === "object" && err !== null && "code" in err && (err as { code?: unknown }).code === "23505";
}

/**
 * users — profile + session self-management (Documents/06 "users").
 * Every query is scoped by the AUTHENTICATED user id — path/body ids are never
 * trusted for ownership (IDOR-proof, Documents/08 §E).
 */
@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(
    @Inject(DB) private readonly db: Kysely<Database>,
    private readonly audit: AuditService,
    @Inject(MAILER) private readonly mailer: Mailer,
  ) {}

  async getProfile(userId: string): Promise<UserProfile> {
    const row = await this.db.selectFrom("users").selectAll().where("id", "=", userId).executeTakeFirst();
    if (!row) throw new UserNotFoundError();
    const stats = (await fetchTraders(this.db, [userId])).get(userId)?.stats ?? EMPTY_STATS;
    return toProfile(row, stats);
  }

  async updateProfile(userId: string, dto: UpdateProfileRequest): Promise<UserProfile> {
    const hasChange =
      dto.firstName !== undefined ||
      dto.lastName !== undefined ||
      dto.displayName !== undefined ||
      dto.bio !== undefined ||
      dto.avatarStyle !== undefined ||
      dto.avatarSeed !== undefined;
    if (hasChange) {
      await this.db
        .updateTable("users")
        .set({
          ...(dto.firstName !== undefined ? { first_name: dto.firstName } : {}),
          ...(dto.lastName !== undefined ? { last_name: dto.lastName } : {}),
          ...(dto.displayName !== undefined ? { display_name: dto.displayName } : {}),
          ...(dto.bio !== undefined ? { bio: dto.bio } : {}),
          ...(dto.avatarStyle !== undefined ? { avatar_style: dto.avatarStyle } : {}),
          ...(dto.avatarSeed !== undefined ? { avatar_seed: dto.avatarSeed } : {}),
          updated_at: new Date(),
        })
        .where("id", "=", userId)
        .execute();
    }
    return this.getProfile(userId);
  }

  /** Merge in receiving accounts; a null value clears that method. Own-scoped by userId. */
  async updatePaymentAccounts(userId: string, dto: UpdatePaymentAccountsRequest): Promise<UserProfile> {
    const row = await this.db
      .selectFrom("users")
      .select("payment_accounts")
      .where("id", "=", userId)
      .executeTakeFirst();
    if (!row) throw new UserNotFoundError();
    const next: PaymentAccounts = { ...(row.payment_accounts ?? {}) };
    for (const [method, account] of Object.entries(dto.accounts)) {
      const key = method as keyof PaymentAccounts;
      if (account === null) delete next[key];
      else next[key] = account;
    }
    await this.db
      .updateTable("users")
      .set({ payment_accounts: JSON.stringify(next), updated_at: new Date() })
      .where("id", "=", userId)
      .execute();
    return this.getProfile(userId);
  }

  /**
   * Public merchant profile — whitelisted fields only (no email/phone/real name).
   * displayName resolves to the opt-in handle, else the privacy-masked name.
   */
  async getPublicTrader(userId: string): Promise<PublicTrader> {
    const row = await this.db
      .selectFrom("users")
      .select([
        "id",
        "first_name",
        "email",
        "display_name",
        "avatar_style",
        "avatar_seed",
        "bio",
        "reputation_score",
        "kyc_tier",
        "status",
        "created_at",
      ])
      .where("id", "=", userId)
      .executeTakeFirst();
    if (!row || row.status === "closed") throw new UserNotFoundError();

    const stats = (await fetchTraders(this.db, [userId])).get(userId)?.stats ?? EMPTY_STATS;
    const terminalTotal = Math.max(1, stats.completed + stats.cancelled + stats.expired);
    const completionRate = Math.round((stats.completed / terminalTotal) * 100);

    const offersCount = await this.db
      .selectFrom("offers")
      .select((eb) => eb.fn.countAll<bigint>().as("n"))
      .where("user_id", "=", userId)
      .where("status", "=", "ACTIVE")
      .executeTakeFirst();

    return {
      id: row.id,
      displayName: row.display_name ?? displayNameOf(row.first_name, row.email),
      avatarStyle: row.avatar_style as AvatarStyle | null,
      avatarSeed: row.avatar_seed,
      bio: row.bio,
      reputationScore: row.reputation_score,
      reputationTier: reputationTier(stats.completed, completionRate),
      completedTrades: stats.completed,
      completionRate,
      kycTier: row.kyc_tier,
      memberSince: row.created_at.toISOString(),
      activeOffers: Number(offersCount?.n ?? 0),
    };
  }

  /**
   * Start an email change: verify the password, ensure the new address is free,
   * then send a 6-digit confirmation code to the NEW address (stored hashed).
   * Delivery is direct (the queued-email job would target the CURRENT address).
   */
  async requestEmailChange(userId: string, newEmail: string, password: string): Promise<UserProfile> {
    const user = await this.db
      .selectFrom("users")
      .select(["email", "password_hash"])
      .where("id", "=", userId)
      .executeTakeFirst();
    if (!user) throw new UserNotFoundError();
    if (!(await argon2.verify(user.password_hash, password))) throw new WrongPasswordError();
    if (newEmail === user.email) throw new EmailUnavailableError();
    const taken = await this.db.selectFrom("users").select(["id"]).where("email", "=", newEmail).executeTakeFirst();
    if (taken) throw new EmailUnavailableError();

    const otp = String(randomInt(0, 1_000_000)).padStart(6, "0");
    await this.db
      .updateTable("users")
      .set({
        pending_email: newEmail,
        pending_email_token_hash: sha256Hex(otp),
        pending_email_expires_at: new Date(Date.now() + EMAIL_CHANGE_TTL_MS),
        updated_at: new Date(),
      })
      .where("id", "=", userId)
      .execute();
    await this.audit.log({
      actorType: "user",
      actorId: userId,
      action: "user.email_change_requested",
      targetType: "user",
      targetId: userId,
    });
    try {
      await this.mailer.send(
        newEmail,
        "Confirm your new QuataTrade email",
        `Your email change confirmation code is:\n\n    ${otp}\n\nEnter it in the app within 15 minutes to finish changing your email. If you didn't request this, you can ignore this message.`,
      );
    } catch (err) {
      this.logger.warn(`email-change code send failed: ${err instanceof Error ? err.message : "unknown error"}`);
    }
    return this.getProfile(userId);
  }

  /** Confirm the pending email with the code, swapping it in atomically. */
  async verifyEmailChange(userId: string, code: string): Promise<UserProfile> {
    const now = new Date();
    let outcome: "ok" | "invalid";
    try {
      outcome = await this.db.transaction().execute(async (trx) => {
        const u = await trx
          .selectFrom("users")
          .select(["pending_email", "pending_email_token_hash", "pending_email_expires_at"])
          .where("id", "=", userId)
          .forUpdate()
          .executeTakeFirst();
        if (!u || !u.pending_email || !u.pending_email_token_hash || !u.pending_email_expires_at) return "invalid";
        if (u.pending_email_expires_at < now) return "invalid";
        if (!tokenMatches(u.pending_email_token_hash, code)) return "invalid";
        await trx
          .updateTable("users")
          .set({
            email: u.pending_email,
            email_verified_at: now,
            pending_email: null,
            pending_email_token_hash: null,
            pending_email_expires_at: null,
            updated_at: now,
          })
          .where("id", "=", userId)
          .execute();
        await this.audit.log(
          { actorType: "user", actorId: userId, action: "user.email_changed", targetType: "user", targetId: userId },
          trx,
        );
        return "ok";
      });
    } catch (err) {
      if (isUniqueViolation(err)) throw new EmailUnavailableError(); // taken between request and verify
      throw err;
    }
    if (outcome === "invalid") throw new InvalidEmailCodeError();
    return this.getProfile(userId);
  }

  /** Active (unrevoked, unexpired) sessions; `current` marks the caller's own. */
  async listSessions(userId: string, currentSid: string | undefined): Promise<Session[]> {
    const rows = await this.db
      .selectFrom("sessions")
      .select(["id", "ip", "user_agent", "device_fingerprint", "created_at", "expires_at"])
      .where("user_id", "=", userId)
      .where("revoked_at", "is", null)
      .where("expires_at", ">", new Date())
      .orderBy("created_at", "desc")
      .execute();
    return rows.map((s) => ({
      id: s.id,
      ip: s.ip,
      userAgent: s.user_agent,
      deviceFingerprint: s.device_fingerprint,
      createdAt: s.created_at.toISOString(),
      expiresAt: s.expires_at.toISOString(),
      current: s.id === currentSid,
    }));
  }

  /** Revoke one of the CALLER's sessions. Someone else's id → same 404 face. */
  async revokeSession(userId: string, sessionId: string): Promise<void> {
    const res = await this.db
      .updateTable("sessions")
      .set({ revoked_at: new Date() })
      .where("id", "=", sessionId)
      .where("user_id", "=", userId) // ownership enforced in the WHERE, not by trusting the path
      .where("revoked_at", "is", null)
      .executeTakeFirst();
    if (res.numUpdatedRows === 0n) throw new SessionNotFoundError();
    await this.audit.log({
      actorType: "user",
      actorId: userId,
      action: "session.revoked",
      targetType: "session",
      targetId: sessionId,
    });
  }

  /**
   * Gate helper for trading/withdrawal paths: frozen/suspended/closed users
   * are blocked from money operations (Documents/06 "users" rules).
   */
  async assertActive(userId: string): Promise<void> {
    const row = await this.db.selectFrom("users").select(["status"]).where("id", "=", userId).executeTakeFirst();
    if (!row) throw new UserNotFoundError();
    if (row.status !== "active") throw new UserNotActiveError(row.status);
  }
}
