import { sql, type Kysely } from "kysely";

/**
 * Held-deposit review outcome (audit M1).
 *
 * `aml_hold` / `policy_hold` park a deposit and the confirmation job skips it
 * forever. Until now nothing anywhere could clear either flag: the funds were
 * on-chain, visible, and permanently uncreditable with no admin path out. These
 * columns record the human decision that ends a hold.
 *
 * - RELEASED — credit it anyway. The flags are cleared so the confirmation job
 *   picks the deposit back up. `hold_resolution` also tells the credit path to
 *   SKIP re-screening and the amount policy; without that the same rule that
 *   created the hold would instantly re-apply it and the release would be a
 *   no-op loop.
 * - REJECTED — never credit. The flags STAY set (so the credit path continues to
 *   skip it) and the row leaves the review queue.
 *
 * Deliberately not a new `deposit_status` enum value: the on-chain facts of the
 * row are unchanged, only the review outcome is new, and adding an enum value
 * would ripple through the shared contract and every status renderer.
 */
export async function up(db: Kysely<unknown>): Promise<void> {
  await sql`ALTER TABLE deposits ADD COLUMN hold_resolution text
              CHECK (hold_resolution IN ('RELEASED','REJECTED'))`.execute(db);
  await sql`ALTER TABLE deposits ADD COLUMN hold_resolution_reason text`.execute(db);
  await sql`ALTER TABLE deposits ADD COLUMN hold_resolved_by uuid REFERENCES admins(id)`.execute(db);
  await sql`ALTER TABLE deposits ADD COLUMN hold_resolved_at timestamptz`.execute(db);

  // The review queue is "held AND not yet decided" — replaces the older
  // held-only index, which would keep scanning rows an admin already closed.
  await sql`DROP INDEX IF EXISTS deposits_held_idx`.execute(db);
  await sql`CREATE INDEX deposits_held_open_idx ON deposits (created_at DESC)
              WHERE (aml_hold OR policy_hold) AND hold_resolution IS NULL`.execute(db);
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await sql`DROP INDEX IF EXISTS deposits_held_open_idx`.execute(db);
  await sql`CREATE INDEX deposits_held_idx ON deposits (created_at DESC) WHERE aml_hold OR policy_hold`.execute(db);
  await sql`ALTER TABLE deposits DROP COLUMN IF EXISTS hold_resolved_at`.execute(db);
  await sql`ALTER TABLE deposits DROP COLUMN IF EXISTS hold_resolved_by`.execute(db);
  await sql`ALTER TABLE deposits DROP COLUMN IF EXISTS hold_resolution_reason`.execute(db);
  await sql`ALTER TABLE deposits DROP COLUMN IF EXISTS hold_resolution`.execute(db);
}
