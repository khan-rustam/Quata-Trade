import { sql, type Kysely } from "kysely";

/**
 * Grant `admin_sessions` to the app role — and stop this whole class of bug.
 *
 * ## What broke
 *
 * 0034 created `admin_sessions` but never granted it. The API connects as the
 * restricted `quatatrade_app` role, so the first admin login after deploy died
 * with `permission denied for table admin_sessions` (SQLSTATE 42501) and the
 * login screen showed "Internal server error". Admin login was down until this
 * ran.
 *
 * 0006's `GRANT ... ON ALL TABLES IN SCHEMA public` only ever covered tables
 * that existed when it ran — 0011_content already carries that warning in a
 * comment. Every migration since has had to remember its own GRANT, and this
 * is what happens the one time somebody doesn't.
 *
 * ## Why the second statement matters more than the first
 *
 * `ALTER DEFAULT PRIVILEGES` makes the grant automatic for every table the
 * migration role creates from now on. Without it, the next new table is one
 * forgotten line away from taking a surface down again, and the failure mode
 * is invisible in local development: a developer's superuser connection has
 * implicit access, so tests pass and production 500s. That asymmetry is why
 * this kept being possible.
 *
 * Kept as a separate migration rather than an edit to 0034, so what ran on
 * production and what the file says never diverge.
 */
export async function up(db: Kysely<unknown>): Promise<void> {
  // The immediate fix. `.catch` mirrors 0011_content: a database where the
  // restricted role was never created (a bare local dev box) must not fail
  // the whole migration chain over a grant to a role that isn't there.
  await sql`GRANT SELECT, INSERT, UPDATE, DELETE ON admin_sessions TO quatatrade_app`
    .execute(db)
    .catch(() => {});

  await sql`GRANT SELECT ON admin_sessions TO quatatrade_readonly`
    .execute(db)
    .catch(() => {});

  // The durable fix: future tables are granted automatically.
  await sql`ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO quatatrade_app`
    .execute(db)
    .catch(() => {});
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await sql`REVOKE SELECT, INSERT, UPDATE, DELETE ON admin_sessions FROM quatatrade_app`
    .execute(db)
    .catch(() => {});
  await sql`REVOKE SELECT ON admin_sessions FROM quatatrade_readonly`
    .execute(db)
    .catch(() => {});
  // Deliberately NOT reverting ALTER DEFAULT PRIVILEGES. Rolling it back would
  // silently strip access from every table created while it was in force —
  // a far larger blast radius than this migration's own scope.
}
