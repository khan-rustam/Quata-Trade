import { sql, type Kysely } from "kysely";

/**
 * Admin-editable hot-wallet + launch-protection limits (Documents/10 D30-limits).
 * Closes audit gaps #6/#11 (these were absent from the settings whitelist). All
 * default to 0 = disabled, so seeding changes no runtime behaviour until an admin
 * sets a value. Amounts are smallest-unit strings; queue/count fields are ints.
 */
export async function up(db: Kysely<unknown>): Promise<void> {
  await sql`
    INSERT INTO settings (key, value) VALUES
      ('hot_wallet', '{"max_balance":"0","min_balance":"0","reserve":"0","daily_op_limit":"0","alert_threshold":"0"}'),
      ('launch_limits', '{"max_user_balance":"0","max_daily_deposit_per_user":"0","max_platform_custody":"0","max_daily_withdrawal_volume":"0","max_pending_withdrawal_queue":0,"max_withdrawals_per_day":0}')
    ON CONFLICT (key) DO NOTHING`.execute(db);
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await sql`DELETE FROM settings WHERE key IN ('hot_wallet', 'launch_limits')`.execute(db);
}
