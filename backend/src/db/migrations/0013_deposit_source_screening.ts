import { sql, type Kysely } from "kysely";

/**
 * AML inbound (security remediation item 4b): capture the on-chain SENDER of a
 * deposit and hold — never auto-credit — deposits whose source is on the
 * blocklist. `from_address` is populated by the scanner; `aml_hold` parks a
 * tainted deposit for manual compliance review at the credit chokepoint.
 * (deposits was already granted to quatatrade_app in 0006 — no new grant.)
 */
export async function up(db: Kysely<unknown>): Promise<void> {
  await sql`ALTER TABLE deposits ADD COLUMN from_address text`.execute(db);
  await sql`ALTER TABLE deposits ADD COLUMN aml_hold boolean NOT NULL DEFAULT false`.execute(db);
  await sql`ALTER TABLE deposits ADD COLUMN aml_reason text`.execute(db);
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await sql`ALTER TABLE deposits DROP COLUMN IF EXISTS aml_reason`.execute(db);
  await sql`ALTER TABLE deposits DROP COLUMN IF EXISTS aml_hold`.execute(db);
  await sql`ALTER TABLE deposits DROP COLUMN IF EXISTS from_address`.execute(db);
}
