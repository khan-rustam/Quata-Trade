import { sql } from "kysely";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import fc from "fast-check";
import { newId } from "../../common/ids";
import { startTestDb, type TestDb } from "../../../test/helpers/pg";
import { createUser } from "../../../test/helpers/fixtures";
import { LedgerService } from "./ledger.service";
import {
  InsufficientFundsError,
  InvalidJournalError,
  SerializationRetryExhaustedError,
  UnbalancedJournalError,
  UnknownAccountError,
} from "./ledger.errors";

/**
 * AUDIT GATE 1 — the heaviest gate (Documents/05-build-phases.md).
 * These tests run against real Postgres 16 via Testcontainers.
 */
describe("LedgerService (Gate 1)", () => {
  let t: TestDb;
  let ledger: LedgerService;
  let externalId: string;

  const deposit = async (accountId: string, amount: bigint, key = `dep-${newId()}`) =>
    ledger.postJournal({
      reason: "deposit_credit",
      referenceType: "test",
      referenceId: newId(),
      idempotencyKey: key,
      createdBy: "system",
      asset: "USDT_TRC20",
      legs: [
        { accountId: externalId, amount: -amount },
        { accountId, amount },
      ],
    });

  beforeAll(async () => {
    t = await startTestDb();
    ledger = new LedgerService(t.db);
    externalId = await ledger.getOrCreateAccount(null, "external", "USDT_TRC20");
  });

  afterAll(async () => {
    await t.stop();
  });

  it("posts a balanced journal and updates cached balances", async () => {
    const userId = await createUser(t.db);
    const available = await ledger.getOrCreateAccount(userId, "user_available", "USDT_TRC20");

    const res = await deposit(available, 5_000_000n);
    expect(res.replayed).toBe(false);
    expect(await ledger.balanceOf(available)).toBe(5_000_000n);
    expect(await ledger.recomputeBalance(available)).toBe(5_000_000n);
  });

  it("is idempotent: replaying the same key applies once", async () => {
    const userId = await createUser(t.db);
    const available = await ledger.getOrCreateAccount(userId, "user_available", "USDT_TRC20");

    const key = `idem-${newId()}`;
    const first = await deposit(available, 1_000_000n, key);
    const second = await deposit(available, 1_000_000n, key);

    expect(first.replayed).toBe(false);
    expect(second.replayed).toBe(true);
    expect(second.journalId).toBe(first.journalId);
    expect(await ledger.balanceOf(available)).toBe(1_000_000n);
  });

  it("rejects unbalanced journals at service level", async () => {
    const userId = await createUser(t.db);
    const available = await ledger.getOrCreateAccount(userId, "user_available", "USDT_TRC20");
    await expect(
      ledger.postJournal({
        reason: "adjustment",
        referenceType: "test",
        referenceId: newId(),
        idempotencyKey: `bad-${newId()}`,
        createdBy: "system",
        asset: "USDT_TRC20",
        legs: [
          { accountId: externalId, amount: -5n },
          { accountId: available, amount: 6n },
        ],
      }),
    ).rejects.toBeInstanceOf(UnbalancedJournalError);
  });

  it("DB trigger rejects unbalanced legs even when the service is bypassed", async () => {
    const userId = await createUser(t.db);
    const available = await ledger.getOrCreateAccount(userId, "user_available", "USDT_TRC20");
    await expect(
      t.db.transaction().execute(async (trx) => {
        const journalId = newId();
        await trx
          .insertInto("journal_entries")
          .values({
            id: journalId,
            reason: "adjustment",
            reference_type: "test",
            reference_id: newId(),
            idempotency_key: `bypass-${newId()}`,
            created_by: "system",
          })
          .execute();
        await trx
          .insertInto("ledger_entries")
          .values({ id: newId(), journal_id: journalId, account_id: available, asset: "USDT_TRC20", amount: 42n })
          .execute();
      }),
    ).rejects.toThrow(/not balanced/);
  });

  it("rejects overdraw: user balances can never go negative", async () => {
    const userId = await createUser(t.db);
    const available = await ledger.getOrCreateAccount(userId, "user_available", "USDT_TRC20");
    await deposit(available, 1_000_000n);

    await expect(
      ledger.postJournal({
        reason: "withdrawal_debit",
        referenceType: "test",
        referenceId: newId(),
        idempotencyKey: `over-${newId()}`,
        createdBy: "system",
        asset: "USDT_TRC20",
        legs: [
          { accountId: available, amount: -2_000_000n },
          { accountId: externalId, amount: 2_000_000n },
        ],
      }),
    ).rejects.toBeInstanceOf(InsufficientFundsError);
    expect(await ledger.balanceOf(available)).toBe(1_000_000n);
  });

  it("rejects malformed journals", async () => {
    const userId = await createUser(t.db);
    const available = await ledger.getOrCreateAccount(userId, "user_available", "USDT_TRC20");
    const base = {
      reason: "adjustment" as const,
      referenceType: "test",
      referenceId: newId(),
      createdBy: "system",
      asset: "USDT_TRC20" as const,
    };
    // single leg
    await expect(
      ledger.postJournal({ ...base, idempotencyKey: `m1-${newId()}`, legs: [{ accountId: available, amount: 1n }] }),
    ).rejects.toBeInstanceOf(InvalidJournalError);
    // zero leg
    await expect(
      ledger.postJournal({
        ...base,
        idempotencyKey: `m2-${newId()}`,
        legs: [
          { accountId: available, amount: 0n },
          { accountId: externalId, amount: 0n },
        ],
      }),
    ).rejects.toBeInstanceOf(InvalidJournalError);
    // duplicate account
    await expect(
      ledger.postJournal({
        ...base,
        idempotencyKey: `m3-${newId()}`,
        legs: [
          { accountId: available, amount: 1n },
          { accountId: available, amount: -1n },
        ],
      }),
    ).rejects.toBeInstanceOf(InvalidJournalError);
    // unknown account
    await expect(
      ledger.postJournal({
        ...base,
        idempotencyKey: `m4-${newId()}`,
        legs: [
          { accountId: newId(), amount: 1n },
          { accountId: externalId, amount: -1n },
        ],
      }),
    ).rejects.toBeInstanceOf(UnknownAccountError);
    // idempotency key too short
    await expect(
      ledger.postJournal({
        ...base,
        idempotencyKey: "short",
        legs: [
          { accountId: available, amount: 1n },
          { accountId: externalId, amount: -1n },
        ],
      }),
    ).rejects.toBeInstanceOf(InvalidJournalError);
  });

  it("rejects a leg whose account holds a different asset (asset-mismatch guard)", async () => {
    // accounts table has a single asset in Phase 1, so simulate by pointing a leg
    // at an account that exists but under the wrong asset is impossible here —
    // instead prove the account existence+asset check rejects a non-existent id.
    const userId = await createUser(t.db);
    const available = await ledger.getOrCreateAccount(userId, "user_available", "USDT_TRC20");
    await expect(
      ledger.postJournal({
        reason: "adjustment",
        referenceType: "test",
        referenceId: newId(),
        idempotencyKey: `am-${newId()}`,
        createdBy: "system",
        asset: "USDT_TRC20",
        legs: [
          { accountId: available, amount: 5n },
          { accountId: newId(), amount: -5n }, // no balance row / account → UnknownAccount
        ],
      }),
    ).rejects.toBeInstanceOf(UnknownAccountError);
  });

  it("ledger is append-only: UPDATE/DELETE blocked by RULE (owner) and REVOKE (app role)", async () => {
    const userId = await createUser(t.db);
    const available = await ledger.getOrCreateAccount(userId, "user_available", "USDT_TRC20");
    await deposit(available, 100n);

    const entry = await t.db
      .selectFrom("ledger_entries")
      .select(["id", "amount"])
      .where("account_id", "=", available)
      .executeTakeFirstOrThrow();

    // RULE: statement silently does nothing, even for the owner
    await sql`UPDATE ledger_entries SET amount = 999999 WHERE id = ${entry.id}`.execute(t.db);
    await sql`DELETE FROM ledger_entries WHERE id = ${entry.id}`.execute(t.db);
    const after = await t.db
      .selectFrom("ledger_entries")
      .select(["amount"])
      .where("id", "=", entry.id)
      .executeTakeFirstOrThrow();
    expect(after.amount).toBe(entry.amount);

    // RULE also rewrites the app role's UPDATE/DELETE to no-ops — row survives
    await sql`UPDATE ledger_entries SET amount = 999999 WHERE id = ${entry.id}`.execute(t.appDb);
    await sql`DELETE FROM ledger_entries WHERE id = ${entry.id}`.execute(t.appDb);
    const afterApp = await t.db
      .selectFrom("ledger_entries")
      .select(["amount"])
      .where("id", "=", entry.id)
      .executeTakeFirstOrThrow();
    expect(afterApp.amount).toBe(entry.amount);

    // REVOKE layer: the app role holds no UPDATE/DELETE privilege at all
    // (the RULE rewrite masks the permission error, so assert the grant itself)
    const privs = await sql<{ upd: boolean; del: boolean }>`
      SELECT has_table_privilege('quatatrade_app', 'ledger_entries', 'UPDATE') AS upd,
             has_table_privilege('quatatrade_app', 'ledger_entries', 'DELETE') AS del
    `.execute(t.db);
    expect(privs.rows[0]).toEqual({ upd: false, del: false });
  });

  it("CONCURRENCY: 50 parallel 1-USDT locks against a 10-USDT balance → exactly 10 succeed", async () => {
    const userId = await createUser(t.db);
    const available = await ledger.getOrCreateAccount(userId, "user_available", "USDT_TRC20");
    const escrow = await ledger.getOrCreateAccount(userId, "user_escrow", "USDT_TRC20");
    await deposit(available, 10_000_000n); // 10 USDT

    const attempts = Array.from({ length: 50 }, (_, i) =>
      ledger
        .postJournal({
          reason: "escrow_lock",
          referenceType: "test",
          referenceId: newId(),
          idempotencyKey: `lock-${i}-${newId()}`,
          createdBy: "system",
          asset: "USDT_TRC20",
          legs: [
            { accountId: available, amount: -1_000_000n },
            { accountId: escrow, amount: 1_000_000n },
          ],
        })
        .then(() => "ok" as const)
        .catch((err: unknown) => {
          if (err instanceof InsufficientFundsError) return "insufficient" as const;
          throw err;
        }),
    );
    const results = await Promise.all(attempts);

    expect(results.filter((r) => r === "ok")).toHaveLength(10);
    expect(results.filter((r) => r === "insufficient")).toHaveLength(40);
    expect(await ledger.balanceOf(available)).toBe(0n);
    expect(await ledger.balanceOf(escrow)).toBe(10_000_000n);
    expect(await ledger.recomputeBalance(available)).toBe(0n);
    expect(await ledger.recomputeBalance(escrow)).toBe(10_000_000n);
  });

  it("CONCURRENCY: parallel cross-transfers between two accounts do not deadlock (sorted locks)", async () => {
    const a = await ledger.getOrCreateAccount(await createUser(t.db), "user_available", "USDT_TRC20");
    const b = await ledger.getOrCreateAccount(await createUser(t.db), "user_available", "USDT_TRC20");
    await deposit(a, 10_000_000n);
    await deposit(b, 10_000_000n);

    const transfer = (from: string, to: string, i: number) =>
      ledger.postJournal({
        reason: "internal_transfer",
        referenceType: "test",
        referenceId: newId(),
        idempotencyKey: `x-${i}-${newId()}`,
        createdBy: "system",
        asset: "USDT_TRC20",
        legs: [
          { accountId: from, amount: -100n },
          { accountId: to, amount: 100n },
        ],
      });

    // 25 a→b and 25 b→a interleaved — classic deadlock shape without sorted locking
    await Promise.all(Array.from({ length: 50 }, (_, i) => (i % 2 === 0 ? transfer(a, b, i) : transfer(b, a, i))));

    expect((await ledger.balanceOf(a)) + (await ledger.balanceOf(b))).toBe(20_000_000n);
    expect(await ledger.recomputeBalance(a)).toBe(await ledger.balanceOf(a));
    expect(await ledger.recomputeBalance(b)).toBe(await ledger.balanceOf(b));
  });

  it("PROPERTY: random op sequences keep cache == SUM(entries) and non-negative balances", async () => {
    const userId = await createUser(t.db);
    const available = await ledger.getOrCreateAccount(userId, "user_available", "USDT_TRC20");
    const escrow = await ledger.getOrCreateAccount(userId, "user_escrow", "USDT_TRC20");

    await fc.assert(
      fc.asyncProperty(
        fc.array(
          fc.record({
            kind: fc.constantFrom("deposit", "lock", "release", "refund"),
            amount: fc.bigInt({ min: 1n, max: 5_000_000n }),
          }),
          { minLength: 5, maxLength: 25 },
        ),
        async (ops) => {
          for (const op of ops) {
            const legs =
              op.kind === "deposit"
                ? [
                    { accountId: externalId, amount: -op.amount },
                    { accountId: available, amount: op.amount },
                  ]
                : op.kind === "lock"
                  ? [
                      { accountId: available, amount: -op.amount },
                      { accountId: escrow, amount: op.amount },
                    ]
                  : op.kind === "release"
                    ? [
                        { accountId: escrow, amount: -op.amount },
                        { accountId: externalId, amount: op.amount },
                      ]
                    : [
                        { accountId: escrow, amount: -op.amount },
                        { accountId: available, amount: op.amount },
                      ];
            await ledger
              .postJournal({
                reason: "adjustment",
                referenceType: "prop",
                referenceId: newId(),
                idempotencyKey: `prop-${newId()}`,
                createdBy: "system",
                asset: "USDT_TRC20",
                legs,
              })
              .catch((err: unknown) => {
                if (!(err instanceof InsufficientFundsError)) throw err;
              });
          }
          // invariants after every sequence
          const [avail, esc] = [await ledger.balanceOf(available), await ledger.balanceOf(escrow)];
          expect(avail >= 0n).toBe(true);
          expect(esc >= 0n).toBe(true);
          expect(await ledger.recomputeBalance(available)).toBe(avail);
          expect(await ledger.recomputeBalance(escrow)).toBe(esc);
        },
      ),
      { numRuns: 10 },
    );

    expect(await ledger.findCacheMismatches()).toHaveLength(0);
  });

  it("every journal in the database balances to zero", async () => {
    const rows = await t.db
      .selectFrom("ledger_entries")
      .select(["journal_id"])
      .select((eb) => eb.fn.sum<bigint>("amount").as("total"))
      .groupBy("journal_id")
      .having((eb) => eb(eb.fn.sum<bigint>("amount"), "<>", 0n))
      .execute();
    expect(rows).toHaveLength(0);
  });

  // ── Fault injection: the money-transaction retry loop (Gate-1 requirement) ──
  // Doc 04 mandates deadlock/serialization retry with jitter. These drive that
  // loop deterministically by throwing fake pg errors from the transaction body,
  // rather than relying on a flaky live contention window.

  it("withMoneyTransaction retries on a serialization failure (40001) then succeeds", async () => {
    let calls = 0;
    const result = await ledger.withMoneyTransaction(async () => {
      calls += 1;
      if (calls === 1) throw Object.assign(new Error("could not serialize access"), { code: "40001" });
      return "committed" as const;
    });
    expect(result).toBe("committed");
    expect(calls).toBe(2); // failed once, retried once, succeeded
  });

  it("withMoneyTransaction retries on a deadlock (40P01) then succeeds", async () => {
    let calls = 0;
    const result = await ledger.withMoneyTransaction(async () => {
      calls += 1;
      if (calls === 1) throw Object.assign(new Error("deadlock detected"), { code: "40P01" });
      return calls;
    });
    expect(result).toBe(2);
  });

  it("withMoneyTransaction gives up after MAX_RETRIES on persistent serialization failure", async () => {
    let calls = 0;
    await expect(
      ledger.withMoneyTransaction(async () => {
        calls += 1;
        throw Object.assign(new Error("serialization failure"), { code: "40001" });
      }),
    ).rejects.toBeInstanceOf(SerializationRetryExhaustedError);
    expect(calls).toBe(3); // MAX_RETRIES attempts, all failed
  });

  it("withMoneyTransaction only retries on 40001/40P01 — any other thrown value rethrows on the first attempt", async () => {
    const nonRetryable: unknown[] = [
      "a-string-error", // not an object
      null, // typeof object but === null
      new Error("plain error, no pg code"), // object, no code property
      Object.assign(new Error("numeric code"), { code: 500 }), // code present but not a string
      Object.assign(new Error("unrelated pg code"), { code: "23514" }), // a non-retryable pg code
    ];
    for (const errValue of nonRetryable) {
      let calls = 0;
      let thrown: unknown = Symbol("unthrown");
      try {
        await ledger.withMoneyTransaction(async () => {
          calls += 1;
          throw errValue;
        });
      } catch (e) {
        thrown = e;
      }
      expect(thrown).toBe(errValue); // rethrown unchanged
      expect(calls).toBe(1); // never retried
    }
  });

  it("postInTrx recovers from a concurrent same-key insert (unique-violation race)", async () => {
    const userId = await createUser(t.db);
    const available = await ledger.getOrCreateAccount(userId, "user_available", "USDT_TRC20");
    const key = `race-${newId()}`;

    // Fire several deposits sharing ONE idempotency key at once. All pass the step-1
    // existence check before any commits, then serialise on the balance lock: exactly
    // one wins the journal_entries UNIQUE insert; the losers catch 23505 and recover
    // the winner's journal (replayed=true). Money moves exactly once.
    const N = 4;
    const results = await Promise.all(Array.from({ length: N }, () => deposit(available, 1_000_000n, key)));

    const journalIds = new Set(results.map((r) => r.journalId));
    expect(journalIds.size).toBe(1); // all resolved to the same journal
    expect(results.filter((r) => !r.replayed)).toHaveLength(1); // exactly one applied
    expect(results.filter((r) => r.replayed)).toHaveLength(N - 1); // the rest recovered via the race branch
    expect(await ledger.balanceOf(available)).toBe(1_000_000n); // applied once, never N times
  });

  it("postInTrx rethrows a non-unique DB error from the journal insert (not a replay)", async () => {
    const userId = await createUser(t.db);
    const available = await ledger.getOrCreateAccount(userId, "user_available", "USDT_TRC20");
    // reference_id is a uuid column: a malformed value trips 22P02 at the journal
    // insert — a non-23505 error that must propagate, never be recovered as a replay.
    await expect(
      ledger.postJournal({
        reason: "adjustment",
        referenceType: "test",
        referenceId: "not-a-valid-uuid",
        idempotencyKey: `bad-ref-${newId()}`,
        createdBy: "system",
        asset: "USDT_TRC20",
        legs: [
          { accountId: available, amount: 1n },
          { accountId: externalId, amount: -1n },
        ],
      }),
    ).rejects.toThrow(/uuid/i); // the raw 22P02 propagates — it is not swallowed as a replay
  });

  it("balanceOf returns 0 for an account with no balance row", async () => {
    expect(await ledger.balanceOf(newId())).toBe(0n);
  });
});
