import { sql, type Kysely } from "kysely";

/**
 * Deposit platform fee + policy hold (fee-engine spec, Phase 1).
 *
 * - `fee`: the platform deposit fee charged at credit (net credited = amount − fee),
 *   recorded per-deposit for history/reporting. Mirrors withdrawals.fee.
 * - `policy_hold` / `policy_reason`: a deposit whose GROSS amount is below the
 *   admin-configured minimum or above the maximum is HELD for manual review instead
 *   of auto-credited (and instead of the old silent IGNORED_DUST drop). Mirrors the
 *   existing aml_hold / aml_reason pair so the admin queue can surface both.
 *
 * The env DEPOSIT_MIN_AMOUNT dust floor at the scanner is unchanged (true network
 * dust stays IGNORED_DUST); the admin-editable deposit_policy min/max is enforced at
 * credit time where the live settings value is read.
 */
export async function up(db: Kysely<unknown>): Promise<void> {
  await sql`ALTER TABLE deposits ADD COLUMN fee bigint NOT NULL DEFAULT 0 CHECK (fee >= 0)`.execute(db);
  await sql`ALTER TABLE deposits ADD COLUMN policy_hold boolean NOT NULL DEFAULT false`.execute(db);
  await sql`ALTER TABLE deposits ADD COLUMN policy_reason text`.execute(db);
  // Held deposits (aml or policy) are the manual-review queue — index for the admin view.
  await sql`CREATE INDEX deposits_held_idx ON deposits (created_at DESC) WHERE aml_hold OR policy_hold`.execute(db);
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await sql`DROP INDEX IF EXISTS deposits_held_idx`.execute(db);
  await sql`ALTER TABLE deposits DROP COLUMN IF EXISTS policy_reason`.execute(db);
  await sql`ALTER TABLE deposits DROP COLUMN IF EXISTS policy_hold`.execute(db);
  await sql`ALTER TABLE deposits DROP COLUMN IF EXISTS fee`.execute(db);
}
