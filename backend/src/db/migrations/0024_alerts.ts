import { sql, type Kysely } from "kysely";

/**
 * Persisted ops/security alerts (Documents/09 §G). AlertsService fires these on
 * reconciliation mismatch, AML hit, stuck withdrawal, kill-switch toggle, etc.
 * Previously fire-and-forget (webhook + log); now stored so the admin Alerts
 * page shows a history and admins can acknowledge them. Append-only in spirit:
 * only `acknowledged_at`/`acknowledged_by` are ever updated.
 *
 * NOTE: new tables need an explicit app-role grant (0006 granted only the tables
 * existing then; there is no ALTER DEFAULT PRIVILEGES for quatatrade_app).
 */
export async function up(db: Kysely<unknown>): Promise<void> {
  await sql`
    CREATE TABLE alerts (
      id uuid PRIMARY KEY,
      severity text NOT NULL CHECK (severity IN ('info', 'warning', 'critical')),
      event_type text NOT NULL,
      title text NOT NULL,
      metadata jsonb,
      acknowledged_at timestamptz,
      acknowledged_by uuid REFERENCES admins(id),
      created_at timestamptz NOT NULL DEFAULT now()
    )`.execute(db);
  await sql`CREATE INDEX alerts_created_idx ON alerts (created_at DESC)`.execute(db);
  await sql`CREATE INDEX alerts_unack_idx ON alerts (created_at DESC) WHERE acknowledged_at IS NULL`.execute(db);
  await sql`GRANT SELECT, INSERT, UPDATE ON alerts TO quatatrade_app`.execute(db);
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await sql`DROP TABLE IF EXISTS alerts`.execute(db);
}
