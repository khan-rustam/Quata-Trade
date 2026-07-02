import type { Kysely } from "kysely";
import { newId } from "../../src/common/ids";
import type { Database } from "../../src/db/types";

let seq = 0;

/** Insert a minimal user row and return its id. */
export async function createUser(db: Kysely<Database>, overrides: Partial<{ email: string }> = {}): Promise<string> {
  const id = newId();
  seq += 1;
  await db
    .insertInto("users")
    .values({
      id,
      email: overrides.email ?? `user${seq}-${id.slice(0, 8)}@test.local`,
      password_hash: "x", // never used in these tests
      phone: null,
      pin_hash: null,
      first_name: null,
      last_name: null,
      totp_secret_enc: null,
    })
    .execute();
  return id;
}

export async function createAdmin(db: Kysely<Database>, role: Database["admins"]["role"]): Promise<string> {
  const id = newId();
  seq += 1;
  await db
    .insertInto("admins")
    .values({
      id,
      email: `admin${seq}-${id.slice(0, 8)}@test.local`,
      password_hash: "x",
      role,
      totp_secret_enc: Buffer.from("test"),
    })
    .execute();
  return id;
}
