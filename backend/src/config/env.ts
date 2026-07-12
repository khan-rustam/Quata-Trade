import { z } from "zod";

/**
 * Zod-validated environment (Documents/02-tech-stack.md).
 * The app REFUSES to boot on missing/invalid env — fail fast, never limp.
 */
export const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "staging", "production"]).default("development"),
  PORT: z.coerce.number().int().min(1).max(65535).default(4000),
  WEB_ORIGIN: z.string().url().default("http://localhost:3000"),

  DATABASE_URL: z.string().min(1),
  DATABASE_MIGRATION_URL: z.string().min(1).optional(),
  DATABASE_APP_PASSWORD: z.string().min(1).optional(),

  REDIS_URL: z.string().min(1).default("redis://localhost:6379"),

  JWT_ACCESS_SECRET: z.string().min(32, "JWT secret must be ≥32 chars"),
  JWT_ACCESS_TTL_SECONDS: z.coerce.number().int().min(60).max(900).default(600),
  REFRESH_TTL_DAYS: z.coerce.number().int().min(1).max(90).default(30),
  MASTER_ENCRYPTION_KEY: z
    .string()
    .refine((v) => Buffer.from(v, "base64").length === 32, "MASTER_ENCRYPTION_KEY must be 32 bytes base64"),
  /**
   * Enforce admin TOTP 2FA end-to-end: the step-up before every sensitive admin
   * action (withdrawal approve/reject, dispute resolve = escrow release/refund,
   * kill switch, setting update, ledger adjustment). Off in the test phase; MUST
   * be true in production (enforced by the prod hard-stop below).
   */
  ADMIN_2FA_REQUIRED: z
    .string()
    .default("false")
    .transform((v) => v === "true"),

  MINIO_ENDPOINT: z.string().default("localhost"),
  MINIO_PORT: z.coerce.number().int().default(9000),
  MINIO_USE_SSL: z
    .string()
    .default("false")
    .transform((v) => v === "true"),
  MINIO_ACCESS_KEY: z.string().default(""),
  MINIO_SECRET_KEY: z.string().default(""),
  /** SSE-S3 at-rest encryption for uploaded objects (KYC/PII). Required in prod. */
  STORAGE_SSE_ENABLED: z
    .string()
    .default("false")
    .transform((v) => v === "true"),

  SMTP_HOST: z.string().default("localhost"),
  SMTP_PORT: z.coerce.number().int().default(1025),
  SMTP_SECURE: z
    .string()
    .default("false")
    .transform((v) => v === "true"),
  SMTP_USER: z.string().default(""),
  SMTP_PASS: z.string().default(""),
  SMTP_FROM: z.string().default("QuataTrade <no-reply@quatatrade.local>"),

  TRON_NETWORK: z.enum(["shasta", "nile", "mainnet"]).default("shasta"),
  TRONGRID_API_URL: z.string().url().default("https://api.shasta.trongrid.io"),
  TRONGRID_API_KEY: z.string().default(""),
  TRON_FALLBACK_RPC_URL: z.string().default(""),
  USDT_TRC20_CONTRACT: z
    .string()
    .regex(/^T[1-9A-HJ-NP-Za-km-z]{33}$/, "USDT contract must be a TRON address"),
  DEPOSIT_CONFIRMATIONS: z.coerce.number().int().min(1).default(19),
  DEPOSIT_MIN_AMOUNT: z.coerce.bigint().positive().default(1_000_000n),
  WALLET_XPUB: z.string().default(""),
  /** Signer hot-wallet (base58) — enables the on-chain reserve check (item 5b). Optional. */
  WALLET_HOT_ADDRESS: z.string().default(""),
  /**
   * Cold Wallet Provider (Documents/10 D30-cold). 'disabled' at launch; flip to
   * 'trezor_safe_3' (a human completes the stub) after the hardware key ceremony.
   * Enabling later is config-only — no other code changes.
   */
  COLD_WALLET_PROVIDER: z
    .enum(["disabled", "trezor_safe_3", "future_hardware", "institutional_custody"])
    .default("disabled"),

  SIGNER_MODE: z.enum(["mock", "remote"]).default("mock"),
  SIGNER_URL: z.string().default(""),
  SIGNER_CA_CERT_PATH: z.string().default(""),
  SIGNER_CLIENT_CERT_PATH: z.string().default(""),
  SIGNER_CLIENT_KEY_PATH: z.string().default(""),

  CLAMAV_ENABLED: z
    .string()
    .default("false")
    .transform((v) => v === "true"),
  CLAMAV_HOST: z.string().default("localhost"),
  CLAMAV_PORT: z.coerce.number().int().default(3310),

  // Ops/security alert webhook (Slack/Discord/generic "text" payload). Empty = disabled (log-only).
  ALERT_WEBHOOK_URL: z.string().default(""),
  // Comma-separated email recipients for CRITICAL alerts (ops/on-call). Empty = email disabled.
  ALERT_EMAIL_TO: z.string().default(""),

  // Market data (informational Markets page). CoinGecko primary; CoinCap failover.
  // Free tiers work with no key; a key raises rate limits. Responses are Redis-cached.
  COINGECKO_API_URL: z.string().url().default("https://api.coingecko.com/api/v3"),
  COINGECKO_API_KEY: z.string().default(""),
  MARKETS_CACHE_TTL_SECONDS: z.coerce.number().int().min(10).max(600).default(45),
  // Crypto news (CryptoPanic). Empty = news section hidden (feature off).
  CRYPTOPANIC_API_KEY: z.string().default(""),

  SWAGGER_ENABLED: z
    .string()
    .default("false")
    .transform((v) => v === "true"),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace"]).default("info"),
});

export type Env = z.infer<typeof envSchema>;

export function validateEnv(config: Record<string, unknown>): Env {
  const parsed = envSchema.safeParse(config);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `  - ${i.path.join(".")}: ${i.message}`)
      .join("\n");
    throw new Error(`Environment validation failed:\n${issues}`);
  }
  if (parsed.data.NODE_ENV === "production") {
    // Production hard-stops: dev defaults, mock signer, and testnet are forbidden.
    if (parsed.data.SIGNER_MODE === "mock") {
      throw new Error("SIGNER_MODE=mock is forbidden in production");
    }
    if (parsed.data.JWT_ACCESS_SECRET.startsWith("dev_only")) {
      throw new Error("Dev JWT secret detected in production");
    }
    // The dev MASTER_ENCRYPTION_KEY (.env.example) base64-decodes to "dev_only_…";
    // a real random 32-byte key never does. Prevents shipping the published key.
    if (Buffer.from(parsed.data.MASTER_ENCRYPTION_KEY, "base64").toString("utf8").startsWith("dev_only")) {
      throw new Error("Dev MASTER_ENCRYPTION_KEY detected in production");
    }
    if (parsed.data.SWAGGER_ENABLED) {
      throw new Error("Swagger must be disabled in production");
    }
    if (parsed.data.WALLET_XPUB.trim() === "") {
      throw new Error("WALLET_XPUB is required in production (watch-only deposit derivation)");
    }
    if (parsed.data.TRON_NETWORK !== "mainnet") {
      throw new Error(`TRON_NETWORK must be 'mainnet' in production (got '${parsed.data.TRON_NETWORK}')`);
    }
    if (!parsed.data.STORAGE_SSE_ENABLED) {
      throw new Error("STORAGE_SSE_ENABLED must be true in production (at-rest encryption of KYC/PII objects)");
    }
    if (!parsed.data.ADMIN_2FA_REQUIRED) {
      throw new Error("ADMIN_2FA_REQUIRED must be true in production (admin step-up 2FA on escrow-release/withdrawal actions)");
    }
    // Critical ops/security alerts (reconciliation mismatch, reserve shortfall, AML
    // hit, kill-switch) are log-only when this is empty — nobody gets paged.
    if (parsed.data.ALERT_WEBHOOK_URL.trim() === "") {
      throw new Error("ALERT_WEBHOOK_URL is required in production (critical ops/security alerts must page on-call, not just log)");
    }
    // Reject the published dev credentials from .env.example so a mis-copied prod
    // deploy cannot boot with attacker-known secrets to the funds ledger / KYC store.
    if (/dev_only/i.test(parsed.data.DATABASE_URL) || (parsed.data.DATABASE_APP_PASSWORD ?? "").includes("dev_only")) {
      throw new Error("Dev database password detected in production (DATABASE_URL / DATABASE_APP_PASSWORD)");
    }
    if (parsed.data.MINIO_SECRET_KEY.trim() === "" || /dev_only/i.test(parsed.data.MINIO_SECRET_KEY)) {
      throw new Error("MINIO_SECRET_KEY must be a real (non-dev) secret in production (object store holds KYC/PII)");
    }
  }
  return parsed.data;
}
