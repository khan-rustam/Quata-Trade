import { sql, type Kysely } from "kysely";

/**
 * Per-side trading fee (fee-engine Phase 2). Adds the SELLER trading fee to trades,
 * recorded alongside the existing (buyer) fee_bps/fee_amount. The seller escrows
 * amount + seller_fee_amount; on release treasury receives buyer + seller fees.
 *
 * Both columns default to 0 (NOT NULL) so every existing row and any code path that
 * doesn't set them keeps the exact Phase-1 behaviour (0% seller fee). No existing
 * money value changes. seller_fee_bps is seeded to 0 in settings — Phase 2 is a
 * pure admin PATCH (0.2–0.5% → 20–50 bps) with no code deploy.
 */
export async function up(db: Kysely<unknown>): Promise<void> {
  await sql`
    ALTER TABLE trades
      ADD COLUMN seller_fee_bps integer NOT NULL DEFAULT 0,
      ADD COLUMN seller_fee_amount bigint NOT NULL DEFAULT 0
        CHECK (seller_fee_amount >= 0)`.execute(db);

  await sql`
    INSERT INTO settings (key, value) VALUES ('seller_fee_bps', '0')
    ON CONFLICT (key) DO NOTHING`.execute(db);
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await sql`ALTER TABLE trades DROP COLUMN seller_fee_amount`.execute(db);
  await sql`ALTER TABLE trades DROP COLUMN seller_fee_bps`.execute(db);
  await sql`DELETE FROM settings WHERE key = 'seller_fee_bps'`.execute(db);
}
