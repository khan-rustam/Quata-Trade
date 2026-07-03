import { Inject, Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { sql, type Kysely, type Selectable, type Transaction } from "kysely";
import * as argon2 from "argon2";
import { authenticator } from "otplib";
import { TronWeb } from "tronweb";
import type {
  AddWithdrawalAddressRequest,
  AdminRole,
  WithdrawalAddress,
  WithdrawalRequest,
  WithdrawalStatus,
} from "@quatatrade/shared";
import { DB } from "../../db/database.module";
import type { Database, UsersTable, WithdrawalsTable, WithdrawalAddressesTable } from "../../db/types";
import type { Env } from "../../config/env";
import { newId } from "../../common/ids";
import { AuditService } from "../../common/audit/audit.service";
import { LedgerService } from "../ledger/ledger.service";
import { SettingsService } from "../settings/settings.service";
import { ScreeningService } from "../screening/screening.service";
import { decryptSecret } from "./secret-crypto";
import { RISK_HOLD_SCORE, scoreWithdrawalRisk } from "./withdrawal-risk";
import {
  ApprovalNotAllowedError,
  DualApprovalError,
  IdempotencyConflictError,
  IllegalWithdrawalStateError,
  InvalidWithdrawalAddressError,
  WithdrawalAddressExistsError,
  WithdrawalCapExceededError,
  WithdrawalNotEligibleError,
  WithdrawalNotFoundError,
  WithdrawalsPausedError,
  WithdrawalVerificationError,
} from "./withdrawals.errors";

export type WithdrawalRow = Selectable<WithdrawalsTable>;
type UserRow = Selectable<UsersTable>;
type WithdrawalAddressRow = Selectable<WithdrawalAddressesTable>;

function toAddressWire(r: WithdrawalAddressRow): WithdrawalAddress {
  return {
    id: r.id,
    asset: r.asset,
    address: r.address,
    label: r.label,
    usableAt: r.usable_at.toISOString(),
    active: r.active,
    createdAt: r.created_at.toISOString(),
  };
}

const PIN_MAX_ATTEMPTS = 5;
const PIN_LOCK_MINUTES = 15;

/** RBAC matrix (Documents/06): approve = SUPER/FINANCE; 2nd-approve adds COMPLIANCE. */
const FIRST_APPROVER_ROLES: readonly AdminRole[] = ["SUPER_ADMIN", "FINANCE_ADMIN"];
const SECOND_APPROVER_ROLES: readonly AdminRole[] = ["SUPER_ADMIN", "FINANCE_ADMIN", "COMPLIANCE_ADMIN"];

/**
 * withdrawals — request → risk → approval → signer handoff (Documents/06).
 *
 * MONEY MODEL (all movements via LedgerService, all idempotent):
 * - request:  user_available −(amount+fee) → platform_pending_sweep +(amount+fee)
 *             reason withdrawal_debit, key = client idempotency key.
 * - settle:   platform_pending_sweep −(amount+fee) → external +amount, treasury +fee
 *             reason withdrawal_fee, key "withdrawal:<id>:settle" (on CONFIRMED).
 * - refund:   platform_pending_sweep −(amount+fee) → user_available +(amount+fee)
 *             reason adjustment, key "withdrawal:<id>:refund" (on REJECTED/FAILED).
 */
@Injectable()
export class WithdrawalsService {
  constructor(
    @Inject(DB) private readonly db: Kysely<Database>,
    private readonly ledger: LedgerService,
    private readonly settings: SettingsService,
    private readonly audit: AuditService,
    private readonly config: ConfigService<Env, true>,
    private readonly screening: ScreeningService,
  ) {}

  // ------------------------------------------------------------------ request

  // ------------------------------------------------------- address whitelist

  /** The user's saved withdrawal addresses (most recent first). */
  async listAddresses(userId: string): Promise<WithdrawalAddress[]> {
    const rows = await this.db
      .selectFrom("withdrawal_addresses")
      .selectAll()
      .where("user_id", "=", userId)
      .orderBy("created_at", "desc")
      .execute();
    return rows.map(toAddressWire);
  }

  /** Whitelist a destination; it enters a cooldown before it can be withdrawn to. */
  async addAddress(userId: string, dto: AddWithdrawalAddressRequest): Promise<WithdrawalAddress> {
    if (!TronWeb.isAddress(dto.address)) {
      throw new InvalidWithdrawalAddressError("destination is not a valid TRON address");
    }
    const own = await this.db
      .selectFrom("deposit_addresses")
      .select("id")
      .where("address", "=", dto.address)
      .executeTakeFirst();
    if (own) throw new InvalidWithdrawalAddressError("cannot whitelist a platform deposit address");

    // AML: refuse (and alert) if the destination is sanctioned/blacklisted.
    await this.screening.assertAllowed(dto.asset, dto.address, { userId, stage: "whitelist" });

    const existing = await this.db
      .selectFrom("withdrawal_addresses")
      .select("id")
      .where("user_id", "=", userId)
      .where("asset", "=", dto.asset)
      .where("address", "=", dto.address)
      .executeTakeFirst();
    if (existing) throw new WithdrawalAddressExistsError();

    const { newAddressMinutes } = await this.settings.securityHolds();
    const row = await this.db
      .insertInto("withdrawal_addresses")
      .values({
        id: newId(),
        user_id: userId,
        asset: dto.asset,
        address: dto.address,
        label: dto.label ?? null,
        usable_at: new Date(Date.now() + newAddressMinutes * 60_000),
      })
      .returningAll()
      .executeTakeFirstOrThrow();
    return toAddressWire(row);
  }

  /** Remove a whitelisted address (idempotent, owner-scoped). */
  async removeAddress(userId: string, id: string): Promise<void> {
    await this.db
      .deleteFrom("withdrawal_addresses")
      .where("id", "=", id)
      .where("user_id", "=", userId)
      .execute();
  }

  // ------------------------------------------------------------------ request

  async request(userId: string, dto: WithdrawalRequest): Promise<WithdrawalRow> {
    const { withdrawalsPaused } = await this.settings.killSwitches();
    if (withdrawalsPaused) throw new WithdrawalsPausedError();

    // Idempotent replay fast-path: same key → return the existing row without
    // re-running 2FA (retry-safe money op, Documents/04 §4.8). Keys are globally
    // unique — a key bound to another user is a hard conflict, never a leak.
    const existing = await this.db
      .selectFrom("withdrawals")
      .selectAll()
      .where("idempotency_key", "=", dto.idempotencyKey)
      .executeTakeFirst();
    if (existing) {
      if (existing.user_id !== userId) throw new IdempotencyConflictError();
      return existing;
    }

    const amount = BigInt(dto.amount);
    const user = await this.db.selectFrom("users").selectAll().where("id", "=", userId).executeTakeFirst();
    if (!user || user.status !== "active") throw new WithdrawalNotEligibleError("account is not active");
    if (!user.email_verified_at) throw new WithdrawalNotEligibleError("email verification required");
    if (user.kyc_tier < 1) throw new WithdrawalNotEligibleError("KYC verification (tier 1) required");
    if (!user.totp_enabled || !user.totp_secret_enc) {
      throw new WithdrawalNotEligibleError("two-factor authentication must be enabled for withdrawals");
    }

    this.verifyTotp(user, dto.totpCode);
    await this.verifyPin(user, dto.pin);

    if (!TronWeb.isAddress(dto.toAddress)) {
      throw new InvalidWithdrawalAddressError("destination is not a valid TRON address");
    }
    const ownAddress = await this.db
      .selectFrom("deposit_addresses")
      .select("id")
      .where("address", "=", dto.toAddress)
      .executeTakeFirst();
    if (ownAddress) {
      throw new InvalidWithdrawalAddressError("destination may not be a platform deposit address");
    }

    // Credential-change cooldown: no withdrawals during a post-reset / post-2FA hold.
    if (user.withdrawal_hold_until && user.withdrawal_hold_until.getTime() > Date.now()) {
      throw new WithdrawalNotEligibleError("withdrawals are on hold after a recent security change");
    }
    // Whitelist: destination MUST be a saved, active address past its cooldown.
    const approved = await this.db
      .selectFrom("withdrawal_addresses")
      .select(["active", "usable_at"])
      .where("user_id", "=", userId)
      .where("asset", "=", dto.asset)
      .where("address", "=", dto.toAddress)
      .executeTakeFirst();
    if (!approved || !approved.active) {
      throw new InvalidWithdrawalAddressError("destination is not an approved withdrawal address");
    }
    if (approved.usable_at.getTime() > Date.now()) {
      throw new InvalidWithdrawalAddressError("this address is still in its security cooldown");
    }
    // AML: re-screen at spend time — an address can be blacklisted AFTER it was
    // whitelisted. On a hit this raises an aml.hit alert and refuses the withdrawal.
    await this.screening.assertAllowed(dto.asset, dto.toAddress, { userId, stage: "withdrawal" });

    const fee = await this.settings.withdrawalFee(dto.asset);
    const caps = await this.settings.withdrawalCaps();
    const tier = await this.settings.kycTierLimits(user.kyc_tier);
    if (amount > caps.perTxMax) throw new WithdrawalCapExceededError("per-transaction withdrawal cap exceeded");
    const dailyLimit = caps.dailyMax < tier.dailyWithdrawal ? caps.dailyMax : tier.dailyWithdrawal;
    const total = amount + fee;

    return this.ledger.withMoneyTransaction(async (trx) => {
      // Serialize this user's cap check + insert against concurrent requests.
      // The daily aggregate is a SUM (not a locked balance row), so under READ
      // COMMITTED two parallel requests could each read the same usedToday and
      // both pass the cap (TOCTOU). A per-user advisory xact lock (held to commit)
      // makes the read+insert atomic per user without blocking other users.
      await sql`SELECT pg_advisory_xact_lock(hashtext('withdrawal_daily'), hashtext(${userId}))`.execute(trx);

      // Daily aggregate (today UTC, everything not REJECTED/FAILED) + this request.
      const usedToday = await this.dailyWithdrawnAmount(trx, userId);
      if (usedToday + amount > dailyLimit) {
        throw new WithdrawalCapExceededError("daily withdrawal cap exceeded");
      }

      // Deterministic risk scoring (no LLM — Documents/06 "risk").
      const [prior, recent] = await Promise.all([
        trx
          .selectFrom("withdrawals")
          .select((eb) => eb.fn.countAll<bigint>().as("n"))
          .where("user_id", "=", userId)
          .where("status", "not in", ["REJECTED", "FAILED"])
          .executeTakeFirstOrThrow(),
        trx
          .selectFrom("withdrawals")
          .select((eb) => eb.fn.countAll<bigint>().as("n"))
          .where("user_id", "=", userId)
          .where("created_at", ">=", new Date(Date.now() - 24 * 3_600_000))
          .executeTakeFirstOrThrow(),
      ]);
      const risk = scoreWithdrawalRisk({
        amount,
        tierDailyLimit: tier.dailyWithdrawal,
        priorWithdrawalCount: Number(prior.n),
        attemptsLast24h: Number(recent.n),
      });

      let status: WithdrawalStatus;
      let autoApproved = false;
      if (risk.score >= RISK_HOLD_SCORE) {
        status = "RISK_HOLD";
      } else if (amount < caps.autoApproveBelow && amount < caps.dualApprovalThreshold) {
        status = "APPROVED"; // policy auto-approval: approved_by stays null, audited as "auto"
        autoApproved = true;
      } else {
        status = "PENDING_APPROVAL";
      }

      const userAvailable = await this.ledger.getOrCreateAccount(userId, "user_available", dto.asset, trx);
      const pendingSweep = await this.ledger.getOrCreateAccount(null, "platform_pending_sweep", dto.asset, trx);

      const withdrawalId = newId();
      const { journalId, replayed } = await this.ledger.postJournal(
        {
          reason: "withdrawal_debit",
          referenceType: "withdrawal",
          referenceId: withdrawalId,
          idempotencyKey: dto.idempotencyKey,
          createdBy: `user:${userId}`,
          asset: dto.asset,
          legs: [
            { accountId: userAvailable, amount: -total },
            { accountId: pendingSweep, amount: total },
          ],
        },
        trx,
      );
      if (replayed) {
        // The key already owns a journal (concurrent retry — or a foreign key
        // reuse across modules/users). Only OUR committed withdrawal row makes
        // this a legitimate replay; anything else must not create a row.
        const raced = await trx
          .selectFrom("withdrawals")
          .selectAll()
          .where("idempotency_key", "=", dto.idempotencyKey)
          .executeTakeFirst();
        if (raced && raced.user_id === userId) return raced;
        throw new IdempotencyConflictError();
      }

      const row = await trx
        .insertInto("withdrawals")
        .values({
          id: withdrawalId,
          user_id: userId,
          asset: dto.asset,
          to_address: dto.toAddress,
          amount,
          fee,
          status,
          risk_score: risk.score,
          risk_flags: JSON.stringify(risk.flags),
          approved_by: null,
          second_approver: null,
          tx_hash: null,
          failure_reason: null,
          debit_journal_id: journalId,
          idempotency_key: dto.idempotencyKey,
        })
        .returningAll()
        .executeTakeFirstOrThrow();

      await this.enqueueOutbox(trx, "withdrawal.requested", {
        withdrawalId,
        userId,
        asset: dto.asset,
        amount: amount.toString(),
        fee: fee.toString(),
        status,
        riskScore: risk.score,
      });
      if (autoApproved) {
        await this.enqueueOutbox(trx, "withdrawal.approved", {
          withdrawalId,
          userId,
          amount: amount.toString(),
          approvedBy: null,
          note: "auto",
        });
      }
      await this.audit.log(
        {
          actorType: "user",
          actorId: userId,
          action: "withdrawal.requested",
          targetType: "withdrawal",
          targetId: withdrawalId,
          metadata: {
            amount: amount.toString(),
            fee: fee.toString(),
            status,
            riskScore: risk.score,
            ...(autoApproved ? { note: "auto" } : {}),
          },
        },
        trx,
      );

      return row;
    });
  }

  // ----------------------------------------------------------- admin decisions

  /**
   * Approve. Dual approval when amount >= dual_approval_threshold: the first
   * call records approved_by (status stays PENDING_APPROVAL), the second call
   * by a DIFFERENT admin records second_approver and moves to APPROVED.
   * The DB CHECK `big_needs_two` is the last-line backstop.
   */
  async approve(withdrawalId: string, adminId: string, adminRole: AdminRole): Promise<WithdrawalRow> {
    const caps = await this.settings.withdrawalCaps();
    return this.db.transaction().execute(async (trx) => {
      const wd = await trx
        .selectFrom("withdrawals")
        .selectAll()
        .where("id", "=", withdrawalId)
        .forUpdate()
        .executeTakeFirst();
      if (!wd) throw new WithdrawalNotFoundError(withdrawalId);
      if (wd.status !== "PENDING_APPROVAL" && wd.status !== "RISK_HOLD") {
        throw new IllegalWithdrawalStateError(wd.status, "approve");
      }

      const needsDual = wd.amount >= caps.dualApprovalThreshold;

      if (!needsDual) {
        this.requireRole(adminRole, FIRST_APPROVER_ROLES);
        const updated = await this.guardedUpdate(trx, withdrawalId, wd.status, {
          status: "APPROVED",
          approved_by: wd.approved_by ?? adminId,
        });
        await this.enqueueOutbox(trx, "withdrawal.approved", {
          withdrawalId,
          userId: wd.user_id,
          amount: wd.amount.toString(),
          approvedBy: adminId,
        });
        await this.auditApproval(trx, adminId, withdrawalId, wd.amount, "single");
        return updated;
      }

      if (wd.approved_by === null) {
        this.requireRole(adminRole, FIRST_APPROVER_ROLES);
        const updated = await this.guardedUpdate(trx, withdrawalId, wd.status, {
          status: "PENDING_APPROVAL", // stays pending until a second admin signs off
          approved_by: adminId,
        });
        await this.auditApproval(trx, adminId, withdrawalId, wd.amount, "first_of_two");
        return updated;
      }

      if (wd.approved_by === adminId) {
        throw new DualApprovalError("second approval must come from a different admin");
      }
      if (wd.second_approver !== null) throw new IllegalWithdrawalStateError(wd.status, "approve");
      this.requireRole(adminRole, SECOND_APPROVER_ROLES);
      const updated = await this.guardedUpdate(trx, withdrawalId, "PENDING_APPROVAL", {
        status: "APPROVED",
        second_approver: adminId,
      });
      await this.enqueueOutbox(trx, "withdrawal.approved", {
        withdrawalId,
        userId: wd.user_id,
        amount: wd.amount.toString(),
        approvedBy: wd.approved_by,
        secondApprover: adminId,
      });
      await this.auditApproval(trx, adminId, withdrawalId, wd.amount, "second_of_two");
      return updated;
    });
  }

  /** Reject a not-yet-approved withdrawal and refund the debit exactly once. */
  async reject(withdrawalId: string, adminId: string, reason: string): Promise<WithdrawalRow> {
    return this.ledger.withMoneyTransaction(async (trx) => {
      const wd = await trx
        .selectFrom("withdrawals")
        .selectAll()
        .where("id", "=", withdrawalId)
        .forUpdate()
        .executeTakeFirst();
      if (!wd) throw new WithdrawalNotFoundError(withdrawalId);
      if (wd.status === "REJECTED") return wd; // idempotent re-reject
      if (wd.status !== "REQUESTED" && wd.status !== "RISK_HOLD" && wd.status !== "PENDING_APPROVAL") {
        throw new IllegalWithdrawalStateError(wd.status, "reject");
      }

      const updated = await this.guardedUpdate(trx, withdrawalId, wd.status, {
        status: "REJECTED",
        failure_reason: reason,
      });
      await this.postRefund(trx, wd, `admin:${adminId}`);
      await this.enqueueOutbox(trx, "withdrawal.rejected", {
        withdrawalId,
        userId: wd.user_id,
        amount: wd.amount.toString(),
        reason,
      });
      await this.audit.log(
        {
          actorType: "admin",
          actorId: adminId,
          action: "withdrawal.reject",
          targetType: "withdrawal",
          targetId: withdrawalId,
          metadata: { amount: wd.amount.toString(), reason },
        },
        trx,
      );
      return updated;
    });
  }

  // -------------------------------------------------- pipeline (signer module)

  /** Ids ready for the signing pipeline, oldest first. */
  async listApprovedIds(limit: number): Promise<string[]> {
    const rows = await this.db
      .selectFrom("withdrawals")
      .select("id")
      .where("status", "=", "APPROVED")
      .orderBy("created_at", "asc")
      .limit(limit)
      .execute();
    return rows.map((r) => r.id);
  }

  /**
   * BROADCAST withdrawals awaiting on-chain confirmation, oldest first — polled
   * by the remote confirmation service (item 5). tx_hash is always set on
   * BROADCAST (markBroadcast sets it in the same guarded update).
   */
  async listBroadcast(limit: number): Promise<{ id: string; txHash: string; broadcastAt: Date }[]> {
    const rows = await this.db
      .selectFrom("withdrawals")
      .select(["id", "tx_hash", "updated_at"])
      .where("status", "=", "BROADCAST")
      .where("tx_hash", "is not", null)
      .orderBy("created_at", "asc")
      .limit(limit)
      .execute();
    const out: { id: string; txHash: string; broadcastAt: Date }[] = [];
    for (const r of rows) {
      if (r.tx_hash !== null && r.updated_at !== null) {
        out.push({ id: r.id, txHash: r.tx_hash, broadcastAt: r.updated_at });
      }
    }
    return out;
  }

  /** APPROVED → SIGNING. Guarded: false when another worker already claimed it. */
  async claimForSigning(withdrawalId: string): Promise<boolean> {
    const result = await this.db
      .updateTable("withdrawals")
      .set({ status: "SIGNING", updated_at: new Date() })
      .where("id", "=", withdrawalId)
      .where("status", "=", "APPROVED")
      .executeTakeFirst();
    return result.numUpdatedRows === 1n;
  }

  /** SIGNING → BROADCAST (+tx_hash). */
  async markBroadcast(withdrawalId: string, txHash: string): Promise<boolean> {
    const result = await this.db
      .updateTable("withdrawals")
      .set({ status: "BROADCAST", tx_hash: txHash, updated_at: new Date() })
      .where("id", "=", withdrawalId)
      .where("status", "=", "SIGNING")
      .executeTakeFirst();
    if (result.numUpdatedRows !== 1n) return false;
    await this.db
      .insertInto("outbox")
      .values({
        id: newId(),
        event_type: "withdrawal.broadcast",
        payload: JSON.stringify({ withdrawalId, txHash }),
      })
      .execute();
    return true;
  }

  /**
   * BROADCAST → CONFIRMED + settle journal:
   * pending_sweep −(amount+fee) → external +amount, treasury +fee.
   */
  async settleConfirmed(withdrawalId: string): Promise<boolean> {
    return this.ledger.withMoneyTransaction(async (trx) => {
      const wd = await trx
        .selectFrom("withdrawals")
        .selectAll()
        .where("id", "=", withdrawalId)
        .forUpdate()
        .executeTakeFirst();
      if (!wd || wd.status !== "BROADCAST") return false;

      const pendingSweep = await this.ledger.getOrCreateAccount(null, "platform_pending_sweep", wd.asset, trx);
      const external = await this.ledger.getOrCreateAccount(null, "external", wd.asset, trx);
      const treasury = await this.ledger.getOrCreateAccount(null, "platform_treasury", wd.asset, trx);
      const total = wd.amount + wd.fee;
      const legs =
        wd.fee > 0n
          ? [
              { accountId: pendingSweep, amount: -total },
              { accountId: external, amount: wd.amount },
              { accountId: treasury, amount: wd.fee },
            ]
          : [
              { accountId: pendingSweep, amount: -total },
              { accountId: external, amount: wd.amount },
            ];
      await this.ledger.postJournal(
        {
          reason: "withdrawal_fee",
          referenceType: "withdrawal",
          referenceId: wd.id,
          idempotencyKey: `withdrawal:${wd.id}:settle`,
          createdBy: "system",
          asset: wd.asset,
          legs,
        },
        trx,
      );
      await this.guardedUpdate(trx, withdrawalId, "BROADCAST", { status: "CONFIRMED" });
      await this.enqueueOutbox(trx, "withdrawal.confirmed", {
        withdrawalId,
        userId: wd.user_id,
        amount: wd.amount.toString(),
        fee: wd.fee.toString(),
        txHash: wd.tx_hash,
      });
      await this.audit.log(
        {
          actorType: "system",
          actorId: null,
          action: "withdrawal.confirmed",
          targetType: "withdrawal",
          targetId: withdrawalId,
          metadata: { amount: wd.amount.toString(), fee: wd.fee.toString() },
        },
        trx,
      );
      return true;
    });
  }

  /**
   * SIGNING → FAILED + refund exactly once. Only pre-broadcast failures refund;
   * anything already BROADCAST may be on-chain and needs human reconciliation.
   */
  async markFailed(withdrawalId: string, reason: string): Promise<boolean> {
    const safeReason = reason.slice(0, 500);
    return this.ledger.withMoneyTransaction(async (trx) => {
      const wd = await trx
        .selectFrom("withdrawals")
        .selectAll()
        .where("id", "=", withdrawalId)
        .forUpdate()
        .executeTakeFirst();
      if (!wd || wd.status !== "SIGNING") return false;

      await this.guardedUpdate(trx, withdrawalId, "SIGNING", {
        status: "FAILED",
        failure_reason: safeReason,
      });
      await this.postRefund(trx, wd, "system");
      await this.enqueueOutbox(trx, "withdrawal.failed", {
        withdrawalId,
        userId: wd.user_id,
        amount: wd.amount.toString(),
        reason: safeReason,
      });
      await this.audit.log(
        {
          actorType: "system",
          actorId: null,
          action: "withdrawal.failed",
          targetType: "withdrawal",
          targetId: withdrawalId,
          metadata: { amount: wd.amount.toString(), reason: safeReason },
        },
        trx,
      );
      return true;
    });
  }

  // -------------------------------------------------------------------- reads

  /** Owner-scoped fetch — null (→404) instead of leaking others' rows (IDOR). */
  async getForUser(withdrawalId: string, userId: string): Promise<WithdrawalRow | null> {
    const row = await this.db
      .selectFrom("withdrawals")
      .selectAll()
      .where("id", "=", withdrawalId)
      .executeTakeFirst();
    if (!row || row.user_id !== userId) return null;
    return row;
  }

  async listForUser(
    userId: string,
    page: number,
    pageSize: number,
  ): Promise<{ items: WithdrawalRow[]; total: number }> {
    const [items, count] = await Promise.all([
      this.db
        .selectFrom("withdrawals")
        .selectAll()
        .where("user_id", "=", userId)
        .orderBy("created_at", "desc")
        .limit(pageSize)
        .offset((page - 1) * pageSize)
        .execute(),
      this.db
        .selectFrom("withdrawals")
        .select((eb) => eb.fn.countAll<bigint>().as("n"))
        .where("user_id", "=", userId)
        .executeTakeFirstOrThrow(),
    ]);
    return { items, total: Number(count.n) };
  }

  // ------------------------------------------------------------------ private

  private masterKey(): Buffer {
    const keyB64: string = this.config.get("MASTER_ENCRYPTION_KEY", { infer: true });
    return Buffer.from(keyB64, "base64");
  }

  private verifyTotp(user: UserRow, code: string): void {
    if (!user.totp_secret_enc) throw new WithdrawalVerificationError();
    let secret: string;
    try {
      secret = decryptSecret(user.totp_secret_enc, this.masterKey());
    } catch {
      throw new WithdrawalVerificationError();
    }
    if (!authenticator.verify({ token: code, secret })) {
      throw new WithdrawalVerificationError();
    }
  }

  /** PIN check with brute-force lockout (5 attempts → 15 min). Errors stay generic. */
  private async verifyPin(user: UserRow, pin: string): Promise<void> {
    if (!user.pin_hash) throw new WithdrawalVerificationError();
    if (user.pin_locked_until && user.pin_locked_until.getTime() > Date.now()) {
      throw new WithdrawalVerificationError();
    }
    const ok = await argon2.verify(user.pin_hash, pin).catch(() => false);
    if (ok) {
      if (user.pin_attempts > 0 || user.pin_locked_until) {
        await this.db
          .updateTable("users")
          .set({ pin_attempts: 0, pin_locked_until: null, updated_at: new Date() })
          .where("id", "=", user.id)
          .execute();
      }
      return;
    }
    const bumped = await this.db
      .updateTable("users")
      .set((eb) => ({ pin_attempts: eb("pin_attempts", "+", 1), updated_at: new Date() }))
      .where("id", "=", user.id)
      .returning("pin_attempts")
      .executeTakeFirst();
    if (bumped && bumped.pin_attempts >= PIN_MAX_ATTEMPTS) {
      await this.db
        .updateTable("users")
        .set({
          pin_attempts: 0,
          pin_locked_until: new Date(Date.now() + PIN_LOCK_MINUTES * 60_000),
          updated_at: new Date(),
        })
        .where("id", "=", user.id)
        .execute();
    }
    throw new WithdrawalVerificationError();
  }

  private async dailyWithdrawnAmount(trx: Transaction<Database>, userId: string): Promise<bigint> {
    const startOfDayUtc = new Date();
    startOfDayUtc.setUTCHours(0, 0, 0, 0);
    const agg = await trx
      .selectFrom("withdrawals")
      .select(sql<bigint>`COALESCE(SUM(amount), 0)::int8`.as("total"))
      .where("user_id", "=", userId)
      .where("created_at", ">=", startOfDayUtc)
      .where("status", "not in", ["REJECTED", "FAILED"])
      .executeTakeFirst();
    return agg?.total ?? 0n;
  }

  /** Refund the request debit: pending_sweep −(amount+fee) → user_available +(amount+fee). */
  private async postRefund(trx: Transaction<Database>, wd: WithdrawalRow, actor: string): Promise<void> {
    const pendingSweep = await this.ledger.getOrCreateAccount(null, "platform_pending_sweep", wd.asset, trx);
    const userAvailable = await this.ledger.getOrCreateAccount(wd.user_id, "user_available", wd.asset, trx);
    const total = wd.amount + wd.fee;
    await this.ledger.postJournal(
      {
        reason: "adjustment",
        referenceType: "withdrawal",
        referenceId: wd.id,
        idempotencyKey: `withdrawal:${wd.id}:refund`,
        createdBy: actor,
        asset: wd.asset,
        legs: [
          { accountId: pendingSweep, amount: -total },
          { accountId: userAvailable, amount: total },
        ],
      },
      trx,
    );
  }

  /** Status transition guarded by `WHERE status = expected` — double-processing impossible. */
  private async guardedUpdate(
    trx: Transaction<Database>,
    withdrawalId: string,
    expectedStatus: WithdrawalStatus,
    set: Partial<{
      status: WithdrawalStatus;
      approved_by: string;
      second_approver: string;
      failure_reason: string;
    }>,
  ): Promise<WithdrawalRow> {
    const updated = await trx
      .updateTable("withdrawals")
      .set({ ...set, updated_at: new Date() })
      .where("id", "=", withdrawalId)
      .where("status", "=", expectedStatus)
      .returningAll()
      .executeTakeFirst();
    if (!updated) throw new IllegalWithdrawalStateError(expectedStatus, "transition");
    return updated;
  }

  private requireRole(role: AdminRole, allowed: readonly AdminRole[]): void {
    if (!allowed.includes(role)) {
      throw new ApprovalNotAllowedError(`role ${role} may not approve withdrawals`);
    }
  }

  private async auditApproval(
    trx: Transaction<Database>,
    adminId: string,
    withdrawalId: string,
    amount: bigint,
    stage: "single" | "first_of_two" | "second_of_two",
  ): Promise<void> {
    await this.audit.log(
      {
        actorType: "admin",
        actorId: adminId,
        action: "withdrawal.approve",
        targetType: "withdrawal",
        targetId: withdrawalId,
        metadata: { amount: amount.toString(), stage },
      },
      trx,
    );
  }

  private async enqueueOutbox(
    trx: Transaction<Database>,
    eventType: string,
    payload: Record<string, unknown>,
  ): Promise<void> {
    await trx
      .insertInto("outbox")
      .values({ id: newId(), event_type: eventType, payload: JSON.stringify(payload) })
      .execute();
  }
}
