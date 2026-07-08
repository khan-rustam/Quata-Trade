import { sql, type Kysely } from "kysely";

/**
 * Price alerts (Markets Phase G). A logged-in user is emailed + in-app notified
 * when a coin crosses a target price. `target` is an informational external USD
 * threshold (market data, not a ledger amount) — double precision is fine here;
 * the BIGINT-string money rule applies to QuataTrade balances, not market prices.
 *
 * NOTE: new tables need an explicit app-role grant (0006 granted only the tables
 * existing then; there is no ALTER DEFAULT PRIVILEGES for quatatrade_app).
 */
export async function up(db: Kysely<unknown>): Promise<void> {
  await sql`
    CREATE TABLE price_alerts (
      id uuid PRIMARY KEY,
      user_id uuid NOT NULL REFERENCES users(id),
      coin_id text NOT NULL,
      symbol text NOT NULL,
      direction text NOT NULL CHECK (direction IN ('above', 'below')),
      target double precision NOT NULL CHECK (target > 0),
      active boolean NOT NULL DEFAULT true,
      triggered_at timestamptz,
      created_at timestamptz NOT NULL DEFAULT now()
    )`.execute(db);
  await sql`CREATE INDEX price_alerts_active_idx ON price_alerts (coin_id) WHERE active`.execute(db);
  await sql`CREATE INDEX price_alerts_user_idx ON price_alerts (user_id)`.execute(db);
  await sql`GRANT SELECT, INSERT, UPDATE, DELETE ON price_alerts TO quatatrade_app`.execute(db);
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await sql`DROP TABLE IF EXISTS price_alerts`.execute(db);
}
