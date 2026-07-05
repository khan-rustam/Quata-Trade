import { sql, type Kysely } from "kysely";

/**
 * Promotional fee campaigns (fee-engine spec): time-limited, country-specific,
 * reduced/zero-fee programs. Seeded as an empty array (no active promos). Admins
 * add/remove campaigns via PATCH /admin/settings. No existing money value changes.
 */
export async function up(db: Kysely<unknown>): Promise<void> {
  await sql`
    INSERT INTO settings (key, value) VALUES ('promo_campaigns', '[]')
    ON CONFLICT (key) DO NOTHING`.execute(db);
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await sql`DELETE FROM settings WHERE key = 'promo_campaigns'`.execute(db);
}
