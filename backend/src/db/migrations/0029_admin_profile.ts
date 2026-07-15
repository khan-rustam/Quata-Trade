import { sql, type Kysely } from "kysely";

/**
 * Admin self-service profile fields (parity with the user profile). Adds
 * optional display/name/phone + DiceBear avatar (style + seed) to admins so an
 * admin can personalise their own account from /admin/profile. All nullable —
 * existing admins keep working with everything null. No PII beyond what an admin
 * chooses to enter; avatars are generated (no uploads), matching the user side.
 */
export async function up(db: Kysely<unknown>): Promise<void> {
  await sql`
    ALTER TABLE admins
      ADD COLUMN IF NOT EXISTS first_name   text,
      ADD COLUMN IF NOT EXISTS last_name    text,
      ADD COLUMN IF NOT EXISTS display_name text,
      ADD COLUMN IF NOT EXISTS phone        text,
      ADD COLUMN IF NOT EXISTS avatar_style text,
      ADD COLUMN IF NOT EXISTS avatar_seed  text
  `.execute(db);
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await sql`
    ALTER TABLE admins
      DROP COLUMN IF EXISTS first_name,
      DROP COLUMN IF EXISTS last_name,
      DROP COLUMN IF EXISTS display_name,
      DROP COLUMN IF EXISTS phone,
      DROP COLUMN IF EXISTS avatar_style,
      DROP COLUMN IF EXISTS avatar_seed
  `.execute(db);
}
