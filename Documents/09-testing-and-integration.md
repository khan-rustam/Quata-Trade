# 09 — Testing, Integration & Monitoring

> How you verify backend + frontend work together completely, with types, and how you monitor everything. Tests are grouped by level; money paths require the top three levels before merge.

## Test pyramid for this project

| Level | Tool | Covers | Gate |
|---|---|---|---|
| Unit | Vitest | pure logic, guards, mappers | all |
| Property | fast-check | ledger math, fee splits, invariants | 1 |
| Integration (DB/queue) | Testcontainers (pg, redis, minio) | postJournal, escrow FSM, concurrency, deposit credit | 1,3,4 |
| Chain integration | TRON Quickstart / Shasta + regtest later | deposit detect, withdrawal sign+broadcast, reorg | 3 |
| Contract (FE↔BE) | shared zod schemas + supertest | request/response shapes match exactly | 2–6 |
| API (HTTP) | supertest | endpoints, auth, RBAC, IDOR | 2–6 |
| E2E | Playwright | full user journeys in the browser | 7 |
| Load/concurrency | k6 or artillery + custom parallel scripts | oversell/double-release under load | 1,4,7 |

## Money-path rule (non-negotiable)
For anything touching ledger/escrow/withdrawal/fees: **write the failing test first**, then implement. Minimum set before merge: unit + property (where math) + integration incl. a **concurrent** scenario. Coverage gate: 100% branch on `ledger/ escrow/ fees/`; ≥80% backend overall.

## Key test scenarios to implement (checklist)

### Ledger / fees (property-based)
- Random op sequences keep every journal balanced and all user balances ≥ 0.
- `buyerCredit + fee === amount` for all amounts and both bps; no leak over 10k trades.
- Idempotency: replaying a journal by key applies once.

### Concurrency (Testcontainers, real parallel connections)
- 50 concurrent escrow locks on a seller with balance for only 10 → exactly 10 succeed.
- Concurrent open-trade on an offer with `remaining=100`, ten 20-unit trades → exactly 5 succeed.
- Confirm vs expiry race → one terminal state, funds moved once.
- Parallel deposit scanner runs → each (tx_hash,log_index) credited once.

### Escrow FSM
- Every legal transition works; every illegal transition rejected by trigger.
- No release while DISPUTED (attempt via every entry point).
- Rollback atomicity: force failure mid-release → no partial ledger change, no event row.

### Blockchain (testnet/regtest)
- Deposit below confirmations not credited; at threshold credited once.
- Fake USDT contract deposit ignored.
- Reorg: orphaned deposit not left credited.
- Withdrawal: request→approve→signer→broadcast→confirm; signer rejects non-APPROVED / over-cap / blacklisted even when API asks.

### Auth / RBAC / IDOR
- Token rotation/revocation/expiry behave; logout kills refresh.
- Each role × each protected action (allow + deny).
- Cross-user access to trade/wallet/withdrawal/message → denied, no data leak.

### Uploads / chat
- SVG rejected; oversized rejected; EXIF stripped; ClamAV catches EICAR test file; presigned URL expires.

## Frontend↔Backend integration verification (the part you asked to be complete & typed)

1. **Type-level (compile time):** FE imports response types inferred from the same zod schemas the BE validates with. Any drift = TypeScript build failure in CI. This is continuous, automatic integration checking.
2. **Contract tests:** for each endpoint, a test sends a real request through supertest and parses the response with the shared schema (`schema.parse(res.body)` must not throw) — proves the server honors the contract the client relies on.
3. **Typed API client tests:** the generated client in `packages/shared` is exercised against the running API in integration tests; a breaking change fails here.
4. **E2E (Playwright):** real browser drives the real frontend against a real backend on testnet:
   - Register → verify → login → 2FA.
   - KYC submit → admin manual approve.
   - Deposit (testnet) → balance credited.
   - Create sell offer → second user opens trade → escrow locks → buyer submits proof → seller confirms → buyer credited, fee to treasury.
   - Dispute path → admin resolves → funds move correctly.
   - Withdraw → approval → signer → confirmed.
5. **Reconciliation as a live integration test in prod:** scheduled job compares on-chain balances, ledger sums, and cached balances; mismatch pages you and pauses withdrawals.

## CI pipeline (GitHub Actions)
Stages, fail-fast: `install (frozen lockfile)` → `lint + typecheck` → `unit + property` → `integration (Testcontainers)` → `contract/api` → `build` → `audit (npm audit + gitleaks + Socket.dev)`. E2E + chain integration run on staging deploy. No merge to main without green + gate doc updated when a gate is involved.

## Monitoring & observability (so you can watch everything)
- **Logs:** pino JSON → shipped; request IDs; never secrets/PII.
- **Metrics:** Prometheus + Grafana dashboards — trade volume, escrow locked total, withdrawal volume, hot wallet balance, chain-lag (blocks behind), reconciliation drift, error rates, queue depths, RPC failure rate.
- **Uptime:** Uptime Kuma on `/health/ready`.
- **Errors:** GlitchTip (OSS Sentry) for exceptions.
- **Alerts (page you):** reconciliation mismatch, hot wallet below refill / above cap, withdrawal volume spike, signer refusals, RPC provider down, deposit scanner stalled, disk/mem, repeated auth failures from one IP/user.
- **Financial dashboard:** treasury balance, fees earned (day/month/lifetime) from the ledger — your revenue view and an integrity check at once.

## Definition of "done" for a feature
Code + tests (right levels) + docs (module README updated) + shared schema updated + FE call sites compile + relevant §8 boxes ticked + CI green. Only then merge.
