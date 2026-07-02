# 05 — Build Phases, Start/End Points & Audit Gates

> Build strictly in this order. Each phase has: **Start** (entry criteria), **Build** (what to make), **End / Definition of Done**, and an **AUDIT GATE** (must pass before next phase). Do not let Claude Code jump ahead. Each gate references sections in `08-security-checklist.md` and `09-testing-and-integration.md`.

## Phase 0 — Foundation (no business logic yet)
**Start:** empty repo.
**Build:**
- pnpm monorepo, `packages/shared`, `packages/config` (eslint/tsconfig/prettier), `CLAUDE.md`.
- `apps/api` Nest skeleton (fastify, config with zod env validation, pino, swagger dev-only, helmet, throttler).
- `apps/web` Next.js 15 skeleton (Tailwind, shadcn, next-intl en/fr, TanStack Query provider).
- `infra/docker-compose.yml`: postgres, redis, minio, clamav, tron-quickstart.
- CI: lint + typecheck + test + `npm audit`; husky pre-commit.
- ESLint override banning `any` in money folders (even though empty now).
**End/DoD:** `docker compose up` runs; `/health` returns green; CI passes on an empty test.
**AUDIT GATE 0:** secrets not in repo; `.env.example` only; strict tsconfig verified; branch protection on.

## Phase 1 — Ledger core (the foundation everything trusts)
**Start:** Phase 0 gate passed.
**Build:** `ledger` module exactly per `04-database-schema.md`: migrations for accounts/journal/entries/balances, append-only RULEs + REVOKE, balanced-journal trigger, `postJournal()` with serializable + sorted FOR UPDATE + idempotency, reconciliation job skeleton, `fees` module (pure functions).
**End/DoD:** can post balanced journals; double-spend and negative-balance attempts rejected by DB.
**AUDIT GATE 1 (heaviest):**
- Property tests (fast-check): random sequences of deposits/locks/releases/refunds → sum of all entries per journal always 0; user balances never negative; cache == recomputed sum. (§9 ledger tests)
- Concurrency test (Testcontainers): N parallel escrow locks on same seller balance → only up to available succeed, never oversell. (§8 concurrency)
- Fee math property tests: `fee = floor(amount * bps / 10000)`, `buyer_credit + fee == amount`, no rounding leak, all BIGINT. (§8 money math)
- 100% branch coverage on `ledger/` + `fees/`.
**Nothing proceeds until Gate 1 is green.**

## Phase 2 — Identity & auth
**Start:** Gate 1 passed.
**Build:** `auth` (register, email/phone OTP, login, argon2, JWT access+rotating refresh, revocation, PIN, TOTP 2FA), `users` (profile, sessions, devices), rate limiting on auth endpoints, account status/freeze.
**End/DoD:** full register→verify→login→refresh→logout; 2FA enforced where required.
**AUDIT GATE 2:** §8 auth checklist — token expiry/rotation/revocation proven by tests; brute-force lockouts; no user enumeration; PIN + password hashed (argon2id); IDOR tests on user endpoints.

## Phase 3 — Wallet (watch-only) + deposits + withdrawals
**Start:** Gate 2 passed. Seed generated offline by human; **xpub only** loaded into api config; signer deployed on Host B with hot key.
**Build:** `wallet` (derive TRC20 deposit addresses from xpub), `deposits` (BullMQ scanner via TronGrid: match address, verify canonical USDT contract, confirmation threshold, `UNIQUE(tx_hash,log_index)` idempotent credit → postJournal), `withdrawals` (request→debit to pending→risk→approval→signer handoff→broadcast→confirm), signer mTLS integration with independent policy re-checks + caps.
**End/DoD:** testnet deposit auto-credits after N confirmations; testnet withdrawal completes through approval + signer.
**AUDIT GATE 3 (crypto-critical):** §8 blockchain checklist — fake-token-contract deposit rejected; unconfirmed/dust not credited; reorg handling; withdrawal cannot exceed balance or caps; signer refuses non-APPROVED / over-cap / blacklisted; **no private key anywhere in api/worker/db/logs**; reconciliation (on-chain vs ledger) job green.

## Phase 4 — Offers + trades + escrow state machine
**Start:** Gate 3 passed.
**Build:** `offers` (CRUD, limits, remaining guard), `trades` + `escrow` (FSM per §4.5: open→lock→payment_submitted→complete/cancel/expire/dispute), payment-proof submission (`trade_payments`), trade timeout auto-cancel job, `short_ref` generation.
**End/DoD:** full happy-path trade completes; timeout refunds seller; illegal transitions rejected by DB trigger.
**AUDIT GATE 4:** §8 escrow checklist — no release while DISPUTED; concurrent "open trade" against same offer cannot oversell `remaining`; double-confirm idempotent (second confirm no-ops); expiry vs confirm race resolves to exactly one outcome; every transition wrote a `trade_event` in the same tx.

## Phase 5 — Disputes + chat
**Start:** Gate 4 passed.
**Build:** `disputes` (open, evidence upload, timeline, admin resolution → RESOLVED_RELEASE/REFUND via escrow service only), `chat` (Socket.IO per-trade room, message persistence, proof upload via sharp+file-type+ClamAV to MinIO, admin monitor namespace, dispute export).
**End/DoD:** dispute freezes escrow; admin resolution moves funds correctly; chat + uploads work with sanitization.
**AUDIT GATE 5:** §8 upload + chat checklist — SVG blocked, EXIF stripped, AV-scanned, size-limited, presigned short-TTL URLs, no IDOR on trade rooms/files; only COMPLIANCE/SUPPORT admins can resolve; resolution writes audit log.

## Phase 6 — Admin + RBAC + risk + notify
**Start:** Gate 5 passed.
**Build:** `admin` (RBAC guards per role matrix, dashboards APIs: users, trades, escrows, disputes, KYC queue, withdrawals approval, revenue/treasury, kill switches), `kyc` (manual review queue; Smile ID integration OR OCR-assist-only), `risk` (velocity, device, IP/GeoLite2, sanctions screening, duplicate detection), `notify` (email + in-app + delivery log).
**End/DoD:** admin can run the platform; kill switches work; KYC reviewed manually; risk flags surface; withdrawals require correct roles/approvals.
**AUDIT GATE 6:** §8 admin/RBAC checklist — every admin action audit-logged with hash chain; role escalation blocked; two-admin rule for large withdrawals enforced end-to-end; KYC never auto-approves; kill switch halts withdrawals + trades.

## Phase 7 — Hardening, E2E, launch prep
**Start:** Gate 6 passed.
**Build:** full Playwright E2E (register→KYC→deposit→offer→trade→dispute→withdraw), load/concurrency soak, backup+restore drill, monitoring dashboards + alerts, pen-test-style review, incident runbook, deviations log sign-off with client.
**End/DoD:** all gates green; staging soak clean; restore tested; client signs deviations log; mainnet with capped limits.
**AUDIT GATE 7 (launch):** full §8 checklist re-run; §9 integration matrix 100%; reconciliation running + alerting; caps in place (max trade, hot float, daily withdrawal); rollback plan documented.

## Phase 8+ (post-launch, deferred) 
BTC/ETH assets, Flutter apps, referral payouts, airtime/data module, dealer module, analytics depth, FCM push, self-hosted nodes, ML risk scoring (only once labeled fraud data exists). Each is its own mini-cycle with its own audit gate.

---

### Gate discipline (applies to all)
A gate is passed only when: CI green · required tests written **before** the code they cover on money paths · coverage thresholds met · the specific §8 checklist items ticked in a checklist file committed to `docs/audits/gate-N.md` with date + commit hash. If a gate fails, feature work stops until it's green. This is how you "monitor each and everything."
