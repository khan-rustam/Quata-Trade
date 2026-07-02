import { sql, type Kysely } from "kysely";

/**
 * Wallets, deposits, withdrawals (Documents/04-database-schema.md §4.4).
 *
 * Clarification vs doc DDL: the doc's `big_needs_two` CHECK as written would
 * reject INSERTing any large withdrawal (second approver can't exist at
 * request time). The intent — "large withdrawals cannot be APPROVED/signed
 * without a second approver" — is what the constraint enforces here.
 */
export async function up(db: Kysely<unknown>): Promise<void> {
  await sql`
    CREATE TABLE deposit_addresses (
      id uuid PRIMARY KEY,
      user_id uuid NOT NULL REFERENCES users(id),
      asset asset_code NOT NULL,
      address text NOT NULL UNIQUE,
      derivation_index int NOT NULL,
      derivation_path text NOT NULL UNIQUE,
      active boolean NOT NULL DEFAULT true,
      created_at timestamptz NOT NULL DEFAULT now(),
      UNIQUE (user_id, asset),
      UNIQUE (asset, derivation_index)
    )`.execute(db);

  await sql`
    CREATE TABLE deposits (
      id uuid PRIMARY KEY,
      user_id uuid NOT NULL REFERENCES users(id),
      asset asset_code NOT NULL,
      address text NOT NULL,
      tx_hash text NOT NULL,
      log_index int NOT NULL DEFAULT 0,
      amount bigint NOT NULL CHECK (amount > 0),
      token_contract text NOT NULL,
      block_number bigint,
      confirmations int NOT NULL DEFAULT 0,
      status deposit_status NOT NULL DEFAULT 'SEEN',
      credited_journal_id uuid REFERENCES journal_entries(id),
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz,
      UNIQUE (tx_hash, log_index)
    )`.execute(db);
  await sql`CREATE INDEX deposits_user_idx ON deposits (user_id, created_at DESC)`.execute(db);
  await sql`CREATE INDEX deposits_status_idx ON deposits (status) WHERE status IN ('SEEN','CONFIRMING')`.execute(db);

  await sql`
    CREATE TABLE withdrawals (
      id uuid PRIMARY KEY,
      user_id uuid NOT NULL REFERENCES users(id),
      asset asset_code NOT NULL,
      to_address text NOT NULL,
      amount bigint NOT NULL CHECK (amount > 0),
      fee bigint NOT NULL CHECK (fee >= 0),
      status withdrawal_status NOT NULL DEFAULT 'REQUESTED',
      risk_score int,
      risk_flags jsonb,
      approved_by uuid REFERENCES admins(id),
      second_approver uuid REFERENCES admins(id),
      tx_hash text,
      failure_reason text,
      debit_journal_id uuid REFERENCES journal_entries(id),
      idempotency_key text NOT NULL UNIQUE,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz,
      -- ≥500 USDT (500_000_000 units) may not pass approval without 2 distinct admins.
      CONSTRAINT big_needs_two CHECK (
        status NOT IN ('APPROVED','SIGNING','BROADCAST','CONFIRMED')
        OR amount < 500000000
        OR (second_approver IS NOT NULL AND second_approver <> approved_by)
      )
    )`.execute(db);
  await sql`CREATE INDEX withdrawals_user_idx ON withdrawals (user_id, created_at DESC)`.execute(db);
  await sql`CREATE INDEX withdrawals_status_idx ON withdrawals (status)
    WHERE status IN ('REQUESTED','RISK_HOLD','PENDING_APPROVAL','APPROVED','SIGNING','BROADCAST')`.execute(db);
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await sql`DROP TABLE IF EXISTS withdrawals CASCADE`.execute(db);
  await sql`DROP TABLE IF EXISTS deposits CASCADE`.execute(db);
  await sql`DROP TABLE IF EXISTS deposit_addresses CASCADE`.execute(db);
}
