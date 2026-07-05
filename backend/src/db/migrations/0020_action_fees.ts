import { sql, type Kysely } from "kysely";

/**
 * Advertisement (offer) + dispute fee engine — "exists but disabled" (fee-engine
 * spec). Adds the ledger entry reasons so a charge can be recorded when enabled, and
 * seeds both fees to 0 (disabled). Admins set the amounts via PATCH /admin/settings.
 * No existing money value changes.
 */
export async function up(db: Kysely<unknown>): Promise<void> {
  await sql`ALTER TYPE entry_reason ADD VALUE IF NOT EXISTS 'advertisement_fee'`.execute(db);
  await sql`ALTER TYPE entry_reason ADD VALUE IF NOT EXISTS 'dispute_fee'`.execute(db);
  await sql`
    INSERT INTO settings (key, value) VALUES
      ('advertisement_fee', '"0"'),
      ('dispute_fee', '"0"')
    ON CONFLICT (key) DO NOTHING`.execute(db);
}

export async function down(db: Kysely<unknown>): Promise<void> {
  // Postgres cannot drop enum values; only remove the seeded settings rows.
  await sql`DELETE FROM settings WHERE key IN ('advertisement_fee', 'dispute_fee')`.execute(db);
}
