import { sql, type Kysely } from "kysely";

/**
 * TOTP replay protection (single-use). Persist the last-accepted TOTP time-step
 * per principal; a code is accepted only if its step is strictly greater than the
 * stored one, so the same 6-digit code cannot be reused inside its ~30-90s window
 * (Documents/08 §E). Nullable — never-verified principals start clean.
 *
 * `integer` is sufficient: the step is unix_seconds/30 (~5.9e7 today, < int4 max
 * ~2.1e9 until well past year 3000).
 */
export async function up(db: Kysely<unknown>): Promise<void> {
  await sql`ALTER TABLE users  ADD COLUMN IF NOT EXISTS totp_last_step integer`.execute(db);
  await sql`ALTER TABLE admins ADD COLUMN IF NOT EXISTS totp_last_step integer`.execute(db);
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await sql`ALTER TABLE users  DROP COLUMN IF EXISTS totp_last_step`.execute(db);
  await sql`ALTER TABLE admins DROP COLUMN IF EXISTS totp_last_step`.execute(db);
}
