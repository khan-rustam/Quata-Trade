import { Inject, Injectable, Logger } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import type { Kysely } from "kysely";
import { DB } from "../../db/database.module";
import type { Database } from "../../db/types";
import { newId } from "../../common/ids";
import { LedgerService } from "../ledger/ledger.service";
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

      const external = await this.ledger.getOrCreateAccount(null, "external", deposit.asset, trx);
      const userAvailable = await this.ledger.getOrCreateAccount(deposit.user_id, "user_available", deposit.asset, trx);

      const { journalId } = await this.ledger.postJournal(
        {
          reason: "deposit_credit",
          referenceType: "deposit",
          referenceId: deposit.id,
          idempotencyKey: `deposit:${deposit.tx_hash}:${deposit.log_index}`,
          createdBy: "system",
          asset: deposit.asset,
          legs: [
            { accountId: external, amount: -deposit.amount },
            { accountId: userAvailable, amount: deposit.amount },
          ],
        },
        trx,
      );

      await trx
        .updateTable("deposits")
        .set({ status: "CREDITED", credited_journal_id: journalId, confirmations, updated_at: new Date() })
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
            amount: deposit.amount.toString(),
            txHash: deposit.tx_hash,
            logIndex: deposit.log_index,
            journalId,
          }),
        })
        .execute();
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
