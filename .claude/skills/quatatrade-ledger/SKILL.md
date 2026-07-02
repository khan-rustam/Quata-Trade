---
name: quatatrade-ledger
description: Money/ledger discipline for QuataTrade. Use BEFORE touching anything in backend/src/modules/ledger, fees, or any code that moves, computes, or stores monetary amounts (deposits, withdrawals, escrow legs, balances, fee math). Also triggers on words like postJournal, balance, BIGINT, fee split, idempotency key.
---

# QuataTrade Ledger Rules

Full spec: `Documents/04-database-schema.md` §4.2/§4.8 and `Documents/08-security-checklist.md` §A/§B.
The implementation lives in `backend/src/modules/ledger/ledger.service.ts` — read it before changing anything.

## The contract

- The ledger is **append-only double-entry**. `journal_entries` + `ledger_entries` are immutable
  (DB RULEs + REVOKE). `account_balances` is a cache, written ONLY by `LedgerService.postJournal()`
  in the same transaction as the legs.
- Every economic event = ONE journal whose legs **sum to exactly 0n**. Signed bigint legs:
  positive = credit, negative = debit.
- Every money movement carries an **idempotency key** (unique in `journal_entries`). Replay
  returns the original journal id and moves nothing.
- Balance reads for money decisions happen **under sorted `FOR UPDATE` row locks** via
  `withMoneyTransaction()`. Lock order is global: trade row → offer row → balance rows
  (balances sorted by account_id). Never lock an offer after balances.
- `external` is the only account kind allowed to go negative (chain-facing contra account).
  User/platform accounts are DB-CHECK non-negative.

## Money math

- Amounts: `bigint` smallest units (USDT-TRC20: 1 USDT = 1_000_000). Wire format: decimal strings.
- ALL fee math goes through `backend/src/modules/fees/fees.ts` pure functions:
  `computeFee`, `split` (invariant `buyerCredit + fee === amount`), `fiatValueXaf`.
- `decimal.js` exists ONLY in `shared/src/money.ts` for display conversion.

## NEVER do

- NEVER use `number`, `parseFloat`, or float literals for any amount. No `Number(amount)`.
- NEVER `UPDATE`/`DELETE` on `ledger_entries`, `journal_entries`, `account_balances` outside
  `LedgerService` — not in migrations, not in tests-as-shortcuts, not in admin tools.
- NEVER write a journal with unbalanced legs, zero legs, or a duplicated account.
- NEVER skip the idempotency key or reuse one across different economic events.
- NEVER call `postJournal` outside `withMoneyTransaction`/caller-owned trx when combining
  it with other state changes — status + money must commit or roll back together.
- NEVER add a new `entry_reason` or `account_kind` without a migration + Deviations Log entry.

## Tests-first (non-negotiable)

Any change here requires: failing test first → implementation → property tests for math
(fast-check) → a concurrency test if locking changed → 100% branch coverage on `ledger/` + `fees/`.
Run: `pnpm --filter @quatatrade/backend test:integration` (needs Docker).
Gate record: `Documents/audits/gate-1.md`.
