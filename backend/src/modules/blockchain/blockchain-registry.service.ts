import { Injectable } from "@nestjs/common";
import type { AssetCode } from "@quatatrade/shared";
import type { BlockchainHealth, BlockchainNetwork, BlockchainProvider } from "./blockchain.provider";
import { TronProvider } from "./tron.provider";

/** Which network settles each asset. Extend as chains are added — no engine change. */
const ASSET_NETWORK: Readonly<Record<string, BlockchainNetwork>> = {
  USDT_TRC20: "TRON",
};

/**
 * Registry of Blockchain Providers keyed by network. Business logic resolves a
 * provider here (by network or asset) instead of importing a chain directly, so
 * adding a chain = implement BlockchainProvider + register it here.
 */
@Injectable()
export class BlockchainRegistry {
  private readonly providers: Map<BlockchainNetwork, BlockchainProvider>;

  constructor(tron: TronProvider) {
    this.providers = new Map<BlockchainNetwork, BlockchainProvider>([["TRON", tron]]);
  }

  networks(): BlockchainNetwork[] {
    return [...this.providers.keys()];
  }

  get(network: BlockchainNetwork): BlockchainProvider {
    const provider = this.providers.get(network);
    if (!provider) throw new Error(`no blockchain provider registered for ${network}`);
    return provider;
  }

  forAsset(asset: AssetCode): BlockchainProvider {
    const network = ASSET_NETWORK[asset];
    if (!network) throw new Error(`no network mapping for asset ${asset}`);
    return this.get(network);
  }

  /** Health of every registered provider (for the admin blockchain-sync view). */
  healthAll(): Promise<BlockchainHealth[]> {
    return Promise.all([...this.providers.values()].map((p) => p.health()));
  }
}
