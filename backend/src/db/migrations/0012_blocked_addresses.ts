import { sql, type Kysely } from "kysely";

/**
 * AML / sanctions / wallet-blacklist screening (Documents/08 §E, security
 * remediation item 4). One deterministic blocklist — sanctions feed,
 * chain-analysis hits and manual compliance entries — consulted on every
 * OUTBOUND withdrawal destination and (item 4b) every INBOUND deposit source.
 * Deterministic lookup only; no LLM anywhere in the AML path.
 * NOTE: new tables need an explicit app-role grant (0006 granted only the
 * tables existing then; no ALTER DEFAULT PRIVILEGES for quatatrade_app).
 */
export async function up(db: Kysely<unknown>): Promise<void> {
  await sql`
    CREATE TABLE blocked_addresses (
      id uuid PRIMARY KEY,
      asset asset_code NOT NULL,
      address text NOT NULL,
      category text NOT NULL,
      reason text NOT NULL,
      source text NOT NULL DEFAULT 'manual',
      active boolean NOT NULL DEFAULT true,
      created_by text NOT NULL DEFAULT 'system',
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz,
      UNIQUE (asset, address)
    )`.execute(db);
  // Partial index: the screening hot path only ever looks up ACTIVE entries.
  await sql`CREATE INDEX blocked_addresses_active_idx ON blocked_addresses (asset, address) WHERE active`.execute(db);
  await sql`GRANT SELECT, INSERT, UPDATE, DELETE ON blocked_addresses TO quatatrade_app`.execute(db);
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await sql`DROP TABLE IF EXISTS blocked_addresses`.execute(db);
}
