/**
 * seed-admin — INITIAL SETUP ONLY. Creates one SUPER_ADMIN.
 *
 * Run from backend/:
 *   npx tsx src/modules/admin/seed-admin.ts --email admin@example.com --password 'Str0ngPassword!'
 * or via env: SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD.
 * Required env: DATABASE_URL, MASTER_ENCRYPTION_KEY (32 bytes base64).
 *
 * The admin is created WITHOUT 2FA — they log in with email + password and can
 * enable TOTP later from their profile. Refuses to overwrite an existing email.
 */
import * as argon2 from "argon2";
import { zEmail, zPassword } from "@quatatrade/shared";
import { createDb } from "../../db/database.module";
import { newId } from "../../common/ids";
import { AuditService } from "../../common/audit/audit.service";

function argValue(flag: string): string | undefined {
  const index = process.argv.indexOf(flag);
  if (index === -1) return undefined;
  return process.argv[index + 1];
}

async function main(): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL;
  const masterKey = process.env.MASTER_ENCRYPTION_KEY;
  if (!databaseUrl) throw new Error("DATABASE_URL is required");
  if (!masterKey || Buffer.from(masterKey, "base64").length !== 32) {
    throw new Error("MASTER_ENCRYPTION_KEY must be 32 bytes base64");
  }

  const email = zEmail.parse(argValue("--email") ?? process.env.SEED_ADMIN_EMAIL);
  // full password policy applies to admins too (min 10, upper/lower/digit)
  const password = zPassword.parse(argValue("--password") ?? process.env.SEED_ADMIN_PASSWORD);

  // masterKey is validated above (kept for parity with the app's env contract)
  void masterKey;

  const db = createDb(databaseUrl);
  try {
    const passwordHash = await argon2.hash(password, { type: argon2.argon2id });
    const adminId = newId();

    const inserted = await db
      .insertInto("admins")
      .values({
        id: adminId,
        email,
        password_hash: passwordHash,
        role: "SUPER_ADMIN",
        totp_secret_enc: null,
      })
      .onConflict((oc) => oc.column("email").doNothing())
      .returning("id")
      .executeTakeFirst();

    if (!inserted) {
      // never overwrite, never leak which part matched
      process.stderr.write("seed-admin: an admin with this email already exists — nothing changed\n");
      process.exitCode = 1;
      return;
    }

    await new AuditService(db).log({
      actorType: "system",
      actorId: null,
      action: "admin.seeded",
      targetType: "admin",
      targetId: adminId,
      metadata: { role: "SUPER_ADMIN" },
    });

    process.stdout.write(`SUPER_ADMIN created: ${adminId}\n`);
    process.stdout.write("Log in at /admin/login with your email + password.\n");
    process.stdout.write("You can enable two-factor authentication afterwards from your admin profile.\n");
  } finally {
    await db.destroy();
  }
}

main().catch((err: unknown) => {
  // never echo passwords/secrets — zod/DB errors here contain none
  process.stderr.write(`seed-admin failed: ${err instanceof Error ? err.message : String(err)}\n`);
  process.exitCode = 1;
});
