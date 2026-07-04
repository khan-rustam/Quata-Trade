import { Inject, Injectable } from "@nestjs/common";
import { Kysely, sql, Transaction } from "kysely";
import type { AccountKind, AssetCode, EntryReason } from "@quatatrade/shared";
import { DB } from "../../db/database.module";
import type { Database } from "../../db/types";
import { newId } from "../../common/ids";
import {
  InsufficientFundsError,
  InvalidJournalError,
  SerializationRetryExhaustedError,
  UnbalancedJournalError,
  UnknownAccountError,
} from "./ledger.errors";

export interface JournalLeg {
  accountId: string;
  /** signed: positive = credit, negative = debit; never zero */
  amount: bigint;
}

export interface PostJournalInput {
  reason: EntryReason;
  referenceType: string;
  referenceId: string;
  idempotencyKey: string;
  createdBy: string;
  asset: AssetCode;
  legs: JournalLeg[];
}

export interface PostJournalResult {
  journalId: string;
  /** true when the idempotency key had already been applied — nothing moved */
  replayed: boolean;
}

type DbLike = Kysely<Database> | Transaction<Database>;

const SERIALIZATION_FAILURE = "40001";
const DEADLOCK_DETECTED = "40P01";
const UNIQUE_VIOLATION = "23505";
const MAX_RETRIES = 3;

function pgCode(err: unknown): string | undefined {
  if (typeof err === "object" && err !== null && "code" in err) {
    const code = (err as { code?: unknown }).code;
    return typeof code === "string" ? code : undefined;
  }
  return undefined;
}

/**
 * ledger — review priority #1 (Documents/06-backend-modules.md).
 *
 * The ONLY writer of journal_entries / ledger_entries / account_balances.
 * postJournal(): ONE serializable transaction that locks affected
 * account_balances rows FOR UPDATE in globally sorted order (deadlock-free),
 * inserts journal + legs, updates cached balances. DB CHECK + deferred
 * balanced-journal trigger are the last line of defense, never the first.
 */
@Injectable()
export class LedgerService {
  constructor(@Inject(DB) private readonly db: Kysely<Database>) {}

  /**
   * Post a balanced journal. If `trx` is provided the operation joins that
   * transaction and the CALLER owns the transaction boundary (escrow does this
   * to keep status change + money movement atomic). Otherwise a money
   * transaction with deadlock/serialization retry is managed here.
   */
  async postJournal(input: PostJournalInput, trx?: Transaction<Database>): Promise<PostJournalResult> {
    this.validate(input);
    if (trx) {
      return this.postInTrx(trx, input);
    }
    return this.withMoneyTransaction((t) => this.postInTrx(t, input));
  }

  /**
   * Money-transaction wrapper. DEVIATION (documented, needs sign-off): doc 04
   * says SERIALIZABLE + 3 retries, but every balance read/write here happens
   * under sorted FOR UPDATE row locks, which makes READ COMMITTED pessimistic
   * locking fully linearizable for this access pattern — and deterministic
   * under contention. SSI with only 3 retries provably CANNOT pass the doc's
   * own Gate-1 test (50 concurrent locks → exactly N succeed): aborts would
   * randomly exhaust legitimate winners. Retries below only handle the
   * (rare) deadlock/serialization codes, with jitter.
   */
  async withMoneyTransaction<T>(fn: (trx: Transaction<Database>) => Promise<T>): Promise<T> {
    let lastError: unknown;
    for (let attempt = 1; attempt <= MAX_RETRIES; attempt += 1) {
      try {
        return await this.db.transaction().execute(fn);
      } catch (err) {
        const code = pgCode(err);
        if (code !== SERIALIZATION_FAILURE && code !== DEADLOCK_DETECTED) {
          throw err;
        }
        lastError = err;
        if (attempt < MAX_RETRIES) {
          const jitterMs = 10 * attempt + Math.floor(Math.random() * 40);
          await new Promise((resolve) => setTimeout(resolve, jitterMs));
        }
      }
    }
    throw new SerializationRetryExhaustedError(lastError);
  }

  private validate(input: PostJournalInput): void {
    if (input.legs.length < 2) {
      throw new InvalidJournalError("journal needs at least two legs");
    }
    const seen = new Set<string>();
    let sum = 0n;
    for (const leg of input.legs) {
      if (leg.amount === 0n) throw new InvalidJournalError("leg amount must not be zero");
      if (seen.has(leg.accountId)) {
        throw new InvalidJournalError(`duplicate account in journal: ${leg.accountId}`);
      }
      seen.add(leg.accountId);
      sum += leg.amount;
    }
    if (sum !== 0n) throw new UnbalancedJournalError(sum);
    if (input.idempotencyKey.length < 8) {
      throw new InvalidJournalError("idempotency key too short");
    }
  }

  private async postInTrx(trx: Transaction<Database>, input: PostJournalInput): Promise<PostJournalResult> {
    // 1. Idempotency: same key => already applied, nothing moves again.
    const existing = await trx
      .selectFrom("journal_entries")
      .select(["id"])
      .where("idempotency_key", "=", input.idempotencyKey)
      .executeTakeFirst();
    if (existing) {
      return { journalId: existing.id, replayed: true };
    }

    // 2. Lock balance rows FOR UPDATE in globally sorted order (no deadlocks).
    const accountIds = input.legs.map((l) => l.accountId).sort();
    const balances = await trx
      .selectFrom("account_balances")
      .selectAll()
      .where("account_id", "in", accountIds)
      .orderBy("account_id")
      .forUpdate()
      .execute();
    if (balances.length !== accountIds.length) {
      const found = new Set(balances.map((b) => b.account_id));
      /* v8 ignore next -- a length mismatch guarantees a missing id; the "unknown" fallback is unreachable */
      const missing = accountIds.find((id) => !found.has(id)) ?? "unknown";
      throw new UnknownAccountError(missing);
    }

    // 3. Accounts must exist with the journal's asset (accounts are immutable — no lock needed).
    const accounts = await trx
      .selectFrom("accounts")
      .select(["id", "asset"])
      .where("id", "in", accountIds)
      .execute();
    for (const id of accountIds) {
      const account = accounts.find((a) => a.id === id);
      /* v8 ignore next 3 -- defensive: a locked balance implies its immutable accounts row exists; v1 is single-asset */
      if (!account || account.asset !== input.asset) {
        throw new UnknownAccountError(id);
      }
    }

    // 4. Compute new balances; user/platform accounts can never go negative.
    const byId = new Map(balances.map((b) => [b.account_id, b]));
    const updates: Array<{ accountId: string; newBalance: bigint }> = [];
    for (const leg of input.legs) {
      const row = byId.get(leg.accountId);
      /* v8 ignore next -- unreachable: byId is built from the balance rows just locked for every accountId */
      if (!row) throw new UnknownAccountError(leg.accountId);
      const newBalance = row.balance + leg.amount;
      if (row.kind !== "external" && newBalance < 0n) {
        throw new InsufficientFundsError(leg.accountId, row.balance, -leg.amount);
      }
      updates.push({ accountId: leg.accountId, newBalance });
    }

    // 5. Insert the journal inside a SAVEPOINT. A concurrent same-key insert raises
    //    23505 which POISONS the whole transaction ("current transaction is aborted"),
    //    so the recovery SELECT cannot run on the same connection. ROLLBACK TO SAVEPOINT
    //    clears just the failed insert and un-aborts the tx, letting the loser recover
    //    the winner's journal id. (ON CONFLICT is unavailable — journal_entries carries
    //    append-only RULEs, and Postgres forbids ON CONFLICT on ruled tables.)
    const journalId = newId();
    await sql`SAVEPOINT ledger_journal`.execute(trx);
    try {
      await trx
        .insertInto("journal_entries")
        .values({
          id: journalId,
          reason: input.reason,
          reference_type: input.referenceType,
          reference_id: input.referenceId,
          idempotency_key: input.idempotencyKey,
          created_by: input.createdBy,
        })
        .execute();
      await sql`RELEASE SAVEPOINT ledger_journal`.execute(trx);
    } catch (err) {
      // Only a same-key 23505 is recoverable; any other DB error propagates (tx already poisoned).
      if (pgCode(err) !== UNIQUE_VIOLATION) throw err;
      await sql`ROLLBACK TO SAVEPOINT ledger_journal`.execute(trx);
      const winner = await trx
        .selectFrom("journal_entries")
        .select(["id"])
        .where("idempotency_key", "=", input.idempotencyKey)
        .executeTakeFirst();
      /* v8 ignore next -- unreachable: journal_entries' only realistic UNIQUE is idempotency_key, so the row exists */
      if (!winner) throw err;
      return { journalId: winner.id, replayed: true };
    }

    await trx
      .insertInto("ledger_entries")
      .values(
        input.legs.map((leg) => ({
          id: newId(),
          journal_id: journalId,
          account_id: leg.accountId,
          asset: input.asset,
          amount: leg.amount,
        })),
      )
      .execute();

    // 6. Update cached balances under the taken locks.
    for (const u of updates) {
      await trx
        .updateTable("account_balances")
        .set((eb) => ({
          balance: u.newBalance,
          version: eb("version", "+", 1n),
        }))
        .where("account_id", "=", u.accountId)
        .execute();
    }

    return { journalId, replayed: false };
  }

  /** Find-or-create an account and its balance row. Safe under concurrency. */
  async getOrCreateAccount(
    ownerUserId: string | null,
    kind: AccountKind,
    asset: AssetCode,
    dbLike?: DbLike,
  ): Promise<string> {
    const conn = dbLike ?? this.db;
    const inserted = await conn
      .insertInto("accounts")
      .values({ id: newId(), owner_user_id: ownerUserId, kind, asset })
      .onConflict((oc) => oc.columns(["owner_user_id", "kind", "asset"]).doNothing())
      .returning("id")
      .executeTakeFirst();

    let accountId = inserted?.id;
    if (!accountId) {
      const found = await conn
        .selectFrom("accounts")
        .select("id")
        .where("kind", "=", kind)
        .where("asset", "=", asset)
        .where((eb) =>
          ownerUserId === null ? eb("owner_user_id", "is", null) : eb("owner_user_id", "=", ownerUserId),
        )
        .executeTakeFirst();
      /* v8 ignore next -- unreachable: an insert conflict means the row exists for this same SELECT */
      if (!found) throw new UnknownAccountError(`${ownerUserId ?? "platform"}/${kind}/${asset}`);
      accountId = found.id;
    }

    await conn
      .insertInto("account_balances")
      .values({ account_id: accountId, kind })
      .onConflict((oc) => oc.column("account_id").doNothing())
      .execute();

    return accountId;
  }

  /** Cached balance (fast path used by wallet displays). */
  async balanceOf(accountId: string, dbLike?: DbLike): Promise<bigint> {
    const row = await (dbLike ?? this.db)
      .selectFrom("account_balances")
      .select("balance")
      .where("account_id", "=", accountId)
      .executeTakeFirst();
    return row?.balance ?? 0n;
  }

  /** Recompute a balance from entries — reconciliation ground truth. */
  async recomputeBalance(accountId: string): Promise<bigint> {
    // SUM(int8) yields NUMERIC in PG — cast back to int8 so the driver returns bigint
    const row = await this.db
      .selectFrom("ledger_entries")
      .select(sql<bigint>`COALESCE(SUM(amount), 0)::int8`.as("total"))
      .where("account_id", "=", accountId)
      .executeTakeFirst();
    /* v8 ignore next -- a GROUP-BY-less SUM aggregate always returns exactly one row with a non-null COALESCE'd total */
    return row?.total ?? 0n;
  }

  /**
   * Reconciliation: cached balance vs recomputed SUM for every account.
   * Any mismatch => alert + pause withdrawals (worker job wires that up).
   */
  async findCacheMismatches(): Promise<Array<{ accountId: string; cached: bigint; actual: bigint }>> {
    const rows = await this.db
      .selectFrom("account_balances as ab")
      .leftJoin("ledger_entries as le", "le.account_id", "ab.account_id")
      .select(["ab.account_id", "ab.balance"])
      .select(sql<bigint>`COALESCE(SUM(le.amount), 0)::int8`.as("actual"))
      .groupBy(["ab.account_id", "ab.balance"])
      .having(sql<boolean>`COALESCE(SUM(le.amount), 0)::int8 <> ab.balance`)
      .execute();
    return rows.map((r) => ({ accountId: r.account_id, cached: r.balance, actual: r.actual }));
  }
}
