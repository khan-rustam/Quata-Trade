import { sql, type Kysely } from "kysely";

/**
 * Extensions, enums, users/auth/admin tables.
 * Source of truth: Documents/04-database-schema.md §4.1, §4.3, §4.7 (admins).
 *
 * Documented clarifications vs the doc's DDL (see Deviations Log):
 *  - account_kind gains 'external' — the chain-facing contra account. A strict
 *    zero-sum ledger where EVERY account is non-negative is mathematically
 *    impossible; 'external' absorbs on-chain inflow/outflow and may go negative.
 *  - users gains lockout columns (failed_login_attempts / locked_until /
 *    pin_attempts / pin_locked_until) required by doc 06 auth rules.
 *  - auth_tokens table added for email/phone OTP + password reset (doc 06
 *    endpoints require it; doc 04 omitted it).
 */
export async function up(db: Kysely<unknown>): Promise<void> {
  await sql`CREATE EXTENSION IF NOT EXISTS citext`.execute(db);
  await sql`CREATE EXTENSION IF NOT EXISTS pgcrypto`.execute(db);

  await sql`CREATE TYPE asset_code AS ENUM ('USDT_TRC20')`.execute(db);
  await sql`CREATE TYPE account_kind AS ENUM
    ('user_available','user_escrow','platform_treasury','platform_hot','platform_pending_sweep','external')`.execute(db);
  await sql`CREATE TYPE entry_reason AS ENUM
    ('deposit_credit','withdrawal_debit','withdrawal_fee','escrow_lock','escrow_release_buyer',
     'escrow_release_fee','escrow_refund','internal_transfer','adjustment')`.execute(db);
  await sql`CREATE TYPE trade_status AS ENUM
    ('OPENED','ESCROW_LOCKED','PAYMENT_SUBMITTED','COMPLETED','CANCELLED','EXPIRED','DISPUTED',
     'RESOLVED_RELEASE','RESOLVED_REFUND')`.execute(db);
  await sql`CREATE TYPE offer_status AS ENUM ('ACTIVE','PAUSED','EXHAUSTED','DELETED')`.execute(db);
  await sql`CREATE TYPE offer_side AS ENUM ('SELL','BUY')`.execute(db);
  await sql`CREATE TYPE payment_method AS ENUM ('QUATAPAY','MTN_MOMO','ORANGE_MONEY')`.execute(db);
  await sql`CREATE TYPE kyc_status AS ENUM ('NONE','PENDING','APPROVED','REJECTED','RESUBMIT')`.execute(db);
  await sql`CREATE TYPE withdrawal_status AS ENUM
    ('REQUESTED','RISK_HOLD','PENDING_APPROVAL','APPROVED','SIGNING','BROADCAST','CONFIRMED','REJECTED','FAILED')`.execute(db);
  await sql`CREATE TYPE deposit_status AS ENUM ('SEEN','CONFIRMING','CREDITED','ORPHANED','IGNORED_DUST')`.execute(db);
  await sql`CREATE TYPE dispute_status AS ENUM ('OPEN','AWAITING_EVIDENCE','UNDER_REVIEW','RESOLVED')`.execute(db);
  await sql`CREATE TYPE admin_role AS ENUM
    ('SUPER_ADMIN','FINANCE_ADMIN','COMPLIANCE_ADMIN','SUPPORT_ADMIN','MODERATOR','AUDITOR','ANALYST')`.execute(db);

  await sql`
    CREATE TABLE users (
      id uuid PRIMARY KEY,
      email citext UNIQUE NOT NULL,
      phone text UNIQUE,
      password_hash text NOT NULL,
      pin_hash text,
      pin_attempts int NOT NULL DEFAULT 0,
      pin_locked_until timestamptz,
      failed_login_attempts int NOT NULL DEFAULT 0,
      locked_until timestamptz,
      first_name text,
      last_name text,
      country char(2) NOT NULL DEFAULT 'CM',
      email_verified_at timestamptz,
      phone_verified_at timestamptz,
      kyc_tier smallint NOT NULL DEFAULT 0,
      kyc_status kyc_status NOT NULL DEFAULT 'NONE',
      totp_secret_enc bytea,
      totp_enabled boolean NOT NULL DEFAULT false,
      status text NOT NULL DEFAULT 'active'
        CHECK (status IN ('active','frozen','suspended','closed')),
      reputation_score int NOT NULL DEFAULT 0,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz
    )`.execute(db);

  await sql`
    CREATE TABLE sessions (
      id uuid PRIMARY KEY,
      user_id uuid NOT NULL REFERENCES users(id),
      refresh_hash text NOT NULL,
      device_fingerprint text,
      ip inet,
      user_agent text,
      expires_at timestamptz NOT NULL,
      revoked_at timestamptz,
      rotated_from uuid,
      created_at timestamptz NOT NULL DEFAULT now()
    )`.execute(db);
  await sql`CREATE INDEX sessions_user_idx ON sessions (user_id)`.execute(db);
  await sql`CREATE UNIQUE INDEX sessions_refresh_hash_idx ON sessions (refresh_hash)`.execute(db);

  await sql`
    CREATE TABLE auth_tokens (
      id uuid PRIMARY KEY,
      user_id uuid NOT NULL REFERENCES users(id),
      kind text NOT NULL CHECK (kind IN ('email_otp','phone_otp','password_reset')),
      token_hash text NOT NULL,
      expires_at timestamptz NOT NULL,
      consumed_at timestamptz,
      attempts int NOT NULL DEFAULT 0,
      created_at timestamptz NOT NULL DEFAULT now()
    )`.execute(db);
  await sql`CREATE INDEX auth_tokens_user_kind_idx ON auth_tokens (user_id, kind)`.execute(db);

  await sql`
    CREATE TABLE admins (
      id uuid PRIMARY KEY,
      email citext UNIQUE NOT NULL,
      password_hash text NOT NULL,
      role admin_role NOT NULL,
      totp_secret_enc bytea NOT NULL,
      active boolean NOT NULL DEFAULT true,
      created_at timestamptz NOT NULL DEFAULT now()
    )`.execute(db);
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await sql`DROP TABLE IF EXISTS admins, auth_tokens, sessions, users CASCADE`.execute(db);
  for (const t of [
    "admin_role","dispute_status","deposit_status","withdrawal_status","kyc_status",
    "payment_method","offer_side","offer_status","trade_status","entry_reason","account_kind","asset_code",
  ]) {
    await sql.raw(`DROP TYPE IF EXISTS ${t} CASCADE`).execute(db);
  }
}
