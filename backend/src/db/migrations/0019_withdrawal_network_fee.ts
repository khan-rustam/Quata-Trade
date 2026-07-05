import { sql, type Kysely } from "kysely";

/**
 * Seed the withdrawal_network_fee settings row (fee-engine spec: show the estimated
 * on-chain network fee before confirmation). Default 0 — the admin sets the estimate
 * via PATCH /admin/settings. Only seeded keys are editable, so the row must exist.
 * This adds a new config row; it does not change any existing money value.
 */
export async function up(db: Kysely<unknown>): Promise<void> {
  await sql`
    INSERT INTO settings (key, value) VALUES ('withdrawal_network_fee', '{"USDT_TRC20":"0"}')
    ON CONFLICT (key) DO NOTHING`.execute(db);
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await sql`DELETE FROM settings WHERE key = 'withdrawal_network_fee'`.execute(db);
}
