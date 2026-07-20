import { Inject, Injectable, Logger } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import type { Kysely } from "kysely";
import type { AssetCode, DepositStatus } from "@quatatrade/shared";
import { DB } from "../../db/database.module";
import type { Database } from "../../db/types";
import { newId } from "../../common/ids";
import { SettingsService } from "../settings/settings.service";
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
    private readonly settings: SettingsService,
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

  /**
   * One full pass over all active deposit addresses.
   *
   * A failure on ONE address must not abort the pass: previously the first RPC
   * error `return`ed, and because the address list had no ORDER BY, the addresses
   * after it could go unscanned indefinitely (a rate-limited address would
   * permanently starve everyone behind it). Now each address is isolated, the order
   * is stable, and the circuit breaker only trips when the whole pass fails.
   */
  async scanOnce(): Promise<void> {
    const addresses: WatchedAddress[] = await this.db
      .selectFrom("deposit_addresses")
      .select(["address", "user_id", "asset"])
      .where("active", "=", true)
      .orderBy("created_at", "asc") // stable: no address can be starved by ordering churn
      .execute();

    // Dust cutoff = the LOWER of the env floor and the admin policy minimum. Using
    // only the env value meant that lowering the policy minimum stranded deposits in
    // the gap as IGNORED_DUST — never re-examined, never creditable.
    const policyMin = await this.settings
      .depositPolicy()
      .then((p) => p.minAmount)
      .catch(() => this.cfg.minAmount);
    const dustFloor = policyMin < this.cfg.minAmount ? policyMin : this.cfg.minAmount;

    let failures = 0;
    for (const watched of addresses) {
      let transfers: Trc20Transfer[];
      try {
        transfers = await this.client.getTrc20TransfersTo(watched.address);
      } catch (err) {
        failures += 1;
        this.logger.warn(
          `scan failed for one address (continuing): ${err instanceof Error ? err.message : "unknown error"}`,
        );
        continue; // isolate: never let one address block the rest of the pass
      }
      for (const transfer of transfers) {
        await this.recordTransfer(watched, transfer, dustFloor);
      }
    }

    // Only a pass where EVERY address failed indicates the provider is down; a
    // partial failure must not reset the breaker (the old code called noteSuccess()
    // inside the loop, so an alternating ok/fail pattern never tripped it).
    if (addresses.length > 0 && failures === addresses.length) this.noteFailure(new Error("all addresses failed"));
    else this.noteSuccess();
  }

  /**
   * Record one on-chain transfer. Gate order matters:
   * 1. must actually be TO our address,
   * 2. token contract must EXACTLY equal canonical USDT (fake-token rejection),
   * 3. positive amount,
   * 4. dust (< min) recorded as IGNORED_DUST so it is visible but never credited,
   * 5. idempotent upsert via ON CONFLICT (tx_hash, log_index) DO NOTHING.
   */
  private async recordTransfer(watched: WatchedAddress, transfer: Trc20Transfer, dustFloor: bigint): Promise<void> {
    if (transfer.to !== watched.address) return;
    if (transfer.contract !== this.cfg.usdtContract) {
      this.logger.warn(`rejected non-canonical token contract (tx=${transfer.txHash} log=${transfer.logIndex})`);
      return;
    }
    if (transfer.amount <= 0n) return;

    const status: DepositStatus = transfer.amount < dustFloor ? "IGNORED_DUST" : "SEEN";
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
