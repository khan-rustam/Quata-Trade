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

  MINIO_ENDPOINT: z.string().default("localhost"),
  MINIO_PORT: z.coerce.number().int().default(9000),
  MINIO_USE_SSL: z
    .string()
    .default("false")
    .transform((v) => v === "true"),
  MINIO_ACCESS_KEY: z.string().default(""),
  MINIO_SECRET_KEY: z.string().default(""),

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
  }
  return parsed.data;
}
