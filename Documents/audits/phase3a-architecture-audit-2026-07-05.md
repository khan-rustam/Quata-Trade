# Phase 3A — Repository Architecture Audit

**Date:** 2026-07-05 · **Method:** 6 parallel principal-architect readers over the live monorepo (pnpm workspace, backend/frontend/shared) + a scoring synthesis pass, each reading actual files and citing real paths/lines.
**Verdict:** **CONDITIONAL PASS** — advance to launch, with the four high-priority refactors booked as tracked follow-ups before the next money-path gate.

## Scores (calibrated against a professional fintech-monorepo bar, not a typical startup repo)

| Dimension | Score | One-line |
|---|---|---|
| **Architecture** | **70/100** | Load-bearing money invariants verified to hold; debt concentrated in admin/contract boundary erosion |
| **Scalability** | **57/100** | Three architectural ceilings to horizontal scale (singleton worker, in-memory Socket.IO, shared-DB coupling) |
| **Maintainability** | **63/100** | Excellent onboarding/bus-factor for a solo project; dragged down by concrete footguns (triplicated crypto, fragmented money display, half-finished data layer) |

Severity tally: **6 High · 23 Medium · 16 Low · 6 Info.**

## What is genuinely sound (verified, not asserted)

The invariants that actually protect customer money were positively verified by reading the code:
- **`LedgerService.postJournal` is the sole writer** of `journal_entries`/`ledger_entries`/`account_balances`/`accounts` — grep for those inserts outside `ledger/` returns empty.
- **`EscrowService` is the sole mutator** of `trades`/`trade_events`/`trade_transitions` — the only `updateTable("trades")` in production code is at `escrow.service.ts:65`.
- **API vs worker process isolation is correct** — `app.module` excludes `DepositsModule` + `SignerModule`, so the deposit-scan and withdrawal-broadcast pipelines live only in the worker.
- **DI is uniformly singleton** (no `Scope.REQUEST`/`TRANSIENT` leaks); **`common/` is a clean leaf** (no upward imports into `modules/`).
- **The signer is already a real, key-isolated extraction** (interface + env switch + off-box keys) — the cleanest seam in the repo and the template for future splits.
- Onboarding surface (17 numbered design docs, 13 module READMEs, 5 skills, `SIGNER.md`, money-path ESLint bans, centralized zod contract) puts solo-dev bus-factor risk well below the norm.

## High-severity findings (6)

**A-H1 · Feature-module circular dependency: `admin → withdrawals → screening → admin`.**
`screening.controller.ts:11` imports `RBAC` from `../admin/admin.rbac`; `admin` imports `WithdrawalsModule`; `withdrawals.service.ts:21` injects `ScreeningService`. Currently latent only because the pulled symbol is a leaf constant injected via `@Global` — but the three modules cannot be reasoned about, tested, or extracted independently. **Fix (low effort, high value):** relocate the RBAC matrix to `shared/` or `common/authz` (it already imports `ADMIN_ROLES` from shared). That single move deletes the `screening→admin` edge, dissolves the cycle, and removes the spurious `content`/`treasury`/`screening → admin` dependencies.

**A-H2 · `admin.service.ts` is a 999-line god-service reaching 13–16 cross-domain tables directly.** 14 methods spanning ~10 bounded contexts, querying other domains' schemas via the raw DB handle rather than their services. A column change in any domain can silently break admin; it is the least-extractable unit and concentrates bus-factor risk. **Fix:** split into per-domain admin facades (`admin-users`/`admin-trades`/`admin-finance`/`admin-settings`/`admin-audit`) that read through owning-module services — `WithdrawalsAdminService` already models the pattern. Must precede any services split.

**A-H3 · `secret-crypto` (AES-256-GCM for `users.totp_secret_enc`) is triplicated with two stale "does not exist yet" comments.** Three encrypt/decrypt implementations of the same `[iv|tag|ciphertext]` layout operate on the *same* at-rest column: canonical `common/crypto.ts:23`, `withdrawals/secret-crypto.ts:16`, and an inline `decryptTotpSecret()` in `trades.controller.ts:85`. The withdrawals copy **drops the 32-byte key-length check**; two carry false comments that will spawn a fourth copy. They must stay byte-identical forever or 2FA/withdrawal-TOTP silently breaks and locks users out. **Fix (low effort):** delete the two copies, import from `common/crypto.ts` everywhere, prove ciphertext compatibility with the existing `crypto.spec.ts`.

**A-H4 · Worker is a hard singleton SPOF that cannot scale horizontally.** All ~9 crons run in one worker process, overlap-guarded only by in-process `running = false` booleans — no pg advisory lock or leader lease. `outbox-relay` and `email-send` claim rows **without `FOR UPDATE SKIP LOCKED`**, so a second worker would double-send notifications/emails. **Fix before any multi-worker deploy:** advisory-lock/leader-lease each cron; convert claim queries to `SKIP LOCKED` (or adopt the documented BullMQ queues). Not blocking at capped single-node scale — but document the SPOF.

**A-H5 · Shared-database coupling: 23 of 24 modules inject raw Kysely and read/write cross-domain tables directly.** The clean NestJS module graph masks a distributed-monolith at the data layer. `escrow.service` directly SELECTs/UPDATEs `trades` and `offers`; `admin` touches 16 tables. This is the single largest obstacle to the documented plan of extracting `ledger`/`escrow` later. **Fix:** introduce per-context data-access boundaries; forbid modules from querying tables they do not own; start with the crown jewels (route all ledger *reads* through `LedgerService`).

**A-H6 · Realtime chat is pinned to one API instance — no Socket.IO Redis adapter.** `main.ts` never registers a Redis adapter and `@socket.io/redis-adapter` is not a dependency; the REST surface is stateless and would scale, but with 2+ API instances a chat message emitted on instance A never reaches sockets on instance B. **Fix:** wire `@socket.io/redis-adapter` against the existing ioredis client before enabling API cluster mode.

## Notable medium findings (23 total — highlights)

- **Contract enforcement is one-directional and OFF in production.** The typed client `.parse`s every response, but the backend only re-validates its own output when `NODE_ENV !== "production"` (`trades.mapper.ts:23`, `offers.mapper.ts:15`). A drifted/buggy response shape is first caught as a **ZodError in the user's browser**. Worse, the **entire admin surface is typed as `unknown`** (`Paged<unknown>`, `Promise<unknown>`), so neither TS nor runtime verifies admin rows match the shared schemas. **Fix:** keep money-path output validation on in prod (or add controller-output contract tests that fail CI); type admin handlers with shared response types.
- **Contract drift pockets:** KYC upload shape duplicated in backend with *stricter* rules than shared (frontend pre-validation accepts payloads the server rejects); treasury/revenue shapes defined twice with no link; several money-adjacent admin actions parse responses with `zAnyRecord` passthrough (invisible shape). Backend defines local zod schemas in `admin.schemas.ts`/`kyc.schemas.ts`, violating the "schemas live in shared/ only" rule (undocumented deviation).
- **Frontend data layer is leaky/half-finished:** ~23 pages bypass the `hooks/` seam and call the raw `api`/`adminApi` client inline — **money mutations included** (withdraw, transfer, confirm/cancel/dispute in the 511-line trade-room God component). Admin query keys are raw string tuples in 3+ places (typo-driven cache-drift risk). `content-server.ts` fetches with an unchecked `as T` cast, bypassing the zod contract.
- **Root layout `force-dynamic`** disables static generation for the whole tree — including the pure-static marketing/legal pages (the best SEO/perf candidates) — ties into the Phase-1 performance finding.
- **`SettingsService` cache invalidates only the local process** (10s TTL) — kill switches take up to 10s to propagate cross-process; bounded today, unsafe multi-instance.
- **Money display fragmented into 4 overlapping helpers** across shared/frontend, one (`formatRate`) routing money through a **JS float**, violating the no-`number`-past-display rule.
- **Coverage gate is deep but narrow:** 100% enforced on only 3 files (`ledger`/`fees`/`escrow`); money-path `withdrawals`/`deposits`/`wallet`/`trades` and trade-critical `offers`/`settings` have **no enforced floor** and several have no unit specs at all.
- **Implementation diverges from documented BullMQ architecture** — cron-polling + single-consumer `outbox` instead of Redis queues (`bullmq` is a dependency imported nowhere). Undocumented; reconcile in the Deviations Log.

## Notable low/info findings

Supply-chain release-cooldown is a **no-op** (`minimumReleaseAgeExclude` set with no base `minimumReleaseAge`); **shared contract not built on install** (gitignored `dist`, currently stale vs `src` — edits silently validate against the old shape); **`pnpm typecheck` silently skips the frontend** (no `typecheck` script); CI lints backend only (shared/frontend unlinted; shared has no ESLint at all); frontend TS strictness weaker than backend (no `noUncheckedIndexedAccess`); no TS project references / task runner (hand-maintained build order); **duplicate migration prefix `0011_`**; scheduled jobs split across two locations/conventions; **the 4 strictest money-path modules (ledger/escrow/fees/trades) have no README** while lower-risk modules do; escrow is not independently extractable (fused with trades+offers — the real seam is a single "trade-lifecycle" context).

## Top prioritized refactors

| # | Refactor | Effort | Priority | Payoff |
|---|---|---|---|---|
| 1 | Relocate RBAC matrix out of `admin/` into `shared`/`common/authz` | Low | High | Dissolves the module cycle + 3 spurious deps in one move |
| 2 | Consolidate triplicated AES-GCM crypto onto `common/crypto.ts`; delete copies | Low | High | Removes a byte-compatibility trap on a security field |
| 3 | Close contract asymmetry: validate money-path responses in prod; type admin with shared schemas | Medium | High | Drift becomes a compile/CI error, not a browser ZodError |
| 4 | Introduce per-context data-access boundaries; forbid cross-domain SQL | High | High | Prerequisite for the documented ledger/trade-lifecycle extraction |
| 5 | Decompose `admin.service` (999 LOC) into per-domain facades | High | Medium | Must precede any services split |
| 6 | Make shared contract build-deterministic; restore typecheck/lint gates across all 3 packages | Medium | Medium | Prevents silent stale-contract regressions |
| 7 | Make worker + Socket.IO horizontal-scale-safe (advisory locks, `SKIP LOCKED`, Redis adapter) | High | Medium | Hard prerequisite for redundancy/scale-out |
| 8 | Widen coverage floor (≥80% repo-wide) + activate supply-chain cooldown | Medium | Medium | Closes the untested-money-path and dead-config gaps |

## Bottom line

A disciplined modular monolith whose safety-critical core is correct-by-construction and whose debt is **legible and addressable rather than structural rot** — exactly the profile a Phase 3A gate should pass with conditions. Two of the highest-leverage fixes (relocate RBAC, consolidate crypto) are cheap and should not wait. The scalability ceilings do not block the intended capped single-node launch but are named, real, and must not ossify before any multi-instance deploy — and the documented-vs-actual queue architecture (BullMQ on paper, cron+outbox in code) needs a Deviations Log entry.

*Full structured findings: workflow `wf_4eb87b90-5bb` journal. Cross-references: Phase 1 site audit (force-dynamic/perf), Phase 3B (backend), 3E (database), 3G (code quality).*
