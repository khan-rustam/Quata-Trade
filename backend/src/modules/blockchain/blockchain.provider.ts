import type { Trc20Transfer, TxStatus } from "../deposits/trongrid.client";

/**
 * Chain-agnostic Blockchain Provider abstraction (Documents/10 D30-node).
 *
 * The platform's higher-level seam over a specific chain client. Business logic
 * asks the registry for a provider by network — it never imports TRON directly —
 * so adding Bitcoin/Ethereum/… later means implementing this interface and
 * registering it, with no change to the wallet/trade/ledger engines.
 *
 * A self-hosted node is a config change (the provider's RPC base URL), not a
 * code change. `health()` powers the admin blockchain-sync / node-health view.
 */

export type BlockchainNetwork = "TRON";

export interface BlockchainHealth {
  network: BlockchainNetwork;
  reachable: boolean;
  /** Latest block height the provider can see, or null when unreachable. */
  blockHeight: number | null;
  /** Round-trip latency of the health probe in ms, or null when unreachable. */
  latencyMs: number | null;
  /** True when the last successful call used the secondary/failover node. */
  usingFallback: boolean;
  checkedAt: string;
}

export interface BlockchainProvider {
  readonly network: BlockchainNetwork;
  /** Latest block height. */
  getCurrentBlockHeight(): Promise<bigint>;
  /** Incoming token transfers to one of our deposit addresses. */
  getIncomingTransfers(address: string): Promise<Trc20Transfer[]>;
  /** On-chain status of a broadcast tx (null = not yet provable). */
  getTransactionStatus(txHash: string): Promise<TxStatus | null>;
  /** Token balance of an address in smallest units. */
  getTokenBalance(address: string): Promise<bigint>;
  /** Node/provider health for monitoring. Never throws. */
  health(): Promise<BlockchainHealth>;
}

export const BLOCKCHAIN_REGISTRY = "BLOCKCHAIN_REGISTRY";
