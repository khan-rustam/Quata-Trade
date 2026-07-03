import { Inject, Injectable, Logger } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import type { Kysely } from "kysely";
import type { AssetCode, DepositStatus } from "@quatatrade/shared";
import { DB } from "../../db/database.module";
import type { Database } from "../../db/types";
import { newId } from "../../common/ids";
import { DEPOSITS_CONFIG, type DepositsConfig } from "./deposits.config";
import { TRONGRID_CLIENT, type TronGridClient, type Trc20Transfer } from "./trongrid.client";

const MAX_CONSECUTIVE_FAILURES = 5;
const PAUSE_MS = 5 * 60_000;

interface WatchedAddress {
  address: string;
  user_id: string;
  asset: AssetCode;
}

/**
 * deposits scanner (Documents/06 "deposits"): polls TronGrid for incoming
 * TRC20 transfers to every active deposit address and records them. NEVER
 * credits — crediting is DepositConfirmationService's job after the
 * confirmation threshold. Safe to run overlapping / re-deliver:
 * UNIQUE(tx_hash, log_index) + ON CONFLICT DO NOTHING make recording idempotent.
 */
@Injectable()
export class DepositScannerService {
  private readonly logger = new Logger(DepositScannerService.name);
  private running = false;
  private consecutiveFailures = 0;
  private pausedUntil = 0;

  constructor(
    @Inject(DB) private readonly db: Kysely<Database>,
    @Inject(TRONGRID_CLIENT) private readonly client: TronGridClient,
    @Inject(DEPOSITS_CONFIG) private readonly cfg: DepositsConfig,
  ) {}

  @Cron(CronExpression.EVERY_30_SECONDS)
  async tick(): Promise<void> {
    if (this.running || Date.now() < this.pausedUntil) return;
    this.running = true;
    try {
      await this.scanOnce();
    } finally {
      this.running = false;
    }
  }

  /** One full pass over all active deposit addresses. Aborts the pass on RPC failure. */
  async scanOnce(): Promise<void> {
    const addresses: WatchedAddress[] = await this.db
      .selectFrom("deposit_addresses")
      .select(["address", "user_id", "asset"])
      .where("active", "=", true)
      .execute();

    for (const watched of addresses) {
      let transfers: Trc20Transfer[];
      try {
        transfers = await this.client.getTrc20TransfersTo(watched.address);
        this.noteSuccess();
      } catch (err) {
        this.noteFailure(err);
        return; // circuit-breaker-lite: skip the rest of this pass
      }
      for (const transfer of transfers) {
        await this.recordTransfer(watched, transfer);
      }
    }
  }

  /**
   * Record one on-chain transfer. Gate order matters:
   * 1. must actually be TO our address,
   * 2. token contract must EXACTLY equal canonical USDT (fake-token rejection),
   * 3. positive amount,
   * 4. dust (< min) recorded as IGNORED_DUST so it is visible but never credited,
   * 5. idempotent upsert via ON CONFLICT (tx_hash, log_index) DO NOTHING.
   */
  private async recordTransfer(watched: WatchedAddress, transfer: Trc20Transfer): Promise<void> {
    if (transfer.to !== watched.address) return;
    if (transfer.contract !== this.cfg.usdtContract) {
      this.logger.warn(`rejected non-canonical token contract (tx=${transfer.txHash} log=${transfer.logIndex})`);
      return;
    }
    if (transfer.amount <= 0n) return;

    const status: DepositStatus = transfer.amount < this.cfg.minAmount ? "IGNORED_DUST" : "SEEN";
    const result = await this.db
      .insertInto("deposits")
      .values({
        id: newId(),
        user_id: watched.user_id,
        asset: watched.asset,
        address: watched.address,
        tx_hash: transfer.txHash,
        log_index: transfer.logIndex,
        amount: transfer.amount,
        token_contract: transfer.contract,
        block_number: transfer.blockNumber,
        from_address: transfer.from, // on-chain sender — screened at credit time (item 4b)
        status,
      })
      .onConflict((oc) => oc.columns(["tx_hash", "log_index"]).doNothing())
      .executeTakeFirst();

    // Replay of a row first seen without a block number (e.g. mempool / RPC
    // hiccup): fill it in so the confirmation job can start counting depth.
    if ((result.numInsertedOrUpdatedRows ?? 0n) === 0n && transfer.blockNumber !== null) {
      await this.db
        .updateTable("deposits")
        .set({ block_number: transfer.blockNumber, updated_at: new Date() })
        .where("tx_hash", "=", transfer.txHash)
        .where("log_index", "=", transfer.logIndex)
        .where("block_number", "is", null)
        .where("status", "in", ["SEEN", "CONFIRMING"])
        .execute();
    }
  }

  private noteSuccess(): void {
    this.consecutiveFailures = 0;
  }

  private noteFailure(err: unknown): void {
    this.consecutiveFailures += 1;
    this.logger.warn(
      `TronGrid scan failure ${this.consecutiveFailures}/${MAX_CONSECUTIVE_FAILURES}: ${
        err instanceof Error ? err.message : "unknown error"
      }`,
    );
    if (this.consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
      this.pausedUntil = Date.now() + PAUSE_MS;
      this.consecutiveFailures = 0;
      this.logger.error(`scanner paused for ${PAUSE_MS / 60_000} min after repeated RPC failures`);
    }
  }
}
