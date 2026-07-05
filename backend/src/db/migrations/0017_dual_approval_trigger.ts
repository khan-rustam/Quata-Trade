import { sql, type Kysely } from "kysely";

/**
 * Reconcile the dual-approval backstop with the editable threshold (B27 / 3E-E3).
 *
 * Before: withdrawals carried a `big_needs_two` CHECK that HARDCODED 500000000,
 * while the withdrawal service gates dual approval on the editable
 * settings.withdrawal_caps.dual_approval_threshold. Raising the setting above 500M
 * let the app single-approve a withdrawal the CHECK then rejected (23514) → the
 * approval was un-committable (a DoS on that band); lowering it let the DB pass a
 * single-approved large withdrawal the app should have held.
 *
 * After: a BEFORE INSERT/UPDATE trigger reads the LIVE threshold, so DB and app
 * always agree. It fires only when a withdrawal ENTERS an approved/settling state
 * (the approval decision point) — not on every later pipeline transition — so
 * lowering the threshold can never retroactively brick an already-approved,
 * in-flight withdrawal. It also fixes 3E-E3/D11 by requiring approved_by IS NOT
 * NULL in the two-approver arm (the old CHECK omitted it).
 */
const RELEASED = "'APPROVED','SIGNING','BROADCAST','CONFIRMED'";

export async function up(db: Kysely<unknown>): Promise<void> {
  await sql`ALTER TABLE withdrawals DROP CONSTRAINT big_needs_two`.execute(db);

  await sql`
    CREATE OR REPLACE FUNCTION assert_withdrawal_dual_approval() RETURNS trigger AS $$
    DECLARE
      threshold bigint;
    BEGIN
      -- Only gate the transition INTO an approved/settling state.
      IF NEW.status NOT IN (${sql.raw(RELEASED)}) THEN
        RETURN NEW;
      END IF;
      -- Already in a released state (e.g. APPROVED -> SIGNING): the dual-approval
      -- decision was made on entry; do not re-evaluate against a since-changed
      -- threshold (that would strand an in-flight withdrawal).
      IF TG_OP = 'UPDATE' AND OLD.status IN (${sql.raw(RELEASED)}) THEN
        RETURN NEW;
      END IF;

      SELECT (value->>'dual_approval_threshold')::bigint INTO threshold
        FROM settings WHERE key = 'withdrawal_caps';
      IF threshold IS NULL THEN
        RAISE EXCEPTION 'withdrawal_caps.dual_approval_threshold missing — cannot approve';
      END IF;

      IF NEW.amount >= threshold
         AND NOT (NEW.approved_by IS NOT NULL
                  AND NEW.second_approver IS NOT NULL
                  AND NEW.second_approver <> NEW.approved_by) THEN
        RAISE EXCEPTION
          'withdrawal % (amount %) >= dual-approval threshold % requires two distinct approvers',
          NEW.id, NEW.amount, threshold;
      END IF;
      RETURN NEW;
    END $$ LANGUAGE plpgsql`.execute(db);

  await sql`
    CREATE TRIGGER trg_withdrawal_dual_approval
      BEFORE INSERT OR UPDATE ON withdrawals
      FOR EACH ROW EXECUTE FUNCTION assert_withdrawal_dual_approval()`.execute(db);
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await sql`DROP TRIGGER IF EXISTS trg_withdrawal_dual_approval ON withdrawals`.execute(db);
  await sql`DROP FUNCTION IF EXISTS assert_withdrawal_dual_approval CASCADE`.execute(db);
  // Restore the original hardcoded CHECK as NOT VALID: once the threshold was raised
  // above 500M, the trigger legitimately allowed released single-approver rows in that
  // band, which the literal-500M CHECK would reject on a scanning ADD CONSTRAINT (23514,
  // bricking the rollback). NOT VALID enforces the invariant on new writes without
  // scanning that pre-existing history.
  await sql`
    ALTER TABLE withdrawals ADD CONSTRAINT big_needs_two CHECK (
      status NOT IN (${sql.raw(RELEASED)})
      OR amount < 500000000
      OR (second_approver IS NOT NULL AND second_approver <> approved_by)
    ) NOT VALID`.execute(db);
}
