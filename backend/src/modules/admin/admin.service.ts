import { Inject, Injectable } from "@nestjs/common";
import { sql, type Kysely } from "kysely";
import { z } from "zod";
import type {
  AdminCountriesResponse,
  AdminKpisResponse,
  AdminMetricsQuery,
  AdminMetricsResponse,
  AdminUserDetail,
  KillSwitchRequest,
  KillSwitchState,
  SetCountryEnabledRequest,
  UserStatus,
} from "@quatatrade/shared";
import { DB } from "../../db/database.module";
import type { Database } from "../../db/types";
import { newId } from "../../common/ids";
import { AuditService } from "../../common/audit/audit.service";
import { LedgerService } from "../ledger/ledger.service";
import { SettingsService } from "../settings/settings.service";
import { CountriesService } from "../countries/countries.service";
import { AdminAuthService } from "./admin-auth.service";
import {
  SETTING_VALUE_SCHEMAS,
  type AdminAuditQuery,
  type AdminTradesQuery,
  type AdminUsersQuery,
  type AdminWithdrawalsQuery,
  type LedgerAdjustmentRequest,
} from "./admin.schemas";

/** YYYY-MM-DD → [fromInclusive, toExclusive] UTC day boundaries for created_at filters. */
function dayRange(from?: string, to?: string): { fromDate?: Date; toDate?: Date } {
  return {
    fromDate: from ? new Date(`${from}T00:00:00.000Z`) : undefined,
    toDate: to ? new Date(new Date(`${to}T00:00:00.000Z`).getTime() + 86_400_000) : undefined,
  };
}
import {
  CountryNotFoundError,
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
    private readonly countries: CountriesService,
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

  /**
   * Daily timeseries for the dashboard charts + report page: signups, completed
   * trades, USDT volume, and fees earned, one row per day for the last N days.
   * A generated date spine left-joins the per-day aggregates so empty days are 0.
   */
  async metrics(query: AdminMetricsQuery): Promise<AdminMetricsResponse> {
    const days = query.days;
    const result = await sql<{
      date: string;
      signups: number;
      trades: number;
      volume_usdt: bigint;
      fee_usdt: bigint;
    }>`
      with spine as (
        select generate_series(
          (current_date - (${days - 1})::int * interval '1 day')::date,
          current_date,
          interval '1 day'
        )::date as day
      )
      select
        to_char(s.day, 'YYYY-MM-DD') as date,
        coalesce(u.signups, 0)::int as signups,
        coalesce(t.trades, 0)::int as trades,
        coalesce(t.volume, 0)::int8 as volume_usdt,
        coalesce(t.fees, 0)::int8 as fee_usdt
      from spine s
      left join (
        select created_at::date as day, count(*) as signups
        from users group by 1
      ) u on u.day = s.day
      left join (
        select created_at::date as day, count(*) as trades, sum(amount) as volume, sum(fee_amount) as fees
        from trades where status in ('COMPLETED', 'RESOLVED_RELEASE') group by 1
      ) t on t.day = s.day
      order by s.day asc
    `.execute(this.db);

    const points = result.rows.map((r) => ({
      date: r.date,
      signups: Number(r.signups),
      trades: Number(r.trades),
      volumeUsdt: r.volume_usdt.toString(),
      feeUsdt: r.fee_usdt.toString(),
    }));
    const totals = points.reduce(
      (acc, p) => ({
        signups: acc.signups + p.signups,
        trades: acc.trades + p.trades,
        volumeUsdt: acc.volumeUsdt + BigInt(p.volumeUsdt),
        feeUsdt: acc.feeUsdt + BigInt(p.feeUsdt),
      }),
      { signups: 0, trades: 0, volumeUsdt: 0n, feeUsdt: 0n },
    );
    return {
      days,
      points,
      totals: {
        signups: totals.signups,
        trades: totals.trades,
        volumeUsdt: totals.volumeUsdt.toString(),
        feeUsdt: totals.feeUsdt.toString(),
      },
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

  /**
   * Everything an admin should know about one user — profile + balances +
   * trade/offer aggregates + recent trades/withdrawals/deposits + KYC history +
   * device sessions + risk events. All read-only; recent lists capped at 10-15.
   */
  async getUserDetail(userId: string): Promise<AdminUserDetail> {
    const user = await this.db
      .selectFrom("users")
      .select([
        "id",
        "email",
        "phone",
        "first_name",
        "last_name",
        "display_name",
        "bio",
        "country",
        "kyc_tier",
        "kyc_status",
        "status",
        "reputation_score",
        "totp_enabled",
        "email_verified_at",
        "phone_verified_at",
        "created_at",
      ])
      .where("id", "=", userId)
      .executeTakeFirst();
    if (!user) throw new TargetUserNotFoundError();

    const [
      balances,
      tradeAgg,
      offerAgg,
      withdrawalCount,
      depositCount,
      openDisputes,
      recentTrades,
      recentWithdrawals,
      recentDeposits,
      kyc,
      sessions,
      riskEvents,
    ] = await Promise.all([
      this.db
        .selectFrom("accounts as a")
        .innerJoin("account_balances as ab", "ab.account_id", "a.id")
        .select(["a.asset", "a.kind", "ab.balance"])
        .where("a.owner_user_id", "=", userId)
        .orderBy("a.asset")
        .orderBy("a.kind")
        .execute(),
      this.db
        .selectFrom("trades")
        .select(sql<bigint>`count(*)`.as("total"))
        .select(sql<bigint>`count(*) filter (where status in ('COMPLETED','RESOLVED_RELEASE'))`.as("completed"))
        .select(sql<bigint>`count(*) filter (where status in ('CANCELLED','EXPIRED','RESOLVED_REFUND'))`.as("cancelled"))
        .select(sql<bigint>`count(*) filter (where status = 'DISPUTED')`.as("disputed"))
        .select(
          sql<bigint>`coalesce(sum(fiat_amount_xaf) filter (where status in ('COMPLETED','RESOLVED_RELEASE')),0)::int8`.as(
            "volume",
          ),
        )
        .where((eb) => eb.or([eb("seller_id", "=", userId), eb("buyer_id", "=", userId)]))
        .executeTakeFirstOrThrow(),
      this.db
        .selectFrom("offers")
        .select(sql<bigint>`count(*)`.as("total"))
        .select(sql<bigint>`count(*) filter (where status = 'ACTIVE')`.as("active"))
        .where("user_id", "=", userId)
        .where("status", "!=", "DELETED")
        .executeTakeFirstOrThrow(),
      this.db
        .selectFrom("withdrawals")
        .select((eb) => eb.fn.countAll<bigint>().as("n"))
        .where("user_id", "=", userId)
        .executeTakeFirstOrThrow(),
      this.db
        .selectFrom("deposits")
        .select((eb) => eb.fn.countAll<bigint>().as("n"))
        .where("user_id", "=", userId)
        .executeTakeFirstOrThrow(),
      this.db
        .selectFrom("disputes as d")
        .innerJoin("trades as t", "t.id", "d.trade_id")
        .select((eb) => eb.fn.countAll<bigint>().as("n"))
        .where((eb) => eb.or([eb("t.seller_id", "=", userId), eb("t.buyer_id", "=", userId)]))
        .where("d.status", "!=", "RESOLVED")
        .executeTakeFirstOrThrow(),
      this.db
        .selectFrom("trades as t")
        .innerJoin("users as s", "s.id", "t.seller_id")
        .innerJoin("users as b", "b.id", "t.buyer_id")
        .select([
          "t.id",
          "t.short_ref",
          "t.seller_id",
          "s.email as seller_email",
          "b.email as buyer_email",
          "t.amount",
          "t.fiat_amount_xaf",
          "t.status",
          "t.created_at",
        ])
        .where((eb) => eb.or([eb("t.seller_id", "=", userId), eb("t.buyer_id", "=", userId)]))
        .orderBy("t.created_at", "desc")
        .limit(15)
        .execute(),
      this.db
        .selectFrom("withdrawals")
        .select(["id", "asset", "amount", "fee", "status", "to_address", "created_at"])
        .where("user_id", "=", userId)
        .orderBy("created_at", "desc")
        .limit(10)
        .execute(),
      this.db
        .selectFrom("deposits")
        .select(["id", "asset", "amount", "status", "tx_hash", "created_at"])
        .where("user_id", "=", userId)
        .orderBy("created_at", "desc")
        .limit(10)
        .execute(),
      this.db
        .selectFrom("kyc_submissions")
        .select(["id", "tier", "doc_type", "status", "reviewed_at", "created_at"])
        .where("user_id", "=", userId)
        .orderBy("created_at", "desc")
        .limit(10)
        .execute(),
      this.db
        .selectFrom("sessions")
        .select(["id", "ip", "user_agent", "device_fingerprint", "revoked_at", "created_at", "expires_at"])
        .where("user_id", "=", userId)
        .orderBy("created_at", "desc")
        .limit(10)
        .execute(),
      this.db
        .selectFrom("risk_events")
        .select(["id", "kind", "score", "action_taken", "flags", "created_at"])
        .where("user_id", "=", userId)
        .orderBy("created_at", "desc")
        .limit(10)
        .execute(),
    ]);

    return {
      user: {
        id: user.id,
        email: user.email,
        phone: user.phone,
        firstName: user.first_name,
        lastName: user.last_name,
        displayName: user.display_name,
        bio: user.bio,
        country: user.country,
        kycTier: user.kyc_tier,
        kycStatus: user.kyc_status,
        status: user.status,
        reputationScore: user.reputation_score,
        totpEnabled: user.totp_enabled,
        emailVerified: user.email_verified_at !== null,
        phoneVerified: user.phone_verified_at !== null,
        createdAt: user.created_at.toISOString(),
      },
      balances: balances.map((b) => ({ asset: b.asset, kind: b.kind, balance: b.balance.toString() })),
      stats: {
        tradesTotal: Number(tradeAgg.total),
        tradesCompleted: Number(tradeAgg.completed),
        tradesCancelled: Number(tradeAgg.cancelled),
        tradesDisputed: Number(tradeAgg.disputed),
        volumeCompletedXaf: tradeAgg.volume.toString(),
        offersActive: Number(offerAgg.active),
        offersTotal: Number(offerAgg.total),
        withdrawalsTotal: Number(withdrawalCount.n),
        depositsTotal: Number(depositCount.n),
        openDisputes: Number(openDisputes.n),
      },
      recentTrades: recentTrades.map((t) => {
        const isSeller = t.seller_id === userId;
        return {
          id: t.id,
          shortRef: t.short_ref,
          side: isSeller ? "SELL" : "BUY",
          counterpartyEmail: isSeller ? t.buyer_email : t.seller_email,
          amount: t.amount.toString(),
          fiatAmountXaf: t.fiat_amount_xaf.toString(),
          status: t.status,
          createdAt: t.created_at.toISOString(),
        };
      }),
      recentWithdrawals: recentWithdrawals.map((w) => ({
        id: w.id,
        asset: w.asset,
        amount: w.amount.toString(),
        fee: w.fee.toString(),
        status: w.status,
        toAddress: w.to_address,
        createdAt: w.created_at.toISOString(),
      })),
      recentDeposits: recentDeposits.map((d) => ({
        id: d.id,
        asset: d.asset,
        amount: d.amount.toString(),
        status: d.status,
        txHash: d.tx_hash,
        createdAt: d.created_at.toISOString(),
      })),
      kyc: kyc.map((k) => ({
        id: k.id,
        tier: k.tier,
        docType: k.doc_type,
        status: k.status,
        reviewedAt: k.reviewed_at ? k.reviewed_at.toISOString() : null,
        createdAt: k.created_at.toISOString(),
      })),
      sessions: sessions.map((s) => ({
        id: s.id,
        ip: s.ip,
        userAgent: s.user_agent,
        deviceFingerprint: s.device_fingerprint,
        revoked: s.revoked_at !== null,
        createdAt: s.created_at.toISOString(),
        expiresAt: s.expires_at.toISOString(),
      })),
      riskEvents: riskEvents.map((r) => ({
        id: r.id,
        kind: r.kind,
        score: r.score,
        actionTaken: r.action_taken,
        flags: r.flags,
        createdAt: r.created_at.toISOString(),
      })),
    };
  }

  async listTrades(query: AdminTradesQuery): Promise<{
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
    const { fromDate, toDate } = dayRange(query.from, query.to);
    let rowsQuery = this.db
      .selectFrom("trades as t")
      .innerJoin("users as s", "s.id", "t.seller_id")
      .innerJoin("users as b", "b.id", "t.buyer_id");
    let countQuery = this.db.selectFrom("trades as t");
    if (query.status) {
      rowsQuery = rowsQuery.where("t.status", "=", query.status);
      countQuery = countQuery.where("t.status", "=", query.status);
    }
    if (fromDate) {
      rowsQuery = rowsQuery.where("t.created_at", ">=", fromDate);
      countQuery = countQuery.where("t.created_at", ">=", fromDate);
    }
    if (toDate) {
      rowsQuery = rowsQuery.where("t.created_at", "<", toDate);
      countQuery = countQuery.where("t.created_at", "<", toDate);
    }

    const [rows, count] = await Promise.all([
      rowsQuery
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
        .limit(query.pageSize)
        .offset((query.page - 1) * query.pageSize)
        .execute(),
      countQuery.select((eb) => eb.fn.countAll<bigint>().as("n")).executeTakeFirstOrThrow(),
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
  async listWithdrawals(query: AdminWithdrawalsQuery): Promise<{
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
    const { fromDate, toDate } = dayRange(query.from, query.to);
    let rowsQuery = this.db.selectFrom("withdrawals as w").innerJoin("users as u", "u.id", "w.user_id");
    let countQuery = this.db.selectFrom("withdrawals as w");
    if (query.status) {
      rowsQuery = rowsQuery.where("w.status", "=", query.status);
      countQuery = countQuery.where("w.status", "=", query.status);
    }
    if (fromDate) {
      rowsQuery = rowsQuery.where("w.created_at", ">=", fromDate);
      countQuery = countQuery.where("w.created_at", ">=", fromDate);
    }
    if (toDate) {
      rowsQuery = rowsQuery.where("w.created_at", "<", toDate);
      countQuery = countQuery.where("w.created_at", "<", toDate);
    }

    const [rows, count] = await Promise.all([
      rowsQuery
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
        .limit(query.pageSize)
        .offset((query.page - 1) * query.pageSize)
        .execute(),
      countQuery.select((eb) => eb.fn.countAll<bigint>().as("n")).executeTakeFirstOrThrow(),
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

  // ── countries (phased market rollout) ──────────────────────────────────────

  /** Every market, enabled or not, for the rollout console. */
  async listCountries(): Promise<AdminCountriesResponse> {
    return { countries: await this.countries.listAll() };
  }

  /**
   * Enable/disable a market. Same stakes as the kill switch — TOTP step-up +
   * hash-chained audit in one transaction. Enabling opens sign-up + trading for
   * that country; disabling freezes NEW trades (openTrade re-checks enabled).
   */
  async setCountryEnabled(
    adminId: string,
    code: string,
    dto: SetCountryEnabledRequest,
    ip?: string,
  ): Promise<AdminCountriesResponse> {
    const norm = code.toUpperCase();
    await this.adminAuth.verifyTotp(adminId, dto.totpCode, "admin.country_toggle", ip);

    await this.db.transaction().execute(async (trx) => {
      const row = await trx
        .selectFrom("countries")
        .select(["code", "enabled"])
        .where("code", "=", norm)
        .forUpdate()
        .executeTakeFirst();
      if (!row) throw new CountryNotFoundError(norm);

      await trx
        .updateTable("countries")
        .set({ enabled: dto.enabled, updated_at: new Date() })
        .where("code", "=", norm)
        .execute();
      await trx
        .insertInto("outbox")
        .values({
          id: newId(),
          event_type: "admin.country_toggle",
          payload: JSON.stringify({ code: norm, enabled: dto.enabled, adminId }),
        })
        .execute();
      await this.audit.log(
        {
          actorType: "admin",
          actorId: adminId,
          action: dto.enabled ? "admin.country.enable" : "admin.country.disable",
          // target_id is a uuid column; the ISO code lives in metadata (like setKillSwitch).
          targetType: "country",
          ip,
          metadata: { code: norm, enabled: dto.enabled, reason: dto.reason, previous: row.enabled },
        },
        trx,
      );
    });

    this.countries.invalidate();
    return { countries: await this.countries.listAll() };
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

  async listAuditLogs(query: AdminAuditQuery): Promise<{
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
    const { fromDate, toDate } = dayRange(query.from, query.to);
    let rowsQuery = this.db.selectFrom("audit_logs");
    let countQuery = this.db.selectFrom("audit_logs");
    if (query.actorType) {
      rowsQuery = rowsQuery.where("actor_type", "=", query.actorType);
      countQuery = countQuery.where("actor_type", "=", query.actorType);
    }
    if (query.action) {
      const escaped = query.action.replace(/[\\%_]/g, (m) => `\\${m}`);
      rowsQuery = rowsQuery.where("action", "ilike", `%${escaped}%`);
      countQuery = countQuery.where("action", "ilike", `%${escaped}%`);
    }
    if (fromDate) {
      rowsQuery = rowsQuery.where("created_at", ">=", fromDate);
      countQuery = countQuery.where("created_at", ">=", fromDate);
    }
    if (toDate) {
      rowsQuery = rowsQuery.where("created_at", "<", toDate);
      countQuery = countQuery.where("created_at", "<", toDate);
    }

    const [rows, count] = await Promise.all([
      rowsQuery
        .select(["id", "actor_type", "actor_id", "action", "target_type", "target_id", "ip", "metadata", "created_at"])
        .orderBy("created_at", "desc")
        .orderBy("id", "desc")
        .limit(query.pageSize)
        .offset((query.page - 1) * query.pageSize)
        .execute(),
      countQuery.select((eb) => eb.fn.countAll<bigint>().as("n")).executeTakeFirstOrThrow(),
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
