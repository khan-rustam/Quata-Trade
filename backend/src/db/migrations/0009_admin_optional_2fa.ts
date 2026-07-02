import { sql, type Kysely } from "kysely";

/**
 * Admin 2FA becomes OPTIONAL (product decision for the test phase; will be made
 * mandatory again for production via policy, not schema). Admins log in with
 * email + password, then enable TOTP from their profile when they choose.
 *
 * - totp_secret_enc becomes nullable (an admin may have no secret yet).
 * - totp_enabled flag gates whether login + step-up require a code.
 * Existing admins keep any stored secret but start disabled until they re-enable.
 */
export async function up(db: Kysely<unknown>): Promise<void> {
  await sql`ALTER TABLE admins ALTER COLUMN totp_secret_enc DROP NOT NULL`.execute(db);
  await sql`ALTER TABLE admins ADD COLUMN IF NOT EXISTS totp_enabled boolean NOT NULL DEFAULT false`.execute(db);
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await sql`ALTER TABLE admins DROP COLUMN IF EXISTS totp_enabled`.execute(db);
  // note: cannot safely re-add NOT NULL on totp_secret_enc without data guarantees
}
