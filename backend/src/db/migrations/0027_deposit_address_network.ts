import { sql, type Kysely } from "kysely";

/**
 * Wallet-provisioning support (Documents/10 D30-provision). Deposit addresses
 * now carry an explicit `network` so a provisioned wallet reports (address +
 * network + status[=active] + created_at), and future chains are self-describing
 * without redesign. Existing rows are TRON. The `active` boolean already models
 * address status (ACTIVE vs retired); no separate status column is added.
 */
export async function up(db: Kysely<unknown>): Promise<void> {
  await sql`ALTER TABLE deposit_addresses ADD COLUMN network text NOT NULL DEFAULT 'TRON'`.execute(db);
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await sql`ALTER TABLE deposit_addresses DROP COLUMN IF EXISTS network`.execute(db);
}
