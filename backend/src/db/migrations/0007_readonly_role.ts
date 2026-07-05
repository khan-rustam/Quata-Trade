import { sql, type Kysely } from "kysely";

/**
 * Read-only role for tooling (Postgres MCP connector, BI, reconciliation
 * dashboards). Documents/12 §12.3 hard rule: MCP DB access = dev database,
 * read-only role, never credentials that can touch funds.
 * SELECT-only; no INSERT/UPDATE/DELETE/DDL anywhere.
 */
export async function up(db: Kysely<unknown>): Promise<void> {
  const raw = process.env.QT_MCP_DB_PASSWORD ?? "readonly_dev_only";
  // This role can LOGIN and SELECT every table (incl. KYC/PII, ledger, session
  // hashes). On a real deployment it must never be created with the published dev
  // password. Enforced on staging/production; dev/test/CI stay permissive.
  const enforced = process.env.NODE_ENV === "production" || process.env.NODE_ENV === "staging";
  if (enforced && (raw === "readonly_dev_only" || raw.includes("dev_only"))) {
    throw new Error(
      "QT_MCP_DB_PASSWORD must be a real secret on staging/production (migration 0007 read-only role has SELECT on all tables including KYC/PII).",
    );
  }
  const password = raw.replace(/'/g, "''");
  await sql.raw(`
    DO $$
    BEGIN
      IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'quatatrade_readonly') THEN
        CREATE ROLE quatatrade_readonly LOGIN PASSWORD '${password}';
      END IF;
    END $$;
  `).execute(db);
  await sql`GRANT USAGE ON SCHEMA public TO quatatrade_readonly`.execute(db);
  await sql`GRANT SELECT ON ALL TABLES IN SCHEMA public TO quatatrade_readonly`.execute(db);
  await sql`ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO quatatrade_readonly`.execute(db);
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await sql`REVOKE ALL ON ALL TABLES IN SCHEMA public FROM quatatrade_readonly`.execute(db);
  await sql`REVOKE USAGE ON SCHEMA public FROM quatatrade_readonly`.execute(db);
  await sql`DROP ROLE IF EXISTS quatatrade_readonly`.execute(db);
}
