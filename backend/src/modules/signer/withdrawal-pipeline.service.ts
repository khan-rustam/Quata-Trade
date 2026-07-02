import { Inject, Injectable, Logger } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import { SettingsService } from "../settings/settings.service";
import { WithdrawalsService } from "../withdrawals/withdrawals.service";
import { SIGNER_CLIENT, type SignerClient } from "./signer.types";

const BATCH_SIZE = 25;

/**
 * Worker-side withdrawal pipeline (Documents/06 flow):
 *   APPROVED →(claim)→ SIGNING →(signer signs+broadcasts)→ BROADCAST(+tx_hash)
 *   →(mock: immediately / remote: chain confirmation)→ CONFIRMED + settle journal.
 * Any signing failure → FAILED + refund exactly once.
 *
 * Every step is a guarded UPDATE (WHERE status = expected) inside
 * WithdrawalsService, so overlapping runs / double workers cannot
 * double-process. The withdrawals kill switch halts the whole pipeline.
 * Rows stuck in SIGNING after a crash are NEVER auto-refunded (the signer may
 * have broadcast) — they alert for human reconciliation.
 */
@Injectable()
export class WithdrawalPipelineService {
  private readonly logger = new Logger(WithdrawalPipelineService.name);
  private running = false;

  constructor(
    private readonly withdrawals: WithdrawalsService,
    private readonly settings: SettingsService,
    @Inject(SIGNER_CLIENT) private readonly signer: SignerClient,
  ) {}

  @Cron(CronExpression.EVERY_30_SECONDS)
  async run(): Promise<void> {
    if (this.running) return;
    this.running = true;
    try {
      const { withdrawalsPaused } = await this.settings.killSwitches();
      if (withdrawalsPaused) {
        this.logger.warn("withdrawals kill switch is ON — pipeline idle");
        return;
      }
      const ids = await this.withdrawals.listApprovedIds(BATCH_SIZE);
      for (const id of ids) {
        try {
          await this.processOne(id);
        } catch (err) {
          this.logger.error(`withdrawal ${id} pipeline error: ${String(err)}`);
        }
      }
    } finally {
      this.running = false;
    }
  }

  /** Drive one withdrawal through claim → sign → broadcast → (mock) settle. */
  async processOne(withdrawalId: string): Promise<boolean> {
    // 1. Crash-safe claim: APPROVED → SIGNING. Loser of a race skips.
    const claimed = await this.withdrawals.claimForSigning(withdrawalId);
    if (!claimed) return false;

    let txHash: string;
    try {
      // 2. The signer independently re-verifies policy before signing.
      ({ txHash } = await this.signer.signWithdrawal(withdrawalId));
    } catch (err) {
      // Pre-broadcast failure → FAILED + refund exactly once (guarded on SIGNING).
      const reason = err instanceof Error ? err.message : "signing failed";
      const failed = await this.withdrawals.markFailed(withdrawalId, reason);
      if (failed) this.logger.warn(`withdrawal ${withdrawalId} FAILED and refunded: ${reason}`);
      return false;
    }

    // 3. SIGNING → BROADCAST (+tx_hash).
    const broadcast = await this.withdrawals.markBroadcast(withdrawalId, txHash);
    if (!broadcast) {
      this.logger.error(`withdrawal ${withdrawalId} signed but not in SIGNING — manual review required`);
      return false;
    }
    this.logger.log(`withdrawal ${withdrawalId} broadcast`);

    // 4. Mock mode has no chain: confirm + settle immediately. Remote mode
    //    waits for the confirmation poller (human-integrated with Host B).
    if (this.signer.mode === "mock") {
      const settled = await this.withdrawals.settleConfirmed(withdrawalId);
      if (settled) this.logger.log(`withdrawal ${withdrawalId} CONFIRMED (mock)`);
      return settled;
    }
    return true;
  }
}
