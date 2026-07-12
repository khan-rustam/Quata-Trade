import { Inject, Injectable, Logger } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import type { Kysely } from "kysely";
import { DB } from "../../db/database.module";
import type { Database } from "../../db/types";
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

    const pending = await this.db
      .selectFrom("deposits")
      .select(["id", "block_number"])
      .where("status", "in", ["SEEN", "CONFIRMING"])
      .where("aml_hold", "=", false) // held (tainted-source) deposits await compliance, not re-scanned
      .orderBy("created_at", "asc")
      .execute();

    for (const deposit of pending) {
      // ORPHANED/unproven handling: without a block number depth is unknowable — skip.
      if (deposit.block_number === null) continue;
      if (height < deposit.block_number) continue; // node behind / reorg in progress

      const confirmations = this.toIntConfirmations(height - deposit.block_number);
      if (confirmations < this.cfg.confirmations) {
        await this.db
          .updateTable("deposits")
          .set({ confirmations, status: "CONFIRMING", updated_at: new Date() })
          .where("id", "=", deposit.id)
          .where("status", "in", ["SEEN", "CONFIRMING"])
          .execute();
        continue;
      }

      try {
        await this.credit(deposit.id, confirmations);
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
  private async credit(depositId: string, confirmations: number): Promise<void> {
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

      // AML inbound (item 4b): screen the on-chain sender before crediting. A
      // blocked source is HELD for manual compliance review — tainted funds are
      // never auto-credited. Deterministic lookup; no LLM in the AML path.
      if (deposit.from_address) {
        const res = await this.screening.check(deposit.asset, deposit.from_address);
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

      // Deposit policy (min/max on the GROSS amount) + platform fee, read live from
      // settings. A deposit outside the admin-configured band is HELD for manual review
      // (not auto-credited, not silently dropped) so an operator can decide.
      const policy = await this.settings.depositPolicy();
      const policyReason =
        deposit.amount < policy.minAmount
          ? "below the minimum deposit"
          : policy.maxAmount !== null && deposit.amount > policy.maxAmount
            ? "above the maximum deposit"
            : null;
      if (policyReason) {
        await trx
          .updateTable("deposits")
          .set({ policy_hold: true, policy_reason: policyReason, confirmations, updated_at: new Date() })
          .where("id", "=", deposit.id)
          .execute();
        return; // held — awaits manual review, never auto-credited
      }

      // An active deposit promo for the depositor's market WAIVES the platform fee
      // entirely (net = gross). Country is read within the tx for a consistent view.
      const depositor = await trx
        .selectFrom("users")
        .select("country")
        .where("id", "=", deposit.user_id)
        .executeTakeFirst();
      const waived = depositor ? await this.promo.depositWaived(depositor.country) : false;
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
