import { sql, type Kysely } from "kysely";

/**
 * Market watchlist (Markets Phase C). A logged-in user stars coins by CoinGecko
 * id; purely a personal bookmark list, independent of the ledger/P2P engine.
 *
 * NOTE: new tables need an explicit app-role grant (0006 granted only the tables
 * existing then; there is no ALTER DEFAULT PRIVILEGES for quatatrade_app).
 */
export async function up(db: Kysely<unknown>): Promise<void> {
  await sql`
    CREATE TABLE watchlists (
      id uuid PRIMARY KEY,
      user_id uuid NOT NULL REFERENCES users(id),
      coin_id text NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now(),
      UNIQUE (user_id, coin_id)
    )`.execute(db);
  await sql`CREATE INDEX watchlists_user_idx ON watchlists (user_id)`.execute(db);
  await sql`GRANT SELECT, INSERT, DELETE ON watchlists TO quatatrade_app`.execute(db);
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await sql`DROP TABLE IF EXISTS watchlists`.execute(db);
}
