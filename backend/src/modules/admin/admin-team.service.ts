import { Inject, Injectable } from "@nestjs/common";
import type { Kysely, Selectable } from "kysely";
import * as argon2 from "argon2";
import type { AdminAccount, CreateAdminRequest, UpdateAdminRequest } from "@quatatrade/shared";
import { DB } from "../../db/database.module";
import type { Database, AdminsTable } from "../../db/types";
import { newId } from "../../common/ids";
import { AuditService } from "../../common/audit/audit.service";
import { AdminAccountNotFoundError, AdminEmailExistsError, AdminManagementError } from "./admin.errors";

type AdminRow = Selectable<AdminsTable>;

function toAccount(r: Pick<AdminRow, "id" | "email" | "role" | "active" | "totp_enabled" | "created_at">): AdminAccount {
  return {
    id: r.id,
    email: r.email,
    role: r.role,
    active: r.active,
    totpEnabled: r.totp_enabled,
    createdAt: r.created_at.toISOString(),
  };
}

/**
 * admin-team — SUPER_ADMIN-only team/account management (Documents/06). Onboard
 * teammates, change roles, reset a lost 2FA, and deactivate accounts. Every
 * mutation is TOTP-stepped-up in the controller and audit-logged here. Two
 * lock-out guards: an admin can never demote/deactivate THEMSELVES, and the
 * LAST active super admin can never be removed.
 */
@Injectable()
export class AdminTeamService {
  constructor(
    @Inject(DB) private readonly db: Kysely<Database>,
    private readonly audit: AuditService,
  ) {}

  async list(): Promise<AdminAccount[]> {
    const rows = await this.db
      .selectFrom("admins")
      .select(["id", "email", "role", "active", "totp_enabled", "created_at"])
      .orderBy("created_at", "asc")
      .execute();
    return rows.map(toAccount);
  }

  async create(actorId: string, dto: CreateAdminRequest, ip?: string): Promise<AdminAccount> {
    const passwordHash = await argon2.hash(dto.password, { type: argon2.argon2id });
    const id = newId();
    const inserted = await this.db
      .insertInto("admins")
      .values({ id, email: dto.email, password_hash: passwordHash, role: dto.role, totp_secret_enc: null })
      // email is UNIQUE (citext) — never overwrite an existing admin
      .onConflict((oc) => oc.column("email").doNothing())
      .returning(["id", "email", "role", "active", "totp_enabled", "created_at"])
      .executeTakeFirst();
    if (!inserted) throw new AdminEmailExistsError();

    await this.audit.log({
      actorType: "admin",
      actorId,
      action: "admin.account_create",
      targetType: "admin",
      targetId: id,
      ip,
      metadata: { email: dto.email, role: dto.role },
    });
    return toAccount(inserted);
  }

  async update(actorId: string, targetId: string, dto: UpdateAdminRequest, ip?: string): Promise<AdminAccount> {
    return this.db.transaction().execute(async (trx) => {
      const target = await trx
        .selectFrom("admins")
        .selectAll()
        .where("id", "=", targetId)
        .forUpdate()
        .executeTakeFirst();
      if (!target) throw new AdminAccountNotFoundError();

      const deactivating = dto.active === false && target.active;
      const demoting = dto.role !== undefined && dto.role !== "SUPER_ADMIN" && target.role === "SUPER_ADMIN";

      // Guard 1: never act destructively on your OWN account (self lock-out).
      if (targetId === actorId && (deactivating || demoting)) {
        throw new AdminManagementError("you cannot deactivate or demote your own account");
      }
      // Guard 2: never remove the LAST active super admin.
      if (deactivating || demoting) {
        const others = await trx
          .selectFrom("admins")
          .select((eb) => eb.fn.countAll<bigint>().as("n"))
          .where("role", "=", "SUPER_ADMIN")
          .where("active", "=", true)
          .where("id", "!=", targetId)
          .executeTakeFirstOrThrow();
        if (Number(others.n) === 0) {
          throw new AdminManagementError("at least one active super admin must remain");
        }
      }

      const updated = await trx
        .updateTable("admins")
        .set({
          ...(dto.role !== undefined ? { role: dto.role } : {}),
          ...(dto.active !== undefined ? { active: dto.active } : {}),
        })
        .where("id", "=", targetId)
        .returning(["id", "email", "role", "active", "totp_enabled", "created_at"])
        .executeTakeFirstOrThrow();

      await this.audit.log(
        {
          actorType: "admin",
          actorId,
          action: "admin.account_update",
          targetType: "admin",
          targetId,
          ip,
          metadata: {
            ...(dto.role !== undefined ? { role: { from: target.role, to: dto.role } } : {}),
            ...(dto.active !== undefined ? { active: { from: target.active, to: dto.active } } : {}),
          },
        },
        trx,
      );
      return toAccount(updated);
    });
  }

  /** Clear the target's TOTP so they re-enrol on next login (lost-authenticator recovery). */
  async resetTotp(actorId: string, targetId: string, ip?: string): Promise<AdminAccount> {
    const updated = await this.db
      .updateTable("admins")
      .set({ totp_secret_enc: null, totp_enabled: false })
      .where("id", "=", targetId)
      .returning(["id", "email", "role", "active", "totp_enabled", "created_at"])
      .executeTakeFirst();
    if (!updated) throw new AdminAccountNotFoundError();

    await this.audit.log({
      actorType: "admin",
      actorId,
      action: "admin.account_reset_2fa",
      targetType: "admin",
      targetId,
      ip,
      metadata: { email: updated.email },
    });
    return toAccount(updated);
  }
}
