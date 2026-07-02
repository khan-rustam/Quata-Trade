import { sql, type Kysely } from "kysely";

/**
 * The ledger — append-only double-entry (Documents/04-database-schema.md §4.2).
 * HIGHEST REVIEW PRIORITY. Do not touch without reading the doc.
 *
 * Clarifications vs the doc DDL (documented for the Deviations Log):
 *  - accounts UNIQUE uses NULLS NOT DISTINCT: platform accounts have
 *    owner_user_id = NULL and Postgres would otherwise allow duplicates.
 *  - account_balances carries a denormalized `kind` so the non-negativity
 *    CHECK can exempt the 'external' contra account (see 0001 header).
 */
export async function up(db: Kysely<unknown>): Promise<void> {
  await sql`
    CREATE TABLE accounts (
      id uuid PRIMARY KEY,
      owner_user_id uuid REFERENCES users(id),
      kind account_kind NOT NULL,
      asset asset_code NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now(),
      UNIQUE NULLS NOT DISTINCT (owner_user_id, kind, asset),
      CONSTRAINT platform_accounts_have_no_owner CHECK (
        (kind IN ('user_available','user_escrow') AND owner_user_id IS NOT NULL)
        OR (kind NOT IN ('user_available','user_escrow') AND owner_user_id IS NULL)
      )
    )`.execute(db);

  await sql`
    CREATE TABLE journal_entries (
      id uuid PRIMARY KEY,
      reason entry_reason NOT NULL,
      reference_type text NOT NULL,
      reference_id uuid NOT NULL,
      idempotency_key text NOT NULL UNIQUE,
      created_by text NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now()
    )`.execute(db);

  await sql`
    CREATE TABLE ledger_entries (
      id uuid PRIMARY KEY,
      journal_id uuid NOT NULL REFERENCES journal_entries(id),
      account_id uuid NOT NULL REFERENCES accounts(id),
      asset asset_code NOT NULL,
      amount bigint NOT NULL CHECK (amount <> 0),
      created_at timestamptz NOT NULL DEFAULT now()
    )`.execute(db);
  await sql`CREATE INDEX ledger_entries_account_idx ON ledger_entries (account_id, created_at)`.execute(db);
  await sql`CREATE INDEX ledger_entries_journal_idx ON ledger_entries (journal_id)`.execute(db);

  // Append-only enforcement at DB level — blocks even the table owner.
  await sql`CREATE RULE ledger_no_update AS ON UPDATE TO ledger_entries DO INSTEAD NOTHING`.execute(db);
  await sql`CREATE RULE ledger_no_delete AS ON DELETE TO ledger_entries DO INSTEAD NOTHING`.execute(db);
  await sql`CREATE RULE journal_no_update AS ON UPDATE TO journal_entries DO INSTEAD NOTHING`.execute(db);
  await sql`CREATE RULE journal_no_delete AS ON DELETE TO journal_entries DO INSTEAD NOTHING`.execute(db);

  // Zero-sum invariant per journal, deferred to commit.
  await sql`
    CREATE OR REPLACE FUNCTION assert_journal_balanced() RETURNS trigger AS $$
    BEGIN
      IF (SELECT COALESCE(SUM(amount),0) FROM ledger_entries WHERE journal_id = NEW.journal_id) <> 0
      THEN RAISE EXCEPTION 'journal % not balanced', NEW.journal_id; END IF;
      RETURN NULL;
    END $$ LANGUAGE plpgsql`.execute(db);
  await sql`
    CREATE CONSTRAINT TRIGGER trg_journal_balanced
      AFTER INSERT ON ledger_entries DEFERRABLE INITIALLY DEFERRED
      FOR EACH ROW EXECUTE FUNCTION assert_journal_balanced()`.execute(db);

  // Cached balances — ONLY written by LedgerService in the same tx.
  await sql`
    CREATE TABLE account_balances (
      account_id uuid PRIMARY KEY REFERENCES accounts(id),
      kind account_kind NOT NULL,
      balance bigint NOT NULL DEFAULT 0,
      version bigint NOT NULL DEFAULT 0,
      CONSTRAINT non_negative CHECK (kind = 'external' OR balance >= 0)
    )`.execute(db);
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await sql`DROP TABLE IF EXISTS account_balances CASCADE`.execute(db);
  await sql`DROP TABLE IF EXISTS ledger_entries CASCADE`.execute(db);
  await sql`DROP FUNCTION IF EXISTS assert_journal_balanced CASCADE`.execute(db);
  await sql`DROP TABLE IF EXISTS journal_entries CASCADE`.execute(db);
  await sql`DROP TABLE IF EXISTS accounts CASCADE`.execute(db);
}
