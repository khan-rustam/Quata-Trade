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
    SWAGGER_ENABLED: "false",
    WALLET_XPUB: "xpub-mainnet-watch-only-key-derived-offline",
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

  it("keeps the existing production hard-stops (mock signer, dev JWT, swagger)", () => {
    expect(() => validateEnv(prod({ SIGNER_MODE: "mock" }))).toThrow(/SIGNER_MODE/);
    expect(() => validateEnv(prod({ JWT_ACCESS_SECRET: "dev_only_x_x_x_x_x_x_x_x_x_x_x_x_x_x_x" }))).toThrow(/JWT/);
    expect(() => validateEnv(prod({ SWAGGER_ENABLED: "true" }))).toThrow(/Swagger/);
  });

  it("does not apply production hard-stops in development", () => {
    // dev key, empty xpub, shasta, mock signer — all fine outside production
    expect(() => validateEnv(base({ SIGNER_MODE: "mock", TRON_NETWORK: "shasta", WALLET_XPUB: "" }))).not.toThrow();
  });
});
