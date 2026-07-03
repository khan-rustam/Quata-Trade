import { sql, type Kysely } from "kysely";

/**
 * Withdrawal address whitelist + security holds (Documents/08 §D). A withdrawal may
 * ONLY go to a saved, active address whose cooldown has elapsed, and credential
 * changes park withdrawals for a hold window — an attacker can't add + immediately
 * drain to a fresh address, nor withdraw right after a password/2FA change.
 * NOTE: new tables need an explicit app-role grant (0006 granted only the tables
 * existing then; no ALTER DEFAULT PRIVILEGES for quatatrade_app).
 */
export async function up(db: Kysely<unknown>): Promise<void> {
  await sql`
    CREATE TABLE withdrawal_addresses (
      id uuid PRIMARY KEY,
      user_id uuid NOT NULL REFERENCES users(id),
      asset asset_code NOT NULL,
      address text NOT NULL,
      label text,
      usable_at timestamptz NOT NULL,
      active boolean NOT NULL DEFAULT true,
      created_at timestamptz NOT NULL DEFAULT now(),
      UNIQUE (user_id, asset, address)
    )`.execute(db);
  await sql`CREATE INDEX withdrawal_addresses_user_idx ON withdrawal_addresses (user_id, asset)`.execute(db);
  await sql`GRANT SELECT, INSERT, UPDATE, DELETE ON withdrawal_addresses TO quatatrade_app`.execute(db);

  await sql`ALTER TABLE users ADD COLUMN withdrawal_hold_until timestamptz`.execute(db);

  await sql`
    INSERT INTO settings (key, value)
    VALUES ('security_holds', ${JSON.stringify({ new_address_minutes: 1440 })}::jsonb)
    ON CONFLICT (key) DO NOTHING`.execute(db);
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await sql`DELETE FROM settings WHERE key = 'security_holds'`.execute(db);
  await sql`ALTER TABLE users DROP COLUMN IF EXISTS withdrawal_hold_until`.execute(db);
  await sql`DROP TABLE IF EXISTS withdrawal_addresses`.execute(db);
}
