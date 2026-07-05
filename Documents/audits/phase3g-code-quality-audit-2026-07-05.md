# Phase 3G — Code Quality Audit

**Date:** 2026-07-05 · **Method:** parallel principal-engineer readers over type-safety/lint hygiene, dead code/duplication, complexity/size, naming/comments, and test quality; scored synthesis. All escape-hatch counts and duplications verified against source with grep. (One reader — error-handling/async patterns — errored on a structured-output retry cap; that scope is covered by 3B's swallowed-error/async findings and is cross-referenced below.)
**Verdict:** **NOT ready to pass the Phase 3G money-path gate.** A competently-built codebase with genuinely strong baseline type discipline, undermined by a cluster of systemic gaps that concentrate — dangerously — on the money paths and the highest-privilege admin surface the project's own rules single out for the strictest treatment. None of the issues is an architectural dead-end; the fixes are well-scoped.

## Scores (calibrated against a production fintech codebase)

| Dimension | Score | One-line |
|---|---|---|
| **Type safety** | **74/100** | Strong, verified production hygiene; residual risk lands on the contract package + admin surface |
| **Cleanliness** | **64/100** | Micro-level clean (0 unused vars); macro-level rot on security paths |
| **Complexity** | **62/100** | Concentrated on money paths — directly violates the "reviewable line-by-line" rule |
| **Test quality** | **55/100** | Where tests exist they're excellent; the flagship coverage gate is dead config |

Severity tally: **1 Critical · 8 High · 20 Medium · 11 Low · 4 Info.**

## What is genuinely strong (verified, not assumed)

Production type hygiene is excellent for a codebase this size: **0 `: any` annotations and 0 `as any` in source** (all `any` grep hits are comments/Kysely SQL/PWA manifest/legal prose); `as unknown as` confined to **6 spec files** (0 in production, 0 in money paths); **0 real `@ts-ignore`** in source (the ~50 hits are in `.next/` build output); ~0 non-null assertions on money paths. The **backend money-path ESLint bans are real and NOT circumvented** — no suppressions smuggled inside `ledger/escrow/fees/wallet/withdrawals/deposits/trades`. Where integration tests exist they are high quality — genuine idempotency-replay, concurrency, overdraw, and race-branch coverage with low flakiness. This is not a sloppy team.

## CRITICAL finding

**G-C1 · The "100% branch on ledger/escrow/fees" coverage gate is dead config — never enforced, despite comments claiming it is.**
`backend/vitest.config.ts` locks branches/functions/lines/statements at 100 and its comments assert the launch gate is "now MET" and "CI blocks regressions" — but **no `package.json` script and no CI step ever passes `--coverage`** (verified). The signature money-path safety guarantee in Documents/09, CLAUDE.md, and the basis of the Gate-1 PASS is **unenforced**, and the reassuring comments actively mislead reviewers into thinking it is live. **This is the headline finding: the codebase's most load-bearing claim about itself is false.** Fix: wire `--coverage` into CI as a blocking step, then widen the `include` beyond the current 3 files. *(Ties directly to 3A's "coverage gate narrow" and to the Gate-1 caveat — Gate 1 should be re-verified once coverage actually runs.)*

## HIGH findings (8)

**G-H1 · `openTrade` idempotency is neither implemented nor tested.** `trades.service.ts openTrade()` mints a fresh trade id and derives the escrow-lock key from it, **ignoring the mandated idempotency key** — a retry opens a second trade against the same offer and double-decrements it. No test catches it (the escrow helper always mints a fresh key). *(The same defect surfaced independently in 3B-M1 and 3D — three phases, one bug: high confidence.)*

**G-H2 · AES-256-GCM secret crypto is triplicated; two copies carry stale "`src/common/crypto.ts` does not exist yet" comments while that file demonstrably exists and is used.** Three copies of the `iv‖tag‖ciphertext` layout decrypt the same `users.totp_secret_enc` column; a crypto/key-handling fix must land in all three or 2FA silently breaks. *(3A, 3D corroborate; the withdrawals copy also drops the 32-byte key-length check.)*

**G-H3 · The five highest-privilege admin mutations are untyped end-to-end** (`adminApproveWithdrawal`/`adminRejectWithdrawal`/`adminReviewKyc`/`adminResolveDispute`/`adminUpdateSetting` validate responses with `zAnyRecord = z.object({}).passthrough()` and return `Promise<unknown>`). The most consequential operations in the system have **zero response-schema enforcement** in the package CLAUDE.md names the FE/BE source of truth. *(3C-H5, 3A corroborate.)*

**G-H4 · Money-path code violates the "reviewable line-by-line" rule.** `WithdrawalsService.request()` folds validation + auth + risk + ledger + persistence into one **210-LOC, ~20-branch god-method**; `AdminService` is a **999-LOC god-object spanning 8 domains** (`getUserDetail()` alone is 229 LOC); and **second-factor PIN/TOTP logic is re-implemented 3×, one copy in a controller issuing DB writes.** At these sizes a reviewer cannot isolate a change to (e.g.) the cap check from the ledger legs — defeating the money-path review discipline. *(3A-H2 corroborates the admin god-object.)*

**G-H5 · XAF-hardcoded display and naming mislabel every live non-XAF market.** `formatRate` defaults `currencyCode` to `"XAF"` and runs money through a JS float; `formatXaf`/`formatXAF` hardcode the "XAF" label; DB columns (`price_xaf_per_unit`, `fiat_amount_xaf`), shared schemas, and a money-path function (`fiatValueXaf`) all carry the misnomer. **With NGN/GHS/XOF markets now live (multi-country cutover), this is a confirmed user-facing bug** — NGN/GHS/XOF amounts render as "XAF" and an admin metric sums fiat across currencies. *(3C-H4, 3E schema finding corroborate.)*

## Notable mediums

- **`shared/` (the FE/BE contract source of truth) has no ESLint at all** — its `lint` script is `tsc --noEmit`; none of the any/cast/float/Number bans reach the package both sides import. The strongest guardrails stop exactly where the contract is defined.
- **The money-path `Number()`/`parseFloat` ESLint ban is trivially bypassable** — it matches only a bare identifier named `amount|fee|balance|price`, so `Number(row.amount)` or `parseInt(feeUnits)` in a money folder would compile and lint clean. Combined with **`no-unsafe-assignment` globally disabled**, implicit-`any` propagation on data paths is uncaught — the guardrail gives false confidence.
- **Five dependencies imported nowhere:** `bullmq` (the worker docstrings claim "BullMQ processors" but every job is a `@nestjs/schedule @Cron` — no BullMQ exists), the full `passport`/`passport-jwt`/`@nestjs/passport` stack (auth is a custom guard over `@nestjs/jwt`), `@fastify/static`; frontend `socket.io-client` (polls via react-query) and `decimal.js` (only transitive through shared). Dead install surface + misleading architecture docs.
- **~40 domain-error→HTTP mappings copy-pasted across 12 controllers** (two identically-named `rethrowAsHttp` functions) with no shared exception filter — the status-code contract is scattered and easy to make inconsistent. *(3B corroborates the missing global filter.)*
- **Upload magic-byte validation is re-rolled in KYC** (`kyc.rules.ts`) instead of reusing the shared `chat.validators` sniffer — divergent size caps (5 MB vs 3 MB) and divergent PNG signature checks (chat validates the full 8-byte signature, KYC only 4 bytes). Security-sensitive validation in two hand-maintained copies. *(3D flags the KYC/upload surface too.)*
- **Unchecked DB→type casts at read boundaries** (`parsePgEnumArray as T[]`, settings JSON `as Partial<CompanyInfo>`, enum strings `as EnquiryStatus`) — stored data is narrowed by cast, not parsed by zod; contained (not on the core ledger path) but erodes the "parse don't cast" discipline.
- Confirmed: **risk-scoring failures silently swallowed** on trade-open and withdrawal (`.catch(() => undefined)`) — a broken risk engine fails open unlogged. *(3B, 3D corroborate; the many `.catch(() => false)` on argon2.verify are a legitimate fail-closed pattern.)*

## Notable lows

Frontend `tsconfig` lacks `noUncheckedIndexedAccess` (asymmetric vs backend/shared — 3A); admin list controllers typed `Paged<unknown>` (backend loses compile-time shape coverage; FE still zod-validates the wire); orphaned shared money-policy constants (`DUAL_APPROVAL_THRESHOLD`, `TRADE_PAYMENT_WINDOW_MINUTES`, `KYC_TIER_LIMITS`) imported nowhere while the backend reads all three from the settings table — dead exports masquerading as the money-policy source of truth; dead frontend exports (`msToDeadline`, `INDICATIVE_XAF_PER_USDT`, `isUnauthorized`, `subscribeAuth` — the last implies an unfinished reactive-auth wiring); pagination boilerplate duplicated across ~9 services with no `paginate()` helper.

## Must-clear before the Phase 3G gate

1. **Wire `--coverage` into CI and make the ledger/escrow/fees gate real** (G-C1), then widen the include beyond 3 files. *(Also re-verify Gate 1 afterward.)*
2. **Implement and test `openTrade` idempotency** (G-H1).
3. **Collapse the triplicated crypto onto `common/crypto.ts`; delete the stale comments** (G-H2).

Fast-follows: decompose the withdrawal/admin god-methods (G-H4); type the admin mutation contract (G-H3); fix the XAF display mislabeling before it reaches more non-XAF users (G-H5); add ESLint to `shared/` and broaden the money-`Number()` ban; remove the 5 dead deps and fix the misleading BullMQ docstrings.

*Full structured findings: workflow `wf_b2d2d1ad-5a9` journal. Cross-references: 3A (admin god-object, shared build/lint, coverage), 3B (openTrade idempotency, swallowed risk, missing filter), 3C (XAF float, zAnyRecord), 3D (crypto triplication, upload validation), 3E (XAF schema naming), 3H (readiness).*
