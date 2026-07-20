import { Inject, Injectable, Logger } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import { sql, type Kysely, type Transaction } from "kysely";
import { DB } from "../../db/database.module";
import type { Database } from "../../db/types";
import type { AssetCode } from "@quatatrade/shared";
import { newId } from "../../common/ids";
import { LedgerService } from "../ledger/ledger.service";
import { AuditService } from "../../common/audit/audit.service";
import { ScreeningService } from "../screening/screening.service";
import { SettingsService } from "../settings/settings.service";
import { PromoService } from "../promo/promo.service";
import { computeDepositFee } from "../fees/fees";
import { DEPOSITS_CONFIG, type DepositsConfig } from "./deposits.config";
import { TRONGRID_CLIENT, type TronGridClient } from "./trongrid.client";

const MAX_CONSECUTIVE_FAILURES = 5;
const PAUSE_MS = 5 * 60_000;

/**
 * deposits confirmation (Documents/06, 08 §D): tracks block depth for
 * SEEN/CONFIRMING deposits and credits ONCE when depth ≥ DEPOSIT_CONFIRMATIONS.
 * Credit = ledger.postJournal(deposit_credit, external −amount / user_available
 * +amount) with idempotencyKey "deposit:<tx_hash>:<log_index>", the status flip
 * to CREDITED and the outbox event all in the SAME money transaction.
 * block_number null (mempool / meta unresolved / potential orphan) → skipped.
 */
@Injectable()
export class DepositConfirmationService {
  private readonly logger = new Logger(DepositConfirmationService.name);
  private running = false;
  private consecutiveFailures = 0;
  private pausedUntil = 0;

  constructor(
    @Inject(DB) private readonly db: Kysely<Database>,
    @Inject(TRONGRID_CLIENT) private readonly client: TronGridClient,
    @Inject(DEPOSITS_CONFIG) private readonly cfg: DepositsConfig,
    private readonly ledger: LedgerService,
    private readonly audit: AuditService,
    private readonly screening: ScreeningService,
    private readonly settings: SettingsService,
    private readonly promo: PromoService,
  ) {}

  @Cron(CronExpression.EVERY_30_SECONDS)
  async tick(): Promise<void> {
    if (this.running || Date.now() < this.pausedUntil) return;
    this.running = true;
    try {
      await this.confirmOnce();
    } finally {
      this.running = false;
    }
  }

  /** One confirmation pass over every pending (SEEN/CONFIRMING) deposit. */
  async confirmOnce(): Promise<void> {
    let height: bigint;
    try {
      height = await this.client.getCurrentBlockNumber();
      this.noteSuccess();
    } catch (err) {
      this.noteFailure(err);
      return;
    }

    // ONE source of truth for the threshold: the admin setting, floored by env.
    const requiredConfirmations = await this.settings.depositConfirmations(this.cfg.confirmations);

    const pending = await this.db
      .selectFrom("deposits")
      .select(["id", "block_number"])
      .where("status", "in", ["SEEN", "CONFIRMING"])
      .where("aml_hold", "=", false) // held (tainted-source) deposits await compliance, not re-scanned
      // Policy-held deposits (outside the min/max band) also await a human. Without
      // this filter every held row re-opened a money transaction and re-hit the
      // external screening API every 30s, forever.
      .where("policy_hold", "=", false)
      .orderBy("created_at", "asc")
      .execute();

    for (const deposit of pending) {
      // ORPHANED/unproven handling: without a block number depth is unknowable — skip.
      if (deposit.block_number === null) continue;
      if (height < deposit.block_number) continue; // node behind / reorg in progress

      const confirmations = this.toIntConfirmations(height - deposit.block_number);
      if (confirmations < requiredConfirmations) {
        await this.db
          .updateTable("deposits")
          .set({ confirmations, status: "CONFIRMING", updated_at: new Date() })
          .where("id", "=", deposit.id)
          .where("status", "in", ["SEEN", "CONFIRMING"])
          .execute();
        continue;
      }

      try {
        await this.credit(deposit.id, confirmations, requiredConfirmations);
      } catch (err) {
        // isolated failure must not block the rest of the batch; retried next tick
        this.logger.error(
          `deposit credit failed (id=${deposit.id}): ${err instanceof Error ? err.message : "unknown error"}`,
        );
      }
    }
  }

  /**
   * Credit exactly once. Row lock + status guard + the UNIQUE idempotency key
   * on the journal make this safe under replays, crashes and races.
   */
  private async credit(depositId: string, confirmations: number, requiredConfirmations: number): Promise<void> {
    // ── Pre-flight, OUTSIDE the money transaction ────────────────────────────
    // Every network/second-connection call happens here. Doing them inside the
    // transaction held a pool slot while acquiring another (pool max 20), which
    // could deadlock the pool under concurrent credits. Everything decided here is
    // RE-CHECKED under the row lock below, so a stale pre-read is never trusted.
    const pre = await this.db.selectFrom("deposits").selectAll().where("id", "=", depositId).executeTakeFirst();
    if (!pre) return;
    if (pre.status !== "SEEN" && pre.status !== "CONFIRMING") return;

    // Re-verify the transaction is STILL on-chain and successful immediately before
    // crediting. Between the scan and now the block may have been reorged out; without
    // this the ledger would mint permanent phantom balance that no control detects.
    const onChain = await this.client.getTransactionStatus(pre.tx_hash).catch(() => null);
    if (onChain === null) {
      this.logger.warn(`deposit ${pre.id}: tx ${pre.tx_hash} not confirmable right now — deferring credit`);
      return; // transient or orphaned; the orphan sweep decides which
    }
    if (!onChain.success) {
      this.logger.error(`deposit ${pre.id}: tx ${pre.tx_hash} reverted on-chain — never crediting`);
      return;
    }
    if (onChain.confirmations < requiredConfirmations) return; // depth regressed (reorg) — wait

    const screened = pre.from_address ? await this.screening.check(pre.asset, pre.from_address) : null;
    const policy = await this.settings.depositPolicy();
    const limits = await this.settings.launchLimits();
    const depositorCountry = (
      await this.db.selectFrom("users").select("country").where("id", "=", pre.user_id).executeTakeFirst()
    )?.country;
    const waived = depositorCountry ? await this.promo.depositWaived(depositorCountry) : false;

    await this.ledger.withMoneyTransaction(async (trx) => {
      const deposit = await trx
        .selectFrom("deposits")
        .selectAll()
        .where("id", "=", depositId)
        .forUpdate()
        .executeTakeFirst();
      if (!deposit) return;
      // Guard: only pending deposits are creditable — CREDITED (already done),
      // IGNORED_DUST and ORPHANED must never reach postJournal.
      if (deposit.status !== "SEEN" && deposit.status !== "CONFIRMING") return;

      // Defence in depth against a duplicate row for the SAME on-chain transfer.
      // The ledger idempotency key is `deposit:<tx>:<logIndex>`; if two rows ever
      // carried different log indexes for one transfer they would BOTH credit.
      // Same tx + same user + same amount already credited ⇒ this row is a duplicate.
      const twin = await trx
        .selectFrom("deposits")
        .select("id")
        .where("tx_hash", "=", deposit.tx_hash)
        .where("status", "=", "CREDITED")
        .where("user_id", "=", deposit.user_id)
        .where("amount", "=", deposit.amount)
        .where("id", "!=", deposit.id)
        .executeTakeFirst();
      if (twin) {
        this.logger.error(
          `deposit ${deposit.id}: duplicate of already-credited ${twin.id} (tx ${deposit.tx_hash}) — marking ORPHANED, not crediting`,
        );
        await trx
          .updateTable("deposits")
          .set({ status: "ORPHANED", policy_reason: `duplicate of ${twin.id}`, updated_at: new Date() })
          .where("id", "=", deposit.id)
          .execute();
        await trx
          .insertInto("outbox")
          .values({
            id: newId(),
            event_type: "deposit.duplicate_blocked",
            payload: JSON.stringify({ depositId: deposit.id, twinId: twin.id, txHash: deposit.tx_hash }),
          })
          .execute();
        return;
      }

      // AML inbound (item 4b): screen the on-chain sender before crediting. A
      // blocked source is HELD for manual compliance review — tainted funds are
      // never auto-credited. Deterministic lookup; no LLM in the AML path.
      // An admin RELEASE is an explicit override of exactly these two gates. Without
      // this the release would clear the flags, the deterministic rule would fire
      // again on the next tick, and the deposit would re-hold forever.
      const released = deposit.hold_resolution === "RELEASED";

      if (!released && deposit.from_address && screened) {
        const res = screened;
        if (res.blocked) {
          await trx
            .updateTable("deposits")
            .set({ aml_hold: true, aml_reason: res.reason, updated_at: new Date() })
            .where("id", "=", deposit.id)
            .execute();
          await trx
            .insertInto("outbox")
            .values({
              id: newId(),
              event_type: "aml.hit",
              payload: JSON.stringify({
                depositId: deposit.id,
                userId: deposit.user_id,
                asset: deposit.asset,
                address: deposit.from_address,
                category: res.category,
                reason: res.reason,
                stage: "deposit",
              }),
            })
            .execute();
          return; // do NOT credit tainted funds
        }
      }

      // Deposit policy (min/max on the GROSS amount) AND the launch-protection
      // ceilings. A deposit outside any of these is HELD for manual review — never
      // auto-credited, never silently dropped. The ceilings were previously stored
      // and displayed but never enforced; they are real controls now.
      const policyReason = released ? null : await this.holdReason(trx, deposit, policy, limits);
      if (policyReason) {
        await trx
          .updateTable("deposits")
          .set({ policy_hold: true, policy_reason: policyReason, confirmations, updated_at: new Date() })
          .where("id", "=", deposit.id)
          .execute();
        // Surface the hold: previously a held deposit produced NO event, NO alert and
        // NO queue entry, so a user's funds could freeze silently and indefinitely.
        await trx
          .insertInto("outbox")
          .values({
            id: newId(),
            event_type: "deposit.policy_hold",
            payload: JSON.stringify({
              depositId: deposit.id,
              userId: deposit.user_id,
              asset: deposit.asset,
              amount: deposit.amount.toString(),
              reason: policyReason,
              txHash: deposit.tx_hash,
            }),
          })
          .execute();
        return; // held — awaits manual review, never auto-credited
      }

      const fee = waived ? 0n : computeDepositFee(deposit.amount, policy.feeFixed, policy.feeBps);
      const net = deposit.amount - fee; // net > 0 — the config refine guarantees fee < min <= amount

      const external = await this.ledger.getOrCreateAccount(null, "external", deposit.asset, trx);
      const userAvailable = await this.ledger.getOrCreateAccount(deposit.user_id, "user_available", deposit.asset, trx);

      // external −gross, user +net, treasury +fee (balanced). Skip the fee leg when 0
      // (a zero-amount ledger entry violates the amount<>0 CHECK).
      const legs =
        fee > 0n
          ? [
              { accountId: external, amount: -deposit.amount },
              { accountId: userAvailable, amount: net },
              {
                accountId: await this.ledger.getOrCreateAccount(null, "platform_treasury", deposit.asset, trx),
                amount: fee,
              },
            ]
          : [
              { accountId: external, amount: -deposit.amount },
              { accountId: userAvailable, amount: deposit.amount },
            ];

      const { journalId } = await this.ledger.postJournal(
        {
          reason: "deposit_credit",
          referenceType: "deposit",
          referenceId: deposit.id,
          idempotencyKey: `deposit:${deposit.tx_hash}:${deposit.log_index}`,
          createdBy: "system",
          asset: deposit.asset,
          legs,
        },
        trx,
      );

      await trx
        .updateTable("deposits")
        .set({ status: "CREDITED", credited_journal_id: journalId, fee, confirmations, updated_at: new Date() })
        .where("id", "=", deposit.id)
        .execute();

      await trx
        .insertInto("outbox")
        .values({
          id: newId(),
          event_type: "deposit.credited",
          payload: JSON.stringify({
            depositId: deposit.id,
            userId: deposit.user_id,
            asset: deposit.asset,
            amount: deposit.amount.toString(), // gross
            fee: fee.toString(),
            net: net.toString(),
            txHash: deposit.tx_hash,
            logIndex: deposit.log_index,
            journalId,
          }),
        })
        .execute();

      // Immutable audit trail for the deposit credit (spec: admin audit log per deposit).
      await this.audit.log(
        {
          actorType: "system",
          actorId: null,
          action: "deposit.credited",
          targetType: "deposit",
          targetId: deposit.id,
          metadata: {
            userId: deposit.user_id,
            asset: deposit.asset,
            amount: deposit.amount.toString(),
            fee: fee.toString(),
            net: net.toString(),
            txHash: deposit.tx_hash,
            logIndex: deposit.log_index,
            journalId,
          },
        },
        trx,
      );
    });
  }

  /**
   * Orphan sweep: re-check recently CREDITED deposits are STILL on-chain.
   *
   * A reorg after crediting leaves phantom balance that no other control detects
   * (the reserve check's obligations formula excludes user_available). Deliberately
   * ALERT-ONLY — it marks the deposit ORPHANED, pauses withdrawals and pages a human,
   * but NEVER auto-reverses the ledger: a transient RPC inconsistency must not be able
   * to claw back a legitimate user deposit. A human corrects it via the audited
   * ledger-adjustment tool.
   */
  @Cron(CronExpression.EVERY_10_MINUTES)
  async orphanSweep(): Promise<void> {
    const recent = await this.db
      .selectFrom("deposits")
      .select(["id", "tx_hash", "user_id", "asset", "amount"])
      .where("status", "=", "CREDITED")
      // Only the window where a reorg is still plausible; older is settled history.
      .where("updated_at", ">", new Date(Date.now() - 6 * 60 * 60 * 1000))
      .orderBy("updated_at", "desc")
      .limit(200)
      .execute();

    for (const d of recent) {
      let status: Awaited<ReturnType<TronGridClient["getTransactionStatus"]>>;
      try {
        status = await this.client.getTransactionStatus(d.tx_hash);
      } catch {
        continue; // RPC hiccup — never conclude "orphaned" from a failed read
      }
      // null = not found. Only treat as orphaned when the node is healthy enough to
      // have answered; a single miss is not proof, so we require a definite response.
      if (status !== null && status.success) continue;
      if (status === null) continue; // unknown ≠ orphaned; re-checked next sweep

      // status.success === false ⇒ the tx is mined but reverted: it should never
      // have been credited. Flag loudly for manual ledger correction.
      this.logger.error(`deposit ${d.id}: credited tx ${d.tx_hash} is NOT successful on-chain — ORPHANED`);
      await this.db
        .updateTable("deposits")
        .set({ status: "ORPHANED", updated_at: new Date() })
        .where("id", "=", d.id)
        .where("status", "=", "CREDITED")
        .execute();
      await this.db
        .insertInto("outbox")
        .values({
          id: newId(),
          event_type: "deposit.orphaned",
          payload: JSON.stringify({
            depositId: d.id,
            userId: d.user_id,
            asset: d.asset,
            amount: d.amount.toString(),
            txHash: d.tx_hash,
            action: "manual ledger adjustment required — balance was already credited",
          }),
        })
        .execute();
      // Freeze payouts until a human has reconciled the phantom balance.
      await this.settings.pauseWithdrawals();
    }
  }

  /**
   * Why this deposit must be HELD rather than credited, or null to proceed.
   *
   * Covers the admin min/max band AND the launch-protection ceilings
   * (per-user balance, per-user 24h deposit volume, total platform custody).
   * The ceilings are read live from settings; a value of 0 means "no ceiling".
   * Every comparison is bigint smallest-units — no float anywhere.
   */
  private async holdReason(
    trx: Transaction<Database>,
    deposit: { user_id: string; asset: AssetCode; amount: bigint },
    policy: { minAmount: bigint; maxAmount: bigint | null },
    limits: { maxUserBalance: bigint; maxDailyDepositPerUser: bigint; maxPlatformCustody: bigint },
  ): Promise<string | null> {
    if (deposit.amount < policy.minAmount) return "below the minimum deposit";
    if (policy.maxAmount !== null && deposit.amount > policy.maxAmount) return "above the maximum deposit";

    // Per-user wallet ceiling: current available balance + this deposit.
    if (limits.maxUserBalance > 0n) {
      const account = await this.ledger.getOrCreateAccount(deposit.user_id, "user_available", deposit.asset, trx);
      const balance = await this.ledger.balanceOf(account, trx);
      if (balance + deposit.amount > limits.maxUserBalance) return "exceeds the maximum wallet balance per user";
    }

    // Per-user rolling 24h deposit volume (already-credited deposits + this one).
    if (limits.maxDailyDepositPerUser > 0n) {
      const row = await trx
        .selectFrom("deposits")
        .select(sql<string>`COALESCE(SUM(amount),0)::text`.as("total"))
        .where("user_id", "=", deposit.user_id)
        .where("asset", "=", deposit.asset)
        .where("status", "=", "CREDITED")
        .where("created_at", ">", new Date(Date.now() - 24 * 60 * 60 * 1000))
        .executeTakeFirst();
      const last24h = BigInt(row?.total ?? "0");
      if (last24h + deposit.amount > limits.maxDailyDepositPerUser) return "exceeds the daily deposit limit per user";
    }

    // Total platform custody ceiling (sum of all user available balances).
    if (limits.maxPlatformCustody > 0n) {
      const row = await trx
        .selectFrom("account_balances")
        .innerJoin("accounts", "accounts.id", "account_balances.account_id")
        .select(sql<string>`COALESCE(SUM(account_balances.balance),0)::text`.as("total"))
        .where("accounts.kind", "=", "user_available")
        .where("accounts.asset", "=", deposit.asset)
        .executeTakeFirst();
      const custody = BigInt(row?.total ?? "0");
      if (custody + deposit.amount > limits.maxPlatformCustody) return "exceeds the maximum platform custody";
    }

    return null;
  }

  /** height − block_number as a safe int (confirmations column is int4). */
  private toIntConfirmations(depth: bigint): number {
    return depth > 2_000_000_000n ? 2_000_000_000 : Number(depth);
  }

  private noteSuccess(): void {
    this.consecutiveFailures = 0;
  }

  private noteFailure(err: unknown): void {
    this.consecutiveFailures += 1;
    this.logger.warn(
      `TronGrid height failure ${this.consecutiveFailures}/${MAX_CONSECUTIVE_FAILURES}: ${
        err instanceof Error ? err.message : "unknown error"
      }`,
    );
    if (this.consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
      this.pausedUntil = Date.now() + PAUSE_MS;
      this.consecutiveFailures = 0;
      this.logger.error(`confirmations paused for ${PAUSE_MS / 60_000} min after repeated RPC failures`);
    }
  }
}
