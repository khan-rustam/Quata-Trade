import { Injectable } from "@nestjs/common";
import { HttpTronGridClient, type Trc20Transfer, type TxStatus } from "../deposits/trongrid.client";
import type { BlockchainHealth, BlockchainProvider } from "./blockchain.provider";

/**
 * TRON implementation of the BlockchainProvider seam. Wraps the failover-capable
 * HttpTronGridClient (primary→secondary node). A self-hosted TRON node drops in
 * by pointing the RPC base URL at it — no change here or in business logic.
 */
@Injectable()
export class TronProvider implements BlockchainProvider {
  readonly network = "TRON" as const;

  constructor(private readonly client: HttpTronGridClient) {}

  getCurrentBlockHeight(): Promise<bigint> {
    return this.client.getCurrentBlockNumber();
  }
  getIncomingTransfers(address: string): Promise<Trc20Transfer[]> {
    return this.client.getTrc20TransfersTo(address);
  }
  getTransactionStatus(txHash: string): Promise<TxStatus | null> {
    return this.client.getTransactionStatus(txHash);
  }
  getTokenBalance(address: string): Promise<bigint> {
    return this.client.getTrc20Balance(address);
  }

  async health(): Promise<BlockchainHealth> {
    const checkedAt = new Date().toISOString();
    try {
      const start = Date.now();
      const height = await this.client.getCurrentBlockNumber();
      return {
        network: this.network,
        reachable: true,
        blockHeight: height > BigInt(Number.MAX_SAFE_INTEGER) ? Number.MAX_SAFE_INTEGER : Number(height),
        latencyMs: Date.now() - start,
        usingFallback: this.client.lastUsedFallback,
        checkedAt,
      };
    } catch {
      return {
        network: this.network,
        reachable: false,
        blockHeight: null,
        latencyMs: null,
        usingFallback: this.client.lastUsedFallback,
        checkedAt,
      };
    }
  }
}
