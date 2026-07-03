import { sql, type Kysely } from "kysely";

/**
 * Per-user off-platform receiving accounts. Payments happen OFF-PLATFORM
 * (MTN MoMo / Orange Money / QuataPay); the buyer needs to know WHERE to send
 * the fiat. This stores, per user, a receiving number + account name per payment
 * method, e.g. { "MTN_MOMO": { "number": "6...", "name": "..." } }. Surfaced to
 * the trade counterparty (the buyer) in the trade room as `sellerPayTo`.
 * A table-level GRANT on `users` (0006) already covers the new column.
 */
export async function up(db: Kysely<unknown>): Promise<void> {
  await sql`ALTER TABLE users ADD COLUMN payment_accounts jsonb NOT NULL DEFAULT '{}'::jsonb`.execute(db);
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await sql`ALTER TABLE users DROP COLUMN payment_accounts`.execute(db);
}
