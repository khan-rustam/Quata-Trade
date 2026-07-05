# Phase 3B — Backend Deep Audit (NestJS money paths)

**Date:** 2026-07-05 · **Method:** 9 parallel staff-engineer readers over every backend subsystem (bootstrap, ledger, escrow/trades, fees, wallet/deposits, withdrawals/signer, auth, cross-cutting quality, admin/risk/screening/chat) → adversarial verification of critical/high money-path findings → hard-calibrated scoring. All findings cite code read directly. 48 findings; the one High was adversarially CONFIRMED.
**Verdict:** **CONDITIONAL PASS — money paths are structurally safe against fund loss, but the backend is NOT production-ready for real funds** until a defined must-fix set (money-path idempotency/exactly-once + session revocation + baseline observability) lands.

## Scores (calibrated against a production fintech backend, not a generic web API)

| Dimension | Score | One-line |
|---|---|---|
| **Money-path integrity** | **74/100** | Core conservation & FSM invariants verified to hold; edge/defense-in-depth gaps hold it below high-70s |
| **Backend quality** | **70/100** | Competent core, consistently under-hardened cross-cutting layer |
| **Observability** | **49/100** | Weakest dimension — no metrics/tracing, swallowed errors, unredacted worker logs; blind exactly where money incidents happen |

Severity tally: **3 High · 15 Medium · 23 Low · 7 Info.**

## What was verified SAFE (read, not assumed)

No fund-loss, no ledger-imbalance, no double-credit-before-confirmation, and no release-while-DISPUTED path was found. Positively confirmed:
- **Ledger:** append-only double-entry, sorted `FOR UPDATE` locking (deadlock-free), a per-journal idempotency key, cached balances guarded by invariant checks.
- **Fees:** the golden no-leak invariant `fee + buyerCredit == locked` holds end-to-end in pure bigint floor math (property-tested), and **escrow release reuses the stored fee rather than recomputing** — zero rounding drift, no double-charge.
- **Escrow/trades FSM:** single writer of `trades.status`; every transition is a guarded `WHERE status=<from>` UPDATE in the same transaction as its events+outbox, backstopped by a DB trigger; **DISPUTED truly freezes funds; oversell is impossible** (offer `FOR UPDATE` + guarded decrement).
- **Deposits:** exactly-once via three independent layers, credited only through `postJournal`, xpub-only derivation, AML-hold before credit.
- **Withdrawals:** BIGINT end-to-end, closed daily-cap TOCTOU, triple-enforced dual approval, step-up TOTP, true key isolation (no spending keys in API/worker).
- **Frozen users are re-gated `status==='active'` at the service layer**, so a frozen account cannot move funds even with a live token (this is why the session-revocation gap below is High, not Critical). The earlier "withdrawal double-payout" hypothesis is **not live** — the remote signer is an unimplemented human-authored stub and mock mode is hard-stopped in production.

## HIGH finding (adversarially CONFIRMED)

**B-H1 · Account freeze/suspend and logout do not invalidate live sessions; the documented `sid` denylist is unimplemented, and `refresh()` never re-checks user status.**
`JwtAuthGuard` verifies only signature + `typ` (`jwt-auth.guard.ts:31-38`); it never consults `sessions.revoked_at` or any denylist, though `jwt.types.ts:11` advertises that `sid` "lets logout/freeze invalidate access early." A risk-auto-frozen (`risk.service.ts:233`) or admin-frozen/suspended (`admin.service.ts:670`) user keeps a valid access token for its full TTL **and can indefinitely re-mint new access tokens via the refresh cookie** (up to `REFRESH_TTL_DAYS`, default 30/max 90) because `refresh()` never reads `users.status`. The fraud-containment control is a no-op across every non-money surface — most damagingly **continued chat with the victim/counterparty after being flagged**, plus disputes, PII read/update, notifications. **Fix:** on freeze/suspend/close and logout, revoke the sessions and have `JwtAuthGuard` reject revoked `sid` (Redis denylist keyed on `sid`, TTL = access TTL); have `refresh()` reject non-active users. (Admin JWTs have the same non-revocable/stale-role issue at the ~10-min TTL.)

## Money-path must-fix mediums (block real funds)

**B-M1 · `openTrade` requires an `idempotencyKey` but never uses it** — a retried `POST /trades` opens a **duplicate trade and double-locks seller escrow** (`trades.service.ts` openTrade ignores the mandated key; unlike confirm/cancel which ride the status guard). Recoverable (no fund loss) but a **direct violation of the "every money op is idempotent and safe to retry" rule** — close before launch.

**B-M2 · Deposit exactly-once is weaker than it looks.** `log_index` is derived from RPC log-array position (`trongrid.client.ts:118-146`), so a mempool-first-seen transfer can be re-recorded under a different index, defeating `UNIQUE(tx_hash,log_index)` and creating phantom permanently-`SEEN` rows; separately, once `block_number` is cached it is **never re-verified on-chain at credit time** (`deposit-confirmation.service.ts:50-93`) — reorg/orphan/misreported-block exposure (`ORPHANED` is defined but never written, and there is no `getTransactionStatus` re-check like the withdrawal path has). **Fix:** key idempotency on the true on-chain event index; re-verify `getTransactionStatus` (success + confirmations from freshly-returned inclusion) before flipping to CREDITED.

**B-M3 · Dual-approval DB backstop diverges from the runtime threshold + no AML re-screen at approval/signing.** `big_needs_two` CHECK hardcodes 500 USDT (`0003_wallet.ts:69`) while `dual_approval_threshold` is admin-editable with no upper bound — lower the setting and the DB permits single-admin approval above policy; raise it and the DB throws an unhandled CHECK-500 on legitimate single approvals. Separately, `screening.assertAllowed` runs only at whitelist-add and request time, **not at approval or signing** — a newly-sanctioned destination can still be paid. **Fix:** bound the setting ≤ the CHECK constant; add screening as a chokepoint at final approval and/or sign time; add `blocked_addresses` check to the (mock) signer.

## Observability & operational-resilience mediums (make incidents un-detectable)

- **`ReconciliationJob.run()` — the one job that detects ledger corruption — has no try/catch and flips the withdrawals kill-switch + its alert non-atomically** (`reconciliation.job.ts:49-91`). A crash mid-flip can pause withdrawals with nobody paged, or detect corruption and fail to alert. The integrity backstop is the least resilient cron.
- **Risk/auto-freeze scoring is fire-and-forget with `.catch(() => undefined)`** (`trades.controller.ts:158`, `withdrawals.controller.ts:87`) — a broken fraud-containment engine is completely invisible in production.
- **No metrics or tracing at all** (logs only); **the worker configures pino with no secret/PII redaction** (asymmetric with the API) — every money path runs in the worker; **no request-id correlation** in error responses; error logs stringify the error and drop stack traces.
- **No global exception filter** — three inconsistent error envelopes, domain→HTTP mapping copy-pasted per controller; **rate limiting uses in-memory throttler storage, not the available Redis** (auth brute-force limits reset on restart and multiply per instance); **outbox→notify is at-least-once but not idempotent** (duplicate notifications/ops pages on retry).
- **Env fail-fast gap:** `SIGNER_MODE=remote` does not require `SIGNER_URL`/mTLS cert paths — production boots "healthy" but withdrawals fail at first use.
- **Stuck-state blind spot:** rows orphaned in `SIGNING` after a crash have no alert (`alertStuckBroadcasts` checks only `BROADCAST`).

## Notable lows

`100% fee (fee_bps=10000)` is accepted and permanently locks escrow funds (cap `zFeeBps` to a sane max); `submitPayment` doesn't re-check `payment_deadline` (a buyer can escape auto-expiry by claiming payment after the window); confirmation PIN is only checked when supplied (a set PIN gives no protection if omitted); JWT verify doesn't pin `algorithms: ['HS256']`; TOTP codes aren't consumed/anti-replayed within their step; chat gateway uses permissive CORS (`origin:true, credentials:true`) and only authorizes at handshake; **admin 2FA is per-admin opt-in even in enforced mode** and KYC-approve/moderation/PII dashboards have no step-up; **sanctions blocklist block/unblock is not audit-logged and needs no step-up**; audit hash-chain excludes `ip`/`created_at` from the hashed payload; PIN set/replace skips the credential-change withdrawal hold; login doesn't require a verified email; the two god-services (admin 999 / withdrawals 848) are CQRS-split candidates.

## Must-fix before real funds (the launch gate)

1. Enforce the session/access-token denylist so freeze and logout actually cut access (B-H1).
2. Make `openTrade` honor its idempotency key (B-M1).
3. Harden deposit exactly-once — stable on-chain `log_index` + on-chain re-verification at credit (B-M2).
4. Close the withdrawal dual-approval backstop divergence and add AML re-screening at approval/signing (B-M3).
5. Stand up baseline observability — metrics/tracing, worker log redaction, non-swallowed risk errors, and a resilient always-paged reconciliation job.

Fix those and the money paths move from *"structurally safe but operationally exposed"* to genuinely launch-ready. The conservation and state-machine invariants that determine whether money can be lost or mis-moved are correct and well-tested.

*Full structured findings: workflow `wf_a4eb9a0f-268` journal. Cross-references: 3E (DB backstops/concurrency corroborate B-M2/B-M3), 3D (security lens on auth/uploads), 3A (god-service decomposition), 3H (failure-mode synthesis).*
