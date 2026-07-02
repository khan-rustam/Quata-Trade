import { Inject, Injectable } from "@nestjs/common";
import type { Kysely, Selectable } from "kysely";
import type { Session, UpdateProfileRequest, UserProfile } from "@quatatrade/shared";
import { DB } from "../../db/database.module";
import type { Database, UsersTable } from "../../db/types";
import { AuditService } from "../../common/audit/audit.service";
import { SessionNotFoundError, UserNotActiveError, UserNotFoundError } from "./users.errors";

type UserRow = Selectable<UsersTable>;

function toProfile(row: UserRow): UserProfile {
  return {
    id: row.id,
    email: row.email,
    phone: row.phone,
    firstName: row.first_name,
    lastName: row.last_name,
    country: row.country,
    emailVerified: row.email_verified_at !== null,
    phoneVerified: row.phone_verified_at !== null,
    kycTier: row.kyc_tier,
    kycStatus: row.kyc_status,
    totpEnabled: row.totp_enabled,
    pinSet: row.pin_hash !== null, // never expose the hash itself
    status: row.status,
    reputationScore: row.reputation_score,
    createdAt: row.created_at.toISOString(),
  };
}

/**
 * users — profile + session self-management (Documents/06 "users").
 * Every query is scoped by the AUTHENTICATED user id — path/body ids are never
 * trusted for ownership (IDOR-proof, Documents/08 §E).
 */
@Injectable()
export class UsersService {
  constructor(
    @Inject(DB) private readonly db: Kysely<Database>,
    private readonly audit: AuditService,
  ) {}

  async getProfile(userId: string): Promise<UserProfile> {
    const row = await this.db.selectFrom("users").selectAll().where("id", "=", userId).executeTakeFirst();
    if (!row) throw new UserNotFoundError();
    return toProfile(row);
  }

  async updateProfile(userId: string, dto: UpdateProfileRequest): Promise<UserProfile> {
    if (dto.firstName !== undefined || dto.lastName !== undefined) {
      await this.db
        .updateTable("users")
        .set({
          ...(dto.firstName !== undefined ? { first_name: dto.firstName } : {}),
          ...(dto.lastName !== undefined ? { last_name: dto.lastName } : {}),
          updated_at: new Date(),
        })
        .where("id", "=", userId)
        .execute();
    }
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
