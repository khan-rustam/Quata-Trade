import { sql, type Kysely } from "kysely";

/**
 * Profile enhancements (Documents/10 D25): an opt-in public display handle,
 * DiceBear avatar choice (style + seed), a short bio, and email-change fields.
 * All nullable and additive — no backfill needed. display_name is an OPT-IN
 * public handle; when null the masked name (first name / masked email) is used,
 * preserving the existing counterparty-privacy default.
 */
export async function up(db: Kysely<unknown>): Promise<void> {
  await sql`
    ALTER TABLE users
      ADD COLUMN display_name text,
      ADD COLUMN avatar_style text,
      ADD COLUMN avatar_seed text,
      ADD COLUMN bio text,
      ADD COLUMN pending_email citext,
      ADD COLUMN pending_email_token_hash text,
      ADD COLUMN pending_email_expires_at timestamptz`.execute(db);

  await sql`ALTER TABLE users ADD CONSTRAINT display_name_len
    CHECK (display_name IS NULL OR char_length(display_name) BETWEEN 2 AND 24)`.execute(db);
  await sql`ALTER TABLE users ADD CONSTRAINT bio_len
    CHECK (bio IS NULL OR char_length(bio) <= 280)`.execute(db);
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await sql`ALTER TABLE users DROP CONSTRAINT IF EXISTS display_name_len`.execute(db);
  await sql`ALTER TABLE users DROP CONSTRAINT IF EXISTS bio_len`.execute(db);
  await sql`
    ALTER TABLE users
      DROP COLUMN IF EXISTS display_name,
      DROP COLUMN IF EXISTS avatar_style,
      DROP COLUMN IF EXISTS avatar_seed,
      DROP COLUMN IF EXISTS bio,
      DROP COLUMN IF EXISTS pending_email,
      DROP COLUMN IF EXISTS pending_email_token_hash,
      DROP COLUMN IF EXISTS pending_email_expires_at`.execute(db);
}
