# Adversarial Security Review — Money Paths

**Date:** 2026-07-02 · **Method:** 4 parallel reviewers (ledger/escrow, wallet/deposits/withdrawals,
auth/RBAC/IDOR, input/crypto/secrets) → each finding independently verified by a second agent
prompted to refute. 6 findings CONFIRMED, 0 uncertain. **All 6 fixed and regression-tested.**

| # | Sev | Finding | Fix | Status |
|---|-----|---------|-----|--------|
| 1 | HIGH | Escrow journal idempotency keys derived from the client-supplied key, not the trade id — a reused key across two trades silently replayed the ledger journal, oversell­ing the offer and leaving unbacked/trapped escrow (§08 A/B/C) | `escrow.service.ts`: all lock/release/refund keys now `trade:<id>:<op>`; client key no longer threaded into the ledger | Fixed + regression test |
| 2 | HIGH | Audit hash-chain ordered by `created_at` (= txn START time); money-path audit rows written inside the outer money txn commit out of start order, forking the chain and making `verifyChain()` report false tampering (§08 G) | Migration 0008 adds a monotonic `seq`; chain head-select + `verifyChain()` order by `seq` (assigned at insert, monotonic under the existing advisory lock) | Fixed |
| 3 | MED | IDOR: `confirm`/`cancel` returned the full trade row (incl. counterparty payment details) to a non-party for terminal trades — the ownership check ran AFTER the idempotent early-return (§08 E) | Party check moved BEFORE the terminal-status early-return in both methods | Fixed + regression test |
| 4 | MED | Daily/tier withdrawal cap TOCTOU: the daily aggregate SUM is read under READ COMMITTED with no per-user lock, so N parallel requests each pass the cap (§08 B/D) | Per-user `pg_advisory_xact_lock('withdrawal_daily', userId)` at the start of the money txn, before the aggregate read | Fixed |
| 5 | MED | Dispute resolution (which releases/refunds escrow) was the only admin money action with no step-up TOTP — a hijacked SUPPORT_ADMIN token could drain escrow (§08 E) | `zResolveDisputeRequest` gains `totpCode`; admin controller calls `adminAuth.verifyTotp` before resolving, like withdrawal approve/reject | Fixed |
| 6 | LOW | Two USDT transfers to the same address in one tx collapsed to one `log_index`, so the second deposit collided on `UNIQUE(tx_hash,log_index)` and was silently dropped (under-credit) (§08 D) | TronGrid client resolves ALL matching Transfer log indexes per tx and assigns them per-occurrence | Fixed |

## Post-fix verification
- `pnpm typecheck` clean · `pnpm lint` clean (money-path `any`/double-cast ban enforced) ·
  **193 tests pass** (unit + property + Testcontainers integration) · coverage gate green ·
  full monorepo build green.

## Residual (tracked, not blocking this phase)
- 100%-branch launch gate on ledger/escrow/fees (Documents/09) needs fault-injection tests for
  the serialization-retry (40001) and unique-violation race-recovery branches. Current floor:
  ~84% branch / 93% line, ratcheted in CI.
- Trade-open is not idempotent on a double-submit (creates two distinct trades); acceptable for
  v1 (both are real trades) but a dedup key is a candidate hardening before mainnet.
