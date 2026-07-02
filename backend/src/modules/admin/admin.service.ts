import { Inject, Injectable } from "@nestjs/common";
import { sql, type Kysely } from "kysely";
import { z } from "zod";
import type {
  AdminKpisResponse,
  KillSwitchRequest,
  KillSwitchState,
  Pagination,
  UserStatus,
} from "@quatatrade/shared";
import { DB } from "../../db/database.module";
import type { Database } from "../../db/types";
import { newId } from "../../common/ids";
import { AuditService } from "../../common/audit/audit.service";
import { LedgerService } from "../ledger/ledger.service";
import { SettingsService } from "../settings/settings.service";
import { AdminAuthService } from "./admin-auth.service";
import { SETTING_VALUE_SCHEMAS, type AdminUsersQuery, type LedgerAdjustmentRequest } from "./admin.schemas";
import {
  InvalidSettingValueError,
  SettingKeyNotAllowedError,
  TargetUserNotFoundError,
  UserStatusChangeError,
} from "./admin.errors";

const zKillSwitchesValue = z.object({ withdrawals_paused: z.boolean(), trades_paused: z.boolean() });

export type UserModerationAction = "freeze" | "suspend" | "restore";

const MODERATION_TARGET: Record<UserModerationAction, UserStatus> = {
  freeze: "frozen",
  suspend: "suspended",
  restore: "active",
};

const ACTIVE_TRADE_STATUSES = ["OPENED", "ESCROW_LOCKED", "PAYMENT_SUBMITTED", "DISPUTED"] as const;

export interface AdjustmentResult {
  journalId: string;
  replayed: boolean;
}

/**
 * admin — RBAC-guarded operations console (Documents/06 "admin + treasury").
 * This service NEVER writes money tables directly: every movement goes
 * through LedgerService.postJournal; trade state only via the escrow/dispute
 * services it delegates to. Every action is hash-chain audit-logged.
 */
@Injectable()
export class AdminService {
  constructor(
    @Inject(DB) private readonly db: Kysely<Database>,
    private readonly ledger: LedgerService,
    private readonly settings: SettingsService,
    private readonly audit: AuditService,
    private readonly adminAuth: AdminAuthService,
  ) {}

  // ── dashboards ────────────────────────────────────────────────────────────

  async kpis(): Promise<AdminKpisResponse> {
    const since24h = new Date(Date.now() - 24 * 3_600_000);
    const [
      totalUsers,
      activeTrades,
      trades24h,
      balancesByKind,
      openDisputes,
      pendingKyc,
      pendingWithdrawals,
      riskFlags24h,
    ] = await Promise.all([
      this.db.selectFrom("users").select((eb) => eb.fn.countAll<bigint>().as("n")).executeTakeFirstOrThrow(),
      this.db
        .selectFrom("trades")
        .select((eb) => eb.fn.countAll<bigint>().as("n"))
        .where("status", "in", [...ACTIVE_TRADE_STATUSES])
        .executeTakeFirstOrThrow(),
      this.db
        .selectFrom("trades")
        .select((eb) => eb.fn.countAll<bigint>().as("n"))
        .select(sql<bigint>`COALESCE(SUM(amount), 0)::int8`.as("volume"))
        .where("created_at", ">=", since24h)
        .executeTakeFirstOrThrow(),
      this.db
        .selectFrom("account_balances")
        .select("kind")
        .select(sql<bigint>`COALESCE(SUM(balance), 0)::int8`.as("total"))
        .where("kind", "in", ["user_escrow", "platform_treasury"])
        .groupBy("kind")
        .execute(),
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
      this.db
        .selectFrom("withdrawals")
        .select((eb) => eb.fn.countAll<bigint>().as("n"))
        .where("status", "in", ["PENDING_APPROVAL", "RISK_HOLD"])
        .executeTakeFirstOrThrow(),
      this.db
        .selectFrom("risk_events")
        .select((eb) => eb.fn.countAll<bigint>().as("n"))
        .where("created_at", ">=", since24h)
        .executeTakeFirstOrThrow(),
    ]);

    const kindTotal = (kind: "user_escrow" | "platform_treasury"): bigint =>
      balancesByKind.find((r) => r.kind === kind)?.total ?? 0n;

    return {
      totalUsers: Number(totalUsers.n),
      activeTrades: Number(activeTrades.n),
      tradesLast24h: Number(trades24h.n),
      volumeLast24h: trades24h.volume.toString(),
      escrowLockedTotal: kindTotal("user_escrow").toString(),
      treasuryBalance: kindTotal("platform_treasury").toString(),
      openDisputes: Number(openDisputes.n),
      pendingKyc: Number(pendingKyc.n),
      pendingWithdrawals: Number(pendingWithdrawals.n),
      riskFlagsLast24h: Number(riskFlags24h.n),
    };
  }

  async listUsers(query: AdminUsersQuery): Promise<{
    items: Array<{
      id: string;
      email: string;
      phone: string | null;
      kycTier: number;
      kycStatus: string;
      status: UserStatus;
      reputationScore: number;
      createdAt: string;
    }>;
    total: number;
  }> {
    let base = this.db.selectFrom("users");
    if (query.search) {
      const escaped = query.search.replace(/[\\%_]/g, (m) => `\\${m}`);
      base = base.where("email", "ilike", `%${escaped}%`);
    }
    const [rows, count] = await Promise.all([
      base
        .select(["id", "email", "phone", "kyc_tier", "kyc_status", "status", "reputation_score", "created_at"])
        .orderBy("created_at", "desc")
        .limit(query.pageSize)
        .offset((query.page - 1) * query.pageSize)
        .execute(),
      base.select((eb) => eb.fn.countAll<bigint>().as("n")).executeTakeFirstOrThrow(),
    ]);
    return {
      items: rows.map((u) => ({
        id: u.id,
        email: u.email,
        phone: u.phone,
        kycTier: u.kyc_tier,
        kycStatus: u.kyc_status,
        status: u.status,
        reputationScore: u.reputation_score,
        createdAt: u.created_at.toISOString(),
      })),
      total: Number(count.n),
    };
  }

  async listTrades(pagination: Pagination): Promise<{
    items: Array<{
      id: string;
      shortRef: string;
      sellerEmail: string;
      buyerEmail: string;
      amount: string;
      feeAmount: string;
      status: string;
      createdAt: string;
    }>;
    total: number;
  }> {
    const [rows, count] = await Promise.all([
      this.db
        .selectFrom("trades as t")
        .innerJoin("users as s", "s.id", "t.seller_id")
        .innerJoin("users as b", "b.id", "t.buyer_id")
        .select([
          "t.id",
          "t.short_ref",
          "s.email as seller_email",
          "b.email as buyer_email",
          "t.amount",
          "t.fee_amount",
          "t.status",
          "t.created_at",
        ])
        .orderBy("t.created_at", "desc")
        .limit(pagination.pageSize)
        .offset((pagination.page - 1) * pagination.pageSize)
        .execute(),
      this.db.selectFrom("trades").select((eb) => eb.fn.countAll<bigint>().as("n")).executeTakeFirstOrThrow(),
    ]);
    return {
      items: rows.map((t) => ({
        id: t.id,
        shortRef: t.short_ref,
        sellerEmail: t.seller_email,
        buyerEmail: t.buyer_email,
        amount: t.amount.toString(),
        feeAmount: t.fee_amount.toString(),
        status: t.status,
        createdAt: t.created_at.toISOString(),
      })),
      total: Number(count.n),
    };
  }

  /** Withdrawal work queue: actionable rows (PENDING_APPROVAL / RISK_HOLD) first, oldest first. */
  async listWithdrawals(pagination: Pagination): Promise<{
    items: Array<{
      id: string;
      userId: string;
      userEmail: string;
      asset: string;
      toAddress: string;
      amount: string;
      fee: string;
      status: string;
      riskScore: number | null;
      riskFlags: Record<string, unknown> | null;
      requiresSecondApprover: boolean;
      approvedBy: string | null;
      secondApprover: string | null;
      createdAt: string;
    }>;
    total: number;
  }> {
    const caps = await this.settings.withdrawalCaps();
    const [rows, count] = await Promise.all([
      this.db
        .selectFrom("withdrawals as w")
        .innerJoin("users as u", "u.id", "w.user_id")
        .select([
          "w.id",
          "w.user_id",
          "u.email",
          "w.asset",
          "w.to_address",
          "w.amount",
          "w.fee",
          "w.status",
          "w.risk_score",
          "w.risk_flags",
          "w.approved_by",
          "w.second_approver",
          "w.created_at",
        ])
        .orderBy(sql`CASE WHEN w.status IN ('PENDING_APPROVAL', 'RISK_HOLD') THEN 0 ELSE 1 END`)
        .orderBy("w.created_at", "asc")
        .limit(pagination.pageSize)
        .offset((pagination.page - 1) * pagination.pageSize)
        .execute(),
      this.db.selectFrom("withdrawals").select((eb) => eb.fn.countAll<bigint>().as("n")).executeTakeFirstOrThrow(),
    ]);
    return {
      items: rows.map((w) => ({
        id: w.id,
        userId: w.user_id,
        userEmail: w.email,
        asset: w.asset,
        toAddress: w.to_address,
        amount: w.amount.toString(),
        fee: w.fee.toString(),
        status: w.status,
        riskScore: w.risk_score,
        riskFlags: w.risk_flags,
        requiresSecondApprover: w.amount >= caps.dualApprovalThreshold,
        approvedBy: w.approved_by,
        secondApprover: w.second_approver,
        createdAt: w.created_at.toISOString(),
      })),
      total: Number(count.n),
    };
  }

  // ── user moderation ───────────────────────────────────────────────────────

  /**
   * freeze | suspend | restore. Guarded transitions: closed accounts are
   * untouchable, repeats are idempotent no-ops. Status change + outbox event
   * + audit row commit in ONE transaction.
   */
  async setUserStatus(
    adminId: string,
    userId: string,
    action: UserModerationAction,
    reason: string,
    ip?: string,
  ): Promise<{ status: UserStatus; changed: boolean }> {
    const target = MODERATION_TARGET[action];
    return this.db.transaction().execute(async (trx) => {
      const user = await trx
        .selectFrom("users")
        .select(["id", "status"])
        .where("id", "=", userId)
        .forUpdate()
        .executeTakeFirst();
      if (!user) throw new TargetUserNotFoundError();
      if (user.status === "closed") throw new UserStatusChangeError("closed accounts cannot be modified");
      if (user.status === target) return { status: target, changed: false }; // idempotent

      await trx
        .updateTable("users")
        .set({ status: target, updated_at: new Date() })
        .where("id", "=", userId)
        .where("status", "=", user.status) // belt and braces under the row lock
        .execute();

      const eventType = action === "freeze" ? "user.frozen" : action === "suspend" ? "user.suspended" : "user.restored";
      await trx
        .insertInto("outbox")
        .values({
          id: newId(),
          event_type: eventType,
          payload: JSON.stringify({ userId, from: user.status, to: target, adminId }),
        })
        .execute();
      await this.audit.log(
        {
          actorType: "admin",
          actorId: adminId,
          action: `admin.user.${action}`,
          targetType: "user",
          targetId: userId,
          ip,
          metadata: { from: user.status, to: target, reason },
        },
        trx,
      );
      return { status: target, changed: true };
    });
  }

  // ── kill switch ───────────────────────────────────────────────────────────

  async getKillSwitch(): Promise<KillSwitchState> {
    const state = await this.settings.killSwitches();
    return { withdrawalsPaused: state.withdrawalsPaused, tradesPaused: state.tradesPaused };
  }

  /**
   * Toggle ONE switch, preserving the other (read-modify-write under a row
   * lock). Requires the admin's own TOTP. Takes effect within seconds:
   * SettingsService cache is invalidated after commit.
   */
  async setKillSwitch(adminId: string, dto: KillSwitchRequest, ip?: string): Promise<KillSwitchState> {
    await this.adminAuth.verifyTotp(adminId, dto.totpCode, "admin.kill_switch", ip);

    const next = await this.db.transaction().execute(async (trx) => {
      const row = await trx
        .selectFrom("settings")
        .select("value")
        .where("key", "=", "kill_switches")
        .forUpdate()
        .executeTakeFirst();
      if (!row) throw new InvalidSettingValueError("kill_switches setting row is missing");
      const current = zKillSwitchesValue.parse(row.value);
      const updated = {
        withdrawals_paused: dto.target === "withdrawals" ? dto.paused : current.withdrawals_paused,
        trades_paused: dto.target === "trades" ? dto.paused : current.trades_paused,
      };

      await trx
        .updateTable("settings")
        .set({ value: JSON.stringify(updated), updated_by: adminId, updated_at: new Date() })
        .where("key", "=", "kill_switches")
        .execute();
      await trx
        .insertInto("outbox")
        .values({
          id: newId(),
          event_type: "admin.kill_switch",
          payload: JSON.stringify({ target: dto.target, paused: dto.paused, adminId }),
        })
        .execute();
      await this.audit.log(
        {
          actorType: "admin",
          actorId: adminId,
          action: "admin.kill_switch",
          targetType: "setting",
          ip,
          metadata: { target: dto.target, paused: dto.paused, reason: dto.reason, previous: current, next: updated },
        },
        trx,
      );
      return updated;
    });

    this.settings.invalidate();
    return { withdrawalsPaused: next.withdrawals_paused, tradesPaused: next.trades_paused };
  }

  // ── settings ──────────────────────────────────────────────────────────────

  /**
   * Whitelisted, schema-validated setting edit (TOTP verified by the caller
   * flow). Old and new values are audit-logged so every fee change is
   * reconstructible.
   */
  async updateSetting(adminId: string, key: string, value: unknown, totpCode: string | undefined, ip?: string): Promise<void> {
    const schema = SETTING_VALUE_SCHEMAS[key];
    if (!schema) throw new SettingKeyNotAllowedError(key);
    const parsed = schema.safeParse(value);
    if (!parsed.success) {
      throw new InvalidSettingValueError(parsed.error.issues.map((i) => `${i.path.join(".") || key}: ${i.message}`).join("; "));
    }
    await this.adminAuth.verifyTotp(adminId, totpCode, "admin.setting_update", ip);

    await this.db.transaction().execute(async (trx) => {
      const row = await trx
        .selectFrom("settings")
        .select("value")
        .where("key", "=", key)
        .forUpdate()
        .executeTakeFirst();
      if (!row) throw new SettingKeyNotAllowedError(key); // only seeded keys are editable — never invent rows
      await trx
        .updateTable("settings")
        .set({ value: JSON.stringify(parsed.data), updated_by: adminId, updated_at: new Date() })
        .where("key", "=", key)
        .execute();
      await this.audit.log(
        {
          actorType: "admin",
          actorId: adminId,
          action: "admin.setting_update",
          targetType: "setting",
          ip,
          metadata: { key, oldValue: row.value, newValue: parsed.data },
        },
        trx,
      );
    });
    this.settings.invalidate();
  }

  // ── audit logs ────────────────────────────────────────────────────────────

  async listAuditLogs(pagination: Pagination): Promise<{
    items: Array<{
      id: string;
      actorType: string;
      actorId: string | null;
      action: string;
      targetType: string | null;
      targetId: string | null;
      ip: string | null;
      metadata: Record<string, unknown> | null;
      createdAt: string;
    }>;
    total: number;
  }> {
    const [rows, count] = await Promise.all([
      this.db
        .selectFrom("audit_logs")
        .select(["id", "actor_type", "actor_id", "action", "target_type", "target_id", "ip", "metadata", "created_at"])
        .orderBy("created_at", "desc")
        .orderBy("id", "desc")
        .limit(pagination.pageSize)
        .offset((pagination.page - 1) * pagination.pageSize)
        .execute(),
      this.db.selectFrom("audit_logs").select((eb) => eb.fn.countAll<bigint>().as("n")).executeTakeFirstOrThrow(),
    ]);
    return {
      items: rows.map((r) => ({
        id: r.id,
        actorType: r.actor_type,
        actorId: r.actor_id,
        action: r.action,
        targetType: r.target_type,
        targetId: r.target_id,
        ip: r.ip,
        metadata: r.metadata,
        createdAt: r.created_at.toISOString(),
      })),
      total: Number(count.n),
    };
  }

  // ── ledger adjustment (the ONLY manual money endpoint) ────────────────────

  /**
   * SUPER_ADMIN only (route guard) + own-TOTP + mandatory reason + audit
   * (Documents/08 §E). Books `adjustment` between the external account and
   * the user's available balance via postJournal — the ledger's non-negative
   * CHECK still applies, so a debit can never overdraw the user.
   */
  async ledgerAdjustment(adminId: string, dto: LedgerAdjustmentRequest, ip?: string): Promise<AdjustmentResult> {
    await this.adminAuth.verifyTotp(adminId, dto.totpCode, "ledger.adjustment", ip);
    const amount = BigInt(dto.amount); // signed, non-zero (schema-enforced)

    return this.ledger.withMoneyTransaction(async (trx) => {
      const user = await trx.selectFrom("users").select("id").where("id", "=", dto.userId).executeTakeFirst();
      if (!user) throw new TargetUserNotFoundError();

      const userAccount = await this.ledger.getOrCreateAccount(dto.userId, dto.accountKind, dto.asset, trx);
      const external = await this.ledger.getOrCreateAccount(null, "external", dto.asset, trx);

      const { journalId, replayed } = await this.ledger.postJournal(
        {
          reason: "adjustment",
          referenceType: "user",
          referenceId: dto.userId,
          // namespaced: a client key can never collide with other modules' journal keys
          idempotencyKey: `admin_adjustment:${dto.idempotencyKey}`,
          createdBy: `admin:${adminId}`,
          asset: dto.asset,
          legs: [
            { accountId: external, amount: -amount },
            { accountId: userAccount, amount },
          ],
        },
        trx,
      );

      if (!replayed) {
        await trx
          .insertInto("outbox")
          .values({
            id: newId(),
            event_type: "ledger.adjustment",
            payload: JSON.stringify({ journalId, userId: dto.userId, amount: dto.amount, adminId }),
          })
          .execute();
        await this.audit.log(
          {
            actorType: "admin",
            actorId: adminId,
            action: "ledger.adjustment",
            targetType: "user",
            targetId: dto.userId,
            ip,
            metadata: { amount: dto.amount, asset: dto.asset, reason: dto.reason, journalId },
          },
          trx,
        );
      }
      return { journalId, replayed };
    });
  }
}
