import { describe, expect, it } from "vitest";
import { validateEnv } from "./env";

/** Minimal valid DEV env (NODE_ENV defaults to "development"). */
const base = (overrides: Record<string, unknown> = {}): Record<string, unknown> => ({
  DATABASE_URL: "postgres://u:p@localhost:5432/db",
  JWT_ACCESS_SECRET: "dev_only_change_me_jwt_access_secret_min_32_chars",
  MASTER_ENCRYPTION_KEY: "ZGV2X29ubHlfbWFzdGVyX2tleV9jaGFuZ2VfbWVfISE=", // decodes to "dev_only_…"
  USDT_TRC20_CONTRACT: "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t",
  ...overrides,
});

const PROD_KEY = Buffer.alloc(32, 7).toString("base64"); // 32 real bytes, not "dev_only_…"
/** A valid PRODUCTION env — every hard-stop satisfied. */
const prod = (overrides: Record<string, unknown> = {}): Record<string, unknown> =>
  base({
    NODE_ENV: "production",
    JWT_ACCESS_SECRET: "prod-jwt-secret-that-is-at-least-32-chars-long",
    MASTER_ENCRYPTION_KEY: PROD_KEY,
    SIGNER_MODE: "remote",
    SIGNER_URL: "https://10.0.0.2:8443",
    SIGNER_CA_CERT_PATH: "/etc/signer/ca.pem",
    SIGNER_CLIENT_CERT_PATH: "/etc/signer/client.pem",
    SIGNER_CLIENT_KEY_PATH: "/etc/signer/client.key",
    SWAGGER_ENABLED: "false",
    WALLET_XPUB: "xpub-mainnet-watch-only-key-derived-offline",
    WALLET_HOT_ADDRESS: "TKHotWa11etAddr3ssForReserveCheck0000",
    TRON_NETWORK: "mainnet",
    STORAGE_SSE_ENABLED: "true",
    ADMIN_2FA_REQUIRED: "true",
    ALERT_WEBHOOK_URL: "https://hooks.example.com/incident",
    MINIO_ACCESS_KEY: "prod-minio-access",
    MINIO_SECRET_KEY: "prod-minio-secret",
    ...overrides,
  });

describe("validateEnv", () => {
  it("accepts a valid development config", () => {
    expect(() => validateEnv(base())).not.toThrow();
  });

  it("accepts a fully-configured production config", () => {
    expect(() => validateEnv(prod())).not.toThrow();
  });

  it("rejects the dev MASTER_ENCRYPTION_KEY in production", () => {
    expect(() => validateEnv(prod({ MASTER_ENCRYPTION_KEY: base().MASTER_ENCRYPTION_KEY }))).toThrow(
      /MASTER_ENCRYPTION_KEY/,
    );
  });

  it("requires WALLET_XPUB in production", () => {
    expect(() => validateEnv(prod({ WALLET_XPUB: "" }))).toThrow(/WALLET_XPUB/);
    expect(() => validateEnv(prod({ WALLET_XPUB: "   " }))).toThrow(/WALLET_XPUB/);
  });

  it("forbids testnet (non-mainnet) in production", () => {
    expect(() => validateEnv(prod({ TRON_NETWORK: "shasta" }))).toThrow(/TRON_NETWORK/);
    expect(() => validateEnv(prod({ TRON_NETWORK: "nile" }))).toThrow(/TRON_NETWORK/);
  });

  it("requires STORAGE_SSE_ENABLED (at-rest KYC/PII encryption) in production", () => {
    expect(() => validateEnv(prod({ STORAGE_SSE_ENABLED: "false" }))).toThrow(/STORAGE_SSE_ENABLED/);
  });

  it("requires ADMIN_2FA_REQUIRED (admin step-up 2FA) in production", () => {
    expect(() => validateEnv(prod({ ADMIN_2FA_REQUIRED: "false" }))).toThrow(/ADMIN_2FA_REQUIRED/);
  });

  it("requires ALERT_WEBHOOK_URL (critical alerts must page, not just log) in production", () => {
    expect(() => validateEnv(prod({ ALERT_WEBHOOK_URL: "" }))).toThrow(/ALERT_WEBHOOK_URL/);
    expect(() => validateEnv(prod({ ALERT_WEBHOOK_URL: "   " }))).toThrow(/ALERT_WEBHOOK_URL/);
  });

  it("rejects the published dev database password in production", () => {
    expect(() => validateEnv(prod({ DATABASE_URL: "postgres://quatatrade_app:app_dev_only@host:5432/db" }))).toThrow(
      /database password/,
    );
    expect(() => validateEnv(prod({ DATABASE_APP_PASSWORD: "app_dev_only" }))).toThrow(/database password/);
  });

  it("requires a real (non-dev, non-empty) MINIO_SECRET_KEY in production", () => {
    expect(() => validateEnv(prod({ MINIO_SECRET_KEY: "" }))).toThrow(/MINIO_SECRET_KEY/);
    expect(() => validateEnv(prod({ MINIO_SECRET_KEY: "quatatrade_dev_only" }))).toThrow(/MINIO_SECRET_KEY/);
  });

  it("rejects an extended PRIVATE key in WALLET_XPUB (schema-level, any env)", () => {
    expect(() => validateEnv(base({ WALLET_XPUB: "xprv9s21ZrQH143K3privatekeymaterial" }))).toThrow(/watch-only/);
    expect(() => validateEnv(prod({ WALLET_XPUB: "tprv8ZgxMBicQKsPeprivate" }))).toThrow(/watch-only/);
  });

  it("pins USDT_TRC20_CONTRACT to the canonical mainnet contract in production", () => {
    expect(() => validateEnv(prod({ USDT_TRC20_CONTRACT: "TXYZa1b2c3d4e5f6g7h8i9j0k1l2m3n4o5" }))).toThrow(/USDT_TRC20_CONTRACT/);
  });

  it("enforces a safe DEPOSIT_CONFIRMATIONS floor in production", () => {
    expect(() => validateEnv(prod({ DEPOSIT_CONFIRMATIONS: "1" }))).toThrow(/DEPOSIT_CONFIRMATIONS/);
    expect(() => validateEnv(prod({ DEPOSIT_CONFIRMATIONS: "18" }))).toThrow(/DEPOSIT_CONFIRMATIONS/);
    expect(() => validateEnv(prod({ DEPOSIT_CONFIRMATIONS: "19" }))).not.toThrow();
  });

  it("requires WALLET_HOT_ADDRESS (reserve/solvency check) in production", () => {
    expect(() => validateEnv(prod({ WALLET_HOT_ADDRESS: "" }))).toThrow(/WALLET_HOT_ADDRESS/);
  });

  it("requires remote-signer mTLS config in production", () => {
    expect(() => validateEnv(prod({ SIGNER_URL: "" }))).toThrow(/SIGNER_MODE=remote/);
    expect(() => validateEnv(prod({ SIGNER_CLIENT_KEY_PATH: "" }))).toThrow(/SIGNER_MODE=remote/);
  });

  it("rejects a non-URL TRON_FALLBACK_RPC_URL (empty allowed)", () => {
    expect(() => validateEnv(base({ TRON_FALLBACK_RPC_URL: "not-a-url" }))).toThrow();
    expect(() => validateEnv(base({ TRON_FALLBACK_RPC_URL: "" }))).not.toThrow();
  });

  it("keeps the existing production hard-stops (mock signer, dev JWT, swagger)", () => {
    expect(() => validateEnv(prod({ SIGNER_MODE: "mock" }))).toThrow(/SIGNER_MODE/);
    expect(() => validateEnv(prod({ JWT_ACCESS_SECRET: "dev_only_x_x_x_x_x_x_x_x_x_x_x_x_x_x_x" }))).toThrow(/JWT/);
    expect(() => validateEnv(prod({ SWAGGER_ENABLED: "true" }))).toThrow(/Swagger/);
  });

  it("accepts LOG_LEVEL case-insensitively (INFO -> info)", () => {
    expect(validateEnv(base({ LOG_LEVEL: "INFO" })).LOG_LEVEL).toBe("info");
    expect(validateEnv(base({ LOG_LEVEL: "Debug" })).LOG_LEVEL).toBe("debug");
    expect(() => validateEnv(base({ LOG_LEVEL: "verbose" }))).toThrow(/LOG_LEVEL/);
  });

  /** A staging box: real secrets + 2FA + SSE, but still on testnet with a mock signer. */
  const staging = (overrides: Record<string, unknown> = {}): Record<string, unknown> =>
    base({
      NODE_ENV: "staging",
      JWT_ACCESS_SECRET: "staging-jwt-secret-that-is-at-least-32-chars",
      MASTER_ENCRYPTION_KEY: PROD_KEY,
      MINIO_SECRET_KEY: "staging-minio-secret",
      ADMIN_2FA_REQUIRED: "true",
      ...overrides,
    });

  describe("tier A — security hard-stops apply outside development", () => {
    it("accepts a properly-secured staging config (testnet + mock signer still allowed)", () => {
      expect(() => validateEnv(staging())).not.toThrow();
      expect(() => validateEnv(staging({ TRON_NETWORK: "shasta", SIGNER_MODE: "mock" }))).not.toThrow();
    });

    it("rejects dev secrets on staging (this is what the prod-only gate used to miss)", () => {
      expect(() => validateEnv(staging({ JWT_ACCESS_SECRET: base().JWT_ACCESS_SECRET }))).toThrow(/JWT/);
      expect(() => validateEnv(staging({ MASTER_ENCRYPTION_KEY: base().MASTER_ENCRYPTION_KEY }))).toThrow(
        /MASTER_ENCRYPTION_KEY/,
      );
      expect(() => validateEnv(staging({ MINIO_SECRET_KEY: "quatatrade_dev_only" }))).toThrow(/MINIO_SECRET_KEY/);
      expect(() =>
        validateEnv(staging({ DATABASE_URL: "postgres://quatatrade_app:app_dev_only@host:5432/db" })),
      ).toThrow(/database password/);
    });

    it("requires admin 2FA and no Swagger on staging", () => {
      expect(() => validateEnv(staging({ ADMIN_2FA_REQUIRED: "false" }))).toThrow(/ADMIN_2FA_REQUIRED/);
      expect(() => validateEnv(staging({ SWAGGER_ENABLED: "true" }))).toThrow(/Swagger/);
    });

    it("does NOT demand infrastructure-dependent SSE on staging (MinIO may have no KMS)", () => {
      expect(() => validateEnv(staging({ STORAGE_SSE_ENABLED: "false" }))).not.toThrow();
      // ...but production still demands it
      expect(() => validateEnv(prod({ STORAGE_SSE_ENABLED: "false" }))).toThrow(/STORAGE_SSE_ENABLED/);
    });

    it("does NOT force production-only facts on staging", () => {
      // mainnet / real signer / alert webhook / hot address are production-only —
      // forcing them would make a testnet staging box unbootable.
      expect(() => validateEnv(staging({ TRON_NETWORK: "nile", WALLET_XPUB: "", ALERT_WEBHOOK_URL: "" }))).not.toThrow();
    });
  });

  it("does not apply production hard-stops in development", () => {
    // dev key, empty xpub, shasta, mock signer — all fine outside production
    expect(() => validateEnv(base({ SIGNER_MODE: "mock", TRON_NETWORK: "shasta", WALLET_XPUB: "" }))).not.toThrow();
  });
});
