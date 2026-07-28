---
name: quatatrade-testing
description: Test strategy and coverage gates for QuataTrade. Use when writing, changing or reviewing ANY test, when a test fails, before merging money-path code, or when asked about coverage, property tests, concurrency tests, Testcontainers or E2E. Triggers on vitest, fast-check, testcontainers, supertest, playwright, coverage, flaky.
---

# QuataTrade Testing Rules

Authority: `Documents/09-testing-and-integration.md` + `Documents/08-security-checklist.md` §H.
Runner is **vitest**; property tests use **fast-check**; DB/queue integration uses
**@testcontainers/postgresql** (needs Docker running).

## Commands

- `pnpm test` — shared + backend unit/property
- `pnpm test:integration` — Testcontainers suite (Docker required)
- `pnpm --filter @quatatrade/backend test:coverage` — coverage report
- `pnpm lint` / `pnpm -r typecheck` — must be green before any "done" claim

## The pyramid and which gate needs which level

| Level | Tool | Gate |
|---|---|---|
| Unit | vitest | all |
| Property (ledger math, fee splits, invariants) | fast-check | 1 |
| Integration DB/queue incl. **concurrency** | Testcontainers | 1, 3, 4 |
| Chain integration | TRON Shasta/Nile, Quickstart | 3 |
| Contract FE↔BE (`schema.parse(res.body)`) | supertest + shared zod | 2–6 |
| API/HTTP incl. auth, RBAC, IDOR | supertest | 2–6 |
| E2E journeys | Playwright | 7 |
| Load / oversell under parallel load | k6 or custom parallel scripts | 1, 4, 7 |

## Money-path rule (non-negotiable)

For anything touching `ledger/ escrow/ fees/ wallet/ withdrawals/ deposits/ trades/`:
**write the failing test first, then implement.** Minimum before merge: unit + property
(where there is math) + integration including a **concurrent** scenario.

**Coverage gate: 100% branch on `ledger/`, `escrow/`, `fees/`; ≥80% backend overall.**
This is a written invariant in `CLAUDE.md`. Do not claim it holds — run
`test:coverage` and read the number. If it does not hold, either close the gap or
amend the rule with a Deviations Log entry. An unverified written invariant is worse
than no invariant, because it stops people looking.

## The scenarios that must exist (§09 checklist — verify, don't assume)

- **Ledger/fees (property):** random op sequences keep every journal summing to 0n and
  all user balances ≥ 0; `buyerCredit + fee === amount` exactly across thousands of
  cases and both bps; no rounding leak over 10k trades; replay by idempotency key
  applies once.
- **Concurrency (real parallel connections, not `Promise.all` on one pool):**
  50 concurrent escrow locks against a balance good for 10 → exactly 10 succeed.
  Ten 20-unit trades on an offer with `remaining=100` → exactly 5 succeed.
  Confirm-vs-expiry race → exactly one terminal state, funds move once.
  Overlapping deposit scanner runs → each `(tx_hash, log_index)` credited once.
- **Escrow FSM:** every legal transition passes; **every illegal pair** is rejected by
  the DB trigger; no release while `DISPUTED` via every entry point; forced mid-release
  failure leaves neither a ledger change nor an event row.
- **Auth/RBAC/IDOR:** each role × each protected action, allow **and** deny; cross-user
  access to another user's trade/wallet/withdrawal/message returns 403/404 and leaks
  nothing in the body.
- **Signer refusal:** tests simulate a *compromised API* sending a non-APPROVED,
  over-cap, or blacklisted-destination request — the signer must refuse anyway.
- **Uploads:** SVG rejected, oversized rejected, EXIF stripped, EICAR caught by ClamAV,
  presigned URL expires.

## NEVER do

- NEVER write the implementation first on a money path, then backfill tests.
- NEVER weaken an assertion, widen a tolerance, or add a retry to make a money test
  pass. A flaky concurrency test is usually reporting a real race.
- NEVER mock the ledger, the DB trigger, or the FSM in a test that claims to verify
  them — those tests must hit real Postgres via Testcontainers.
- NEVER use `UPDATE`/`DELETE` on ledger tables as a test shortcut, even in fixtures.
- NEVER point an integration test at a shared/staging DB, and never at mainnet.
- NEVER commit `.only`, `.skip` or a commented-out money-path test.
- NEVER claim "tests pass" without pasting the actual command output.
