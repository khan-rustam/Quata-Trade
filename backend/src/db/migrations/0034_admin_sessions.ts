import { sql, type Kysely } from "kysely";

/**
 * Admin sessions — rotating refresh tokens for the admin panel.
 *
 * Reverses `Documents/10` D20 ("no refresh cookie for admins in v1"), whose
 * reasoning was sound: fewer long-lived credentials for the highest-privilege
 * principals. What it did NOT anticipate is that a 10-minute in-memory token
 * with no refresh means an admin is logged out mid-task several times an hour
 * — including in the middle of a form submit, where the failure surfaces as an
 * unexplained error rather than "your session expired". That is its own
 * security problem: it trains admins to keep a password manager open and
 * re-authenticate reflexively, which is exactly the habit phishing exploits.
 *
 * The replacement keeps the short access token (still 10 minutes, still memory
 * only) and adds a rotating refresh token behind an httpOnly cookie. The
 * long-lived credential is therefore unreadable by JavaScript, revocable
 * server-side, and self-destructs on replay.
 *
 * A SEPARATE table from `sessions`, not a discriminator column, because
 * `sessions.user_id` is `REFERENCES users(id)` — an admin is a different
 * principal in a different table. Widening that FK to "either table" would
 * mean dropping the constraint, and an unconstrained principal id on a
 * session row is how a session ends up pointing at nothing.
 *
 * Column-for-column parallel to `sessions` on purpose: the rotation and
 * reuse-detection logic is the same algorithm, and two tables that drift
 * apart in shape become two algorithms that drift apart in behaviour.
 */
export async function up(db: Kysely<unknown>): Promise<void> {
  await sql`
    CREATE TABLE admin_sessions (
      id uuid PRIMARY KEY,
      admin_id uuid NOT NULL REFERENCES admins(id) ON DELETE CASCADE,
      refresh_hash text NOT NULL,
      ip inet,
      user_agent text,
      expires_at timestamptz NOT NULL,
      revoked_at timestamptz,
      -- The rotation chain. Following it in both directions is what lets a
      -- replayed token kill every sibling, including the thief's live one.
      rotated_from uuid,
      created_at timestamptz NOT NULL DEFAULT now()
    )`.execute(db);

  await sql`CREATE INDEX admin_sessions_admin_idx ON admin_sessions (admin_id)`.execute(db);
  // UNIQUE, not just an index: two rows sharing a refresh hash would make
  // "which session is this token?" ambiguous at exactly the moment it matters.
  await sql`CREATE UNIQUE INDEX admin_sessions_refresh_hash_idx ON admin_sessions (refresh_hash)`.execute(db);
  // The sweep of expired rows walks this.
  await sql`CREATE INDEX admin_sessions_expires_idx ON admin_sessions (expires_at) WHERE revoked_at IS NULL`.execute(db);
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await sql`DROP TABLE IF EXISTS admin_sessions`.execute(db);
}
