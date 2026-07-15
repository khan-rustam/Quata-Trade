import { Inject, Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Cron, CronExpression } from "@nestjs/schedule";
import type { Kysely } from "kysely";
import { DB } from "../db/database.module";
import type { Database } from "../db/types";
import type { Env } from "../config/env";
import { LedgerService } from "../modules/ledger/ledger.service";
import { SettingsService } from "../modules/settings/settings.service";
import { TRONGRID_CLIENT, type TronGridClient } from "../modules/deposits/trongrid.client";
import { newId } from "../common/ids";

/** A withdrawal broadcast on-chain but not confirmed within this window is stuck. */
const STALE_BROADCAST_MS = 2 * 60 * 60 * 1000;
/** Slack (smallest units) allowed between on-chain custody and ledger obligations. */
const RESERVE_TOLERANCE = 1_000_000n; // 1 USDT

export interface ReserveStatus {
  breached: boolean;
  /** obligations − onChain when positive, else 0n. */
  shortfall: bigint;
}

/**
 * Pure reserve check (item 5b): custody is healthy when the on-chain balance
 * plus a small tolerance covers the ledger's on-chain obligations.
 */
export function reserveShortfall(onChain: bigint, obligations: bigint, tolerance: bigint): ReserveStatus {
  const deficit = obligations - onChain;
  return { breached: deficit > tolerance, shortfall: deficit > 0n ? deficit : 0n };
}

/**
 * Reconciliation (Documents/09): cached balances vs recomputed SUM(entries).
 * ANY mismatch = corruption signal → pause withdrawals via kill switch + alert.
 * Also flags withdrawals stuck in BROADCAST (item 5) — a dropped tx or an
 * under-funded hot wallet needs human reconciliation with Host B.
 */
@Injectable()
export class ReconciliationJob {
  private readonly logger = new Logger(ReconciliationJob.name);

  constructor(
    @Inject(DB) private readonly db: Kysely<Database>,
    private readonly ledger: LedgerService,
    @Inject(TRONGRID_CLIENT) private readonly tron: TronGridClient,
    private readonly config: ConfigService<Env, true>,
    private readonly settings: SettingsService,
  ) {}

  @Cron(CronExpression.EVERY_10_MINUTES)
  async run(): Promise<void> {
    // Isolate each check: one failing must not skip the others, and a persistently
    // failing reconciliation must itself page (a silent safety-net is worthless).
    await this.guard("ledger-cache", () => this.reconcileLedgerCache());
    await this.guard("stuck-broadcasts", () => this.alertStuckBroadcasts());
    await this.guard("on-chain-reserves", () => this.checkOnChainReserves());
  }

  /** Run one sub-check; on failure log + emit a critical alert instead of aborting the cycle. */
  private async guard(check: string, fn: () => Promise<void>): Promise<void> {
    try {
      await fn();
    } catch (err) {
      const message = err instanceof Error ? err.message : "unknown error";
      this.logger.error(`reconciliation check '${check}' FAILED: ${message}`);
      try {
        await this.db
          .insertInto("outbox")
          .values({
            id: newId(),
            event_type: "reconciliation.job_error",
            payload: JSON.stringify({ check, message: message.slice(0, 500) }),
          })
          .execute();
      } catch {
        // last-resort: even the alert insert failed — the error log above is all we have.
      }
    }
  }

  /** cached balances vs recomputed SUM(entries) — mismatch pauses withdrawals. */
  private async reconcileLedgerCache(): Promise<void> {
    const mismatches = await this.ledger.findCacheMismatches();
    if (mismatches.length === 0) {
      this.logger.log("reconciliation clean");
      return;
    }

    const detail = mismatches
      .map((m) => `${m.accountId}: cached=${m.cached} actual=${m.actual}`)
      .join("; ");
    this.logger.error(`LEDGER MISMATCH — pausing withdrawals: ${detail}`);

    // Atomic (FOR UPDATE) flip that preserves other switches and invalidates the
    // cache — never lost-updates a concurrent admin toggle (Documents/09 §G).
    await this.settings.pauseWithdrawals();
    // Emit a security event; the outbox relay routes it to AlertsService so a
    // human is paged (webhook + error log), not just a silent kill-switch flip.
    await this.db
      .insertInto("outbox")
      .values({
        id: newId(),
        event_type: "reconciliation.mismatch",
        payload: JSON.stringify({ mismatchCount: mismatches.length, detail: detail.slice(0, 1000) }),
      })
      .execute();
  }

  /**
   * Withdrawals broadcast on-chain but not confirmed within STALE_BROADCAST_MS.
   * Aggregated so a stuck tx pages on-call (via AlertsService) every cycle until
   * a human reconciles it with Host B — a dropped tx or under-funded hot wallet.
   */
  private async alertStuckBroadcasts(): Promise<void> {
    const cutoff = new Date(Date.now() - STALE_BROADCAST_MS);
    const stuck = await this.db
      .selectFrom("withdrawals")
      .select((eb) => eb.fn.countAll<bigint>().as("n"))
      .where("status", "=", "BROADCAST")
      .where("updated_at", "<", cutoff)
      .executeTakeFirstOrThrow();
    const count = Number(stuck.n);
    if (count === 0) return;
    this.logger.error(`${count} withdrawal(s) stuck in BROADCAST > ${STALE_BROADCAST_MS / 3_600_000}h — human reconciliation`);
    await this.db
      .insertInto("outbox")
      .values({
        id: newId(),
        event_type: "withdrawal.broadcast_stale",
        payload: JSON.stringify({ count, staleHours: STALE_BROADCAST_MS / 3_600_000 }),
      })
      .execute();
  }

  /**
   * On-chain↔ledger reserve check (item 5b). Opt-in: runs only when
   * WALLET_HOT_ADDRESS is configured. Compares the signer hot-wallet's on-chain
   * USDT balance against the ledger obligations it must be able to cover
   * (pending withdrawals in flight + accrued treasury fees).
   *
   * ALERT-ONLY — never auto-pauses: on-chain reads can be transient/rate-limited,
   * and the exact reserve formula depends on the Host B sweep design. A human
   * confirms the shortfall before acting. The obligations formula (pending_sweep
   * + treasury) is a conservative lower bound and is FLAGGED for human review.
   */
  private async checkOnChainReserves(): Promise<void> {
    const hot = this.config.get("WALLET_HOT_ADDRESS", { infer: true });
    if (hot.trim() === "") {
      this.logger.warn("on-chain reserve check skipped — WALLET_HOT_ADDRESS not configured");
      return;
    }
    let onChain: bigint;
    try {
      onChain = await this.tron.getTrc20Balance(hot);
    } catch (err) {
      // A read failure must NOT raise a false shortfall — skip this cycle.
      this.logger.warn(
        `reserve check skipped — hot-wallet balance read failed: ${err instanceof Error ? err.message : "unknown"}`,
      );
      return;
    }
    const pendingSweep = await this.ledger.balanceOf(
      await this.ledger.getOrCreateAccount(null, "platform_pending_sweep", "USDT_TRC20"),
    );
    const treasury = await this.ledger.balanceOf(
      await this.ledger.getOrCreateAccount(null, "platform_treasury", "USDT_TRC20"),
    );
    const obligations = pendingSweep + treasury;
    const { breached, shortfall } = reserveShortfall(onChain, obligations, RESERVE_TOLERANCE);
    if (!breached) {
      this.logger.log(`reserve ok: hot=${onChain} covers obligations=${obligations}`);
      return;
    }
    this.logger.error(`RESERVE SHORTFALL: hot=${onChain} obligations=${obligations} shortfall=${shortfall}`);
    await this.db
      .insertInto("outbox")
      .values({
        id: newId(),
        event_type: "reconciliation.reserve_shortfall",
        payload: JSON.stringify({
          onChain: onChain.toString(),
          obligations: obligations.toString(),
          shortfall: shortfall.toString(),
        }),
      })
      .execute();
  }
}
