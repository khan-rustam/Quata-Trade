import { Inject, Injectable, Logger } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import { WithdrawalsService } from "../withdrawals/withdrawals.service";
import { TRONGRID_CLIENT, type TronGridClient } from "../deposits/trongrid.client";
import { DEPOSITS_CONFIG, type DepositsConfig } from "../deposits/deposits.config";
import { SIGNER_CLIENT, type SignerClient } from "./signer.types";

const BATCH_SIZE = 25;

/**
 * Remote withdrawal confirmation poller (security remediation item 5).
 *
 * Closes the gap the pipeline notes: in remote (Host B signer) mode nothing
 * moved a BROADCAST withdrawal to CONFIRMED. This worker-side poller READS the
 * chain (it never signs — the signer stays on Host B) and, once a broadcast tx
 * reaches the same finality depth used for deposits, calls the idempotent
 * settle (BROADCAST → CONFIRMED + settle journal). Mock mode confirms inline in
 * WithdrawalPipelineService, so this is a deliberate no-op there.
 *
 * settle is guarded (WHERE status = BROADCAST) and idempotent, so overlapping
 * ticks / double workers cannot double-settle. Stuck-broadcast alerting is the
 * reconciliation job's responsibility (aggregated, low-frequency).
 */
@Injectable()
export class WithdrawalConfirmationService {
  private readonly logger = new Logger(WithdrawalConfirmationService.name);
  private running = false;

  constructor(
    private readonly withdrawals: WithdrawalsService,
    @Inject(TRONGRID_CLIENT) private readonly tron: TronGridClient,
    @Inject(DEPOSITS_CONFIG) private readonly cfg: DepositsConfig,
    @Inject(SIGNER_CLIENT) private readonly signer: SignerClient,
  ) {}

  @Cron(CronExpression.EVERY_30_SECONDS)
  async run(): Promise<void> {
    if (this.running || this.signer.mode === "mock") return;
    this.running = true;
    try {
      const pending = await this.withdrawals.listBroadcast(BATCH_SIZE);
      for (const item of pending) {
        try {
          await this.confirmOne(item.id, item.txHash);
        } catch (err) {
          // Isolated failure must not block the batch; retried next tick.
          this.logger.error(
            `withdrawal ${item.id} confirmation error: ${err instanceof Error ? err.message : "unknown"}`,
          );
        }
      }
    } finally {
      this.running = false;
    }
  }

  /** One broadcast tx: settle once it reaches the finality threshold. */
  async confirmOne(withdrawalId: string, txHash: string): Promise<"settled" | "pending" | "unresolved"> {
    const confirmations = await this.tron.getTransactionConfirmations(txHash);
    if (confirmations === null) return "unresolved"; // not in a block yet — retry next tick
    if (confirmations < this.cfg.confirmations) return "pending";
    const settled = await this.withdrawals.settleConfirmed(withdrawalId);
    if (settled) this.logger.log(`withdrawal ${withdrawalId} CONFIRMED on-chain (${confirmations} conf)`);
    return settled ? "settled" : "pending";
  }
}
