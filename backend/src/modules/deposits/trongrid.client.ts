import { Inject, Injectable, Logger } from "@nestjs/common";
import { z } from "zod";
import { utils as tronUtils } from "tronweb";
import { DEPOSITS_CONFIG, type DepositsConfig } from "./deposits.config";

/**
 * Thin TronGrid REST access layer. Injected behind the TRONGRID_CLIENT token
 * so the scanner/confirmation services are tested against a fake — no network
 * calls in tests, no chain trust in business logic.
 *
 * SSRF note (08 §F): only the allow-listed TRONGRID_API_URL from env is ever
 * fetched; no user-supplied URL reaches this client.
 */

export interface Trc20Transfer {
  txHash: string;
  logIndex: number;
  from: string;
  to: string;
  /** Token contract in base58 — scanner compares EXACTLY against canonical USDT. */
  contract: string;
  amount: bigint;
  /** null when the tx is not (yet) in a known block — never credited while null. */
  blockNumber: bigint | null;
}

export interface TronGridClient {
  /** Incoming TRC20 transfers for one of our deposit addresses. */
  getTrc20TransfersTo(address: string): Promise<Trc20Transfer[]>;
  getCurrentBlockNumber(): Promise<bigint>;
  /**
   * Confirmation depth of a broadcast tx (currentBlock − txBlock; 0 if not yet
   * deep, null when the tx is not in a known block). Read-only chain query used
   * by the remote withdrawal confirmation poller — NEVER by the signer (Host B).
   */
  getTransactionConfirmations(txHash: string): Promise<number | null>;
  /**
   * TRC20 (USDT) balance of an address in smallest units — read-only, via
   * triggerconstantcontract balanceOf. Used by the on-chain reserve check
   * (item 5b). Throws on a read failure so the caller skips rather than
   * treating an unreadable balance as zero.
   */
  getTrc20Balance(address: string): Promise<bigint>;
}

export const TRONGRID_CLIENT = "TRONGRID_CLIENT";

/** keccak256("Transfer(address,address,uint256)") — the TRC20 transfer event topic. */
const TRANSFER_TOPIC = "ddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";

const zTrc20Item = z
  .object({
    transaction_id: z.string(),
    from: z.string(),
    to: z.string(),
    type: z.string(),
    value: z.string().regex(/^\d+$/),
    token_info: z.object({ address: z.string() }).passthrough(),
  })
  .passthrough();
const zTrc20Response = z.object({ data: z.array(zTrc20Item) }).passthrough();

const zTxInfo = z
  .object({
    blockNumber: z.number().int().optional(),
    log: z
      .array(z.object({ address: z.string().optional(), topics: z.array(z.string()).optional() }).passthrough())
      .optional(),
  })
  .passthrough();

const zNowBlock = z
  .object({ block_header: z.object({ raw_data: z.object({ number: z.number().int() }).passthrough() }).passthrough() })
  .passthrough();

// triggerconstantcontract (balanceOf): constant_result[0] is the 32-byte hex balance.
// nonempty so a malformed/failed read THROWS (reserve check skips) rather than
// silently reading a balance of zero (which would be a false shortfall alert).
const zTriggerConstant = z.object({ constant_result: z.array(z.string()).nonempty() }).passthrough();

function toHex(bytes: number[]): string {
  return bytes.map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** base58 TRON address → 40-char lowercase EVM-style hex (0x41 prefix dropped). */
function addressToEvmHex(address: string): string | null {
  const decoded = tronUtils.crypto.decode58Check(address);
  if (decoded === false || decoded.length !== 21) return null;
  return toHex(decoded.slice(1)).toLowerCase();
}

@Injectable()
export class HttpTronGridClient implements TronGridClient {
  private readonly logger = new Logger(HttpTronGridClient.name);

  constructor(@Inject(DEPOSITS_CONFIG) private readonly cfg: DepositsConfig) {}

  async getTrc20TransfersTo(address: string): Promise<Trc20Transfer[]> {
    const url =
      `${this.cfg.trongridUrl}/v1/accounts/${address}/transactions/trc20` +
      `?contract_address=${this.cfg.usdtContract}&only_to=true&limit=100`;
    const parsed = zTrc20Response.parse(await this.getJson(url));

    const transfers: Trc20Transfer[] = [];
    const metaCache = new Map<string, { blockNumber: bigint | null; logIndexes: number[] }>();
    // occurrences seen so far per tx — assign the Nth transfer the Nth matching log
    const seenPerTx = new Map<string, number>();
    for (const item of parsed.data) {
      if (item.type !== "Transfer" || item.to !== address) continue;
      let meta = metaCache.get(item.transaction_id);
      if (!meta) {
        meta = await this.resolveTxMeta(item.transaction_id, address);
        metaCache.set(item.transaction_id, meta);
      }
      // Two USDT transfers to the SAME address in ONE tx must get DISTINCT
      // log indexes, else the second collides on UNIQUE(tx_hash,log_index) and
      // the deposit is silently dropped. Consume the matching logs in order.
      const seen = seenPerTx.get(item.transaction_id) ?? 0;
      const logIndex = meta.logIndexes[seen] ?? 1_000_000 + seen; // distinct fallback
      seenPerTx.set(item.transaction_id, seen + 1);
      transfers.push({
        txHash: item.transaction_id,
        logIndex,
        from: item.from,
        to: item.to,
        contract: item.token_info.address,
        amount: BigInt(item.value),
        blockNumber: meta.blockNumber,
      });
    }
    return transfers;
  }

  async getCurrentBlockNumber(): Promise<bigint> {
    const parsed = zNowBlock.parse(await this.postJson("/wallet/getnowblock", {}));
    return BigInt(parsed.block_header.raw_data.number);
  }

  async getTransactionConfirmations(txHash: string): Promise<number | null> {
    let blockNumber: bigint | null;
    try {
      const info = zTxInfo.parse(await this.postJson("/wallet/gettransactioninfobyid", { value: txHash }));
      blockNumber = info.blockNumber !== undefined ? BigInt(info.blockNumber) : null;
    } catch (err) {
      // Soft failure: treat as "cannot prove depth yet" — the poller retries.
      this.logger.warn(`tx confirmations lookup failed for ${txHash}: ${err instanceof Error ? err.message : "unknown"}`);
      return null;
    }
    if (blockNumber === null) return null;
    const height = await this.getCurrentBlockNumber();
    if (height < blockNumber) return 0; // node behind / reorg in progress
    const depth = height - blockNumber;
    return depth > 2_000_000_000n ? 2_000_000_000 : Number(depth);
  }

  async getTrc20Balance(address: string): Promise<bigint> {
    const ownerHex = addressToEvmHex(address);
    if (ownerHex === null) throw new Error(`invalid TRON address: ${address}`);
    const parsed = zTriggerConstant.parse(
      await this.postJson("/wallet/triggerconstantcontract", {
        owner_address: address,
        contract_address: this.cfg.usdtContract,
        function_selector: "balanceOf(address)",
        parameter: ownerHex.padStart(64, "0"),
        visible: true,
      }),
    );
    const hex = parsed.constant_result[0];
    return hex.length === 0 ? 0n : BigInt(`0x${hex}`);
  }

  /**
   * Resolve block number + log index via gettransactioninfobyid. Failure is
   * soft: blockNumber null means "cannot prove depth yet" and the deposit
   * simply is not credited until a later scan resolves it.
   */
  private async resolveTxMeta(
    txHash: string,
    toAddress: string,
  ): Promise<{ blockNumber: bigint | null; logIndexes: number[] }> {
    try {
      const info = zTxInfo.parse(await this.postJson("/wallet/gettransactioninfobyid", { value: txHash }));
      const blockNumber = info.blockNumber !== undefined ? BigInt(info.blockNumber) : null;
      // ALL Transfer logs to our address, in on-chain order — one per real
      // transfer, so multiple same-address transfers get distinct indexes.
      const logIndexes: number[] = [];
      const recipientHex = addressToEvmHex(toAddress);
      const logs = info.log ?? [];
      if (recipientHex !== null) {
        for (let i = 0; i < logs.length; i += 1) {
          const topics = logs[i]?.topics ?? [];
          const topic0 = topics[0]?.toLowerCase() ?? "";
          const topic2 = topics[2]?.toLowerCase() ?? "";
          if (topic0.endsWith(TRANSFER_TOPIC) && topic2.endsWith(recipientHex)) {
            logIndexes.push(i);
          }
        }
      }
      return { blockNumber, logIndexes: logIndexes.length > 0 ? logIndexes : [0] };
    } catch (err) {
      this.logger.warn(`tx meta resolution failed for ${txHash}: ${err instanceof Error ? err.message : "unknown"}`);
      return { blockNumber: null, logIndexes: [0] };
    }
  }

  private headers(): Record<string, string> {
    const headers: Record<string, string> = { "content-type": "application/json" };
    if (this.cfg.trongridApiKey.length > 0) headers["TRON-PRO-API-KEY"] = this.cfg.trongridApiKey;
    return headers;
  }

  private async getJson(url: string): Promise<unknown> {
    const res = await fetch(url, { headers: this.headers(), signal: AbortSignal.timeout(15_000) });
    if (!res.ok) throw new Error(`TronGrid HTTP ${res.status}`);
    return res.json();
  }

  private async postJson(path: string, body: Record<string, unknown>): Promise<unknown> {
    const res = await fetch(`${this.cfg.trongridUrl}${path}`, {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) throw new Error(`TronGrid HTTP ${res.status}`);
    return res.json();
  }
}
