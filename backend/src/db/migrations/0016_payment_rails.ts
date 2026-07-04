import { sql, type Kysely } from "kysely";

/**
 * Broaden the payment-rail domain for the multi-country rollout.
 *
 * The `payment_method` PG enum is the value DOMAIN; each country's AVAILABLE rails live
 * in countries.payment_methods (admin-editable per market). A PG enum can only grow via
 * migration, so we pre-load the rails an admin might assign to a market, plus a default
 * fee for each so fee computation never meets an unconfigured rail. Admins pick the
 * actual per-country subset from the admin console when configuring each market.
 *
 * PG16 permits `ALTER TYPE ... ADD VALUE` inside a transaction; we do NOT use the new
 * values anywhere in THIS migration (per-country assignment is a runtime admin action),
 * so the "unsafe use of a new enum value in the same transaction" restriction never applies.
 */
const NEW_RAILS = [
  "BANK_TRANSFER",
  "MPESA",
  "AIRTEL_MONEY",
  "MOOV_MONEY",
  "WAVE",
  "VODAFONE_CASH",
  "OPAY",
  "PALMPAY",
] as const;

export async function up(db: Kysely<unknown>): Promise<void> {
  for (const rail of NEW_RAILS) {
    await sql`ALTER TYPE payment_method ADD VALUE IF NOT EXISTS ${sql.lit(rail)}`.execute(db);
  }

  // Default 0.5% (50 bps) per new rail. The `||` merge preserves any admin-tuned existing
  // fees (fee_bps is plain settings JSON, no enum reference — safe in the same migration).
  const defaults = Object.fromEntries(NEW_RAILS.map((r) => [r, 50]));
  await sql`
    UPDATE settings
    SET value = value || ${sql.lit(JSON.stringify(defaults))}::jsonb, updated_at = now()
    WHERE key = 'fee_bps'`.execute(db);
}

export async function down(db: Kysely<unknown>): Promise<void> {
  // Postgres cannot remove enum values, so the rail domain stays; drop only the seeded fees.
  await sql`
    UPDATE settings
    SET value = value - ${sql.lit(`{${NEW_RAILS.join(",")}}`)}::text[]
    WHERE key = 'fee_bps'`.execute(db);
}
