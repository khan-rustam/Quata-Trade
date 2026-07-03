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

  /** One broadcast tx: settle only a SUCCESSFUL tx once it reaches finality. */
  async confirmOne(
    withdrawalId: string,
    txHash: string,
  ): Promise<"settled" | "pending" | "unresolved" | "reverted"> {
    const status = await this.tron.getTransactionStatus(txHash);
    if (status === null) return "unresolved"; // not mined / result unknown — retry next tick
    if (!status.success) {
      // Mined but REVERTED / OUT_OF_ENERGY: the transfer did not execute, funds
      // stayed in the hot wallet. NEVER settle (that would tell the ledger a
      // failed withdrawal succeeded). Leave it BROADCAST — the reconciliation
      // job's stuck-broadcast alert pages a human for reconciliation with Host B.
      this.logger.error(
        `withdrawal ${withdrawalId} tx ${txHash} FAILED on-chain (reverted) — NOT settled, needs reconciliation`,
      );
      return "reverted";
    }
    if (status.confirmations < this.cfg.confirmations) return "pending";
    const settled = await this.withdrawals.settleConfirmed(withdrawalId);
    if (settled) this.logger.log(`withdrawal ${withdrawalId} CONFIRMED on-chain (${status.confirmations} conf)`);
    return settled ? "settled" : "pending";
  }
}
