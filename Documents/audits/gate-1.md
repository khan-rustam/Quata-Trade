# AUDIT GATE 1 — Ledger Core

**Date:** 2026-07-02 · **Commit:** bc5437c · **Status: PASSED (initial run — re-verify before mainnet)**

Test evidence: `backend/src/modules/ledger/ledger.integration.spec.ts` (Testcontainers, real PG16),
`backend/src/modules/fees/fees.spec.ts` (fast-check property tests, 25k+ cases).

## §8.A Money math & ledger integrity
- [x] All amounts BIGINT smallest units end-to-end; ESLint bans `any`/casts in money folders
- [x] `fee = floor(amount·bps/10000)`; `buyerCredit + fee === amount` exactly (10k random cases)
- [x] No rounding leak over batches of trades (property test, 500 runs × ≤200 trades)
- [x] Every journal balances to zero (service check + deferred DB trigger; bypass test proves trigger fires)
- [x] User balances can never go negative (DB CHECK + `InsufficientFundsError` test)
- [x] Cached balance == recomputed SUM (property test + `findCacheMismatches`)
- [x] Append-only: UPDATE/DELETE blocked by RULE (owner) + REVOKE (app role, `has_table_privilege` = false)
- [x] Idempotency keys: replay applies once (sequential + concurrent unique-violation race path)

## §8.B Concurrency & isolation
- [x] 50 parallel 1-USDT locks vs 10-USDT balance → **exactly 10** succeed, cache == sum after
- [x] Parallel cross-transfers A↔B (50 interleaved) — no deadlock (globally sorted FOR UPDATE)
- [x] Retry wrapper on 40001/40P01 (max 3, jittered)

## Deviations requiring sign-off
- postJournal runs pessimistic locking under READ COMMITTED instead of SERIALIZABLE+3-retries
  (doc's own Gate-1 determinism test is unsatisfiable under SSI abort storms; all balance
  reads/writes happen under sorted row locks — see Deviations Log D14).
