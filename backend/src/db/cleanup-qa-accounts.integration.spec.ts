import { readFileSync } from "node:fs";
import { join } from "node:path";
import { CompiledQuery } from "kysely";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { startTestDb, type TestDb } from "../../test/helpers/pg";
import { createUser } from "../../test/helpers/fixtures";
import { newId } from "../common/ids";

const SCRIPT = join(__dirname, "../../../scripts/cleanup-qa-signup-accounts.sql");

/**
 * Validates scripts/cleanup-qa-signup-accounts.sql against a real PG16 running
 * the real migrations, because that script is a DELETE aimed at PRODUCTION and
 * the standing rule is that destructive operations are not run untested.
 *
 * Two properties matter, and neither is obvious by reading the SQL:
 *   1. it removes never-transacted probe accounts along with their dependent rows;
 *   2. its guard ABORTS the whole transaction if any matching account has money,
 *      trade or KYC history — so a real account that happens to match the pattern
 *      survives untouched.
 */
describe("cleanup-qa-signup-accounts.sql", () => {
  let t: TestDb;

  beforeAll(async () => {
    t = await startTestDb();
  }, 180_000);

  afterAll(async () => {
    await t?.stop();
  });

  /**
   * Run the script body for real (the shipped file ends in ROLLBACK by design).
   *
   * On the guard's RAISE EXCEPTION the transaction is left open-and-aborted, so
   * the pooled connection must be reset before the assertions can query. Under
   * `psql -v ON_ERROR_STOP=1` psql exits instead, which closes the connection and
   * rolls back implicitly — same outcome, different mechanism.
   */
  const runScript = async (): Promise<void> => {
    // EXACTLY the transformation the documented apply step performs, so this
    // test exercises the command an operator actually types:
    //   sed 's/^ROLLBACK;.*/COMMIT;/' file | sudo -u postgres psql …
    const sqlText = readFileSync(SCRIPT, "utf8").replace(/^ROLLBACK;.*$/m, "COMMIT;");
    try {
      await t.db.executeQuery(CompiledQuery.raw(sqlText));
    } finally {
      await t.db.executeQuery(CompiledQuery.raw("ROLLBACK")).catch(() => undefined);
    }
  };

  const seedProbe = async (suffix: string): Promise<string> =>
    createUser(t.db, { email: `qa-signup-check-${suffix}@test.local` });

  it("deletes never-transacted probe accounts and their dependent rows", async () => {
    const probe = await seedProbe("clean-1");
    const keeper = await createUser(t.db, { email: "real-customer@test.local" });

    // The rows a fresh registration actually creates.
    await t.db
      .insertInto("auth_tokens")
      .values({
        id: newId(),
        user_id: probe,
        kind: "email_otp",
        token_hash: "deadbeef",
        expires_at: new Date(Date.now() + 900_000),
      })
      .execute();
    await t.db
      .insertInto("notifications")
      .values({
        id: newId(),
        user_id: probe,
        channel: "email",
        template: "email_verify",
        payload: JSON.stringify({ code: "000000" }),
      })
      .execute();

    await runScript();

    const users = await t.db.selectFrom("users").select("id").execute();
    const ids = users.map((u) => u.id);
    expect(ids).not.toContain(probe);
    expect(ids).toContain(keeper); // a non-matching account is untouched

    const tokens = await t.db.selectFrom("auth_tokens").select("id").where("user_id", "=", probe).execute();
    const notes = await t.db.selectFrom("notifications").select("id").where("user_id", "=", probe).execute();
    expect(tokens).toHaveLength(0);
    expect(notes).toHaveLength(0);
  });

  it("ABORTS and deletes nothing when a matching account has ledger history", async () => {
    const dirty = await seedProbe("has-money");
    const alsoClean = await seedProbe("clean-2");

    // A ledger account is the strongest "this is not a disposable probe" signal.
    await t.db
      .insertInto("accounts")
      .values({
        id: newId(),
        kind: "user_available",
        owner_user_id: dirty,
        asset: "USDT_TRC20",
      })
      .execute();

    await expect(runScript()).rejects.toThrow(/ABORT/);

    // The guard runs before any DELETE, and the failure rolls the tx back, so
    // even the innocent sibling must survive — all-or-nothing is the point.
    const remaining = await t.db
      .selectFrom("users")
      .select("id")
      .where("email", "like", "qa-signup-check-%")
      .execute();
    const ids = remaining.map((u) => u.id);
    expect(ids).toContain(dirty);
    expect(ids).toContain(alsoClean);
  });
});
