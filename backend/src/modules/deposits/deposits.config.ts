import type { ConfigService } from "@nestjs/config";
import type { Env } from "../../config/env";

/**
 * Deposit-pipeline configuration, resolved once from validated env.
 * A plain object (not ConfigService) so tests construct it directly.
 */
export interface DepositsConfig {
  /** TronGrid REST base URL, e.g. https://api.shasta.trongrid.io */
  trongridUrl: string;
  /** Secondary RPC base URL (self-hosted node OR a backup provider). Empty = no failover. */
  trongridFallbackUrl: string;
  trongridApiKey: string;
  /** Canonical USDT TRC20 contract — deposits from ANY other contract are rejected. */
  usdtContract: string;
  /** Below this (smallest units) a transfer is recorded as IGNORED_DUST, never credited. */
  minAmount: bigint;
  /** Block-depth threshold before crediting. */
  confirmations: number;
}

export const DEPOSITS_CONFIG = "DEPOSITS_CONFIG";

export function depositsConfigFromEnv(config: ConfigService<Env, true>): DepositsConfig {
  return {
    trongridUrl: config.get("TRONGRID_API_URL", { infer: true }),
    trongridFallbackUrl: config.get("TRON_FALLBACK_RPC_URL", { infer: true }),
    trongridApiKey: config.get("TRONGRID_API_KEY", { infer: true }),
    usdtContract: config.get("USDT_TRC20_CONTRACT", { infer: true }),
    minAmount: config.get("DEPOSIT_MIN_AMOUNT", { infer: true }),
    confirmations: config.get("DEPOSIT_CONFIRMATIONS", { infer: true }),
  };
}
