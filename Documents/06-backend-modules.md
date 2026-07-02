# 06 — Backend Modules (NestJS) Specification

> One section per module. Each lists: responsibility, key endpoints, invariants/rules, who may call it, and events emitted. Endpoints are REST under `/api/v1`. All inputs validated with zod from `packages/shared`. All money amounts are BIGINT strings over the wire (JSON has no bigint) → parsed to `bigint` server-side, never `number`.

## ledger  (review priority #1)
**Responsibility:** the only writer of `journal_entries`, `ledger_entries`, `account_balances`. Exposes `postJournal()` and read helpers.
**No HTTP endpoints** (internal service only).
**Rules:** serializable tx; sorted `FOR UPDATE`; idempotency key unique; balanced legs; non-negative user balances; retry on serialization failure (max 3, jittered).
**Callers:** deposits, withdrawals, escrow, treasury, admin adjustments (adjustments require SUPER_ADMIN + audit + reason).
**Emits:** `ledger.posted`.

## fees  (review priority #1)
**Responsibility:** pure functions. `computeFee(amount, bps): bigint = amount * bps / 10000` floored; `split(amount, bps): {buyerCredit, fee}` with `buyerCredit + fee === amount`.
**Rules:** no I/O, no floats, property-tested exhaustively. bps from settings (30 QuataPay, 50 MoMo/Orange).

## auth
**Endpoints:** `POST /auth/register`, `/auth/verify-email`, `/auth/verify-phone`, `/auth/login`, `/auth/refresh`, `/auth/logout`, `/auth/2fa/setup`, `/auth/2fa/enable`, `/auth/2fa/verify`, `/auth/pin/set`, `/auth/forgot`, `/auth/reset`.
**Rules:** argon2id; access token 10 min; refresh rotating + hashed + revocable; generic errors (no user enumeration); throttle + lockout; TOTP required for withdrawals & admin; PIN 5-attempt lock.
**Emits:** `user.registered`, `user.login`, `user.login_failed`.

## users
**Endpoints:** `GET/PATCH /users/me`, `GET /users/me/sessions`, `DELETE /users/me/sessions/:id`, `GET /users/me/devices`, security-center reads.
**Rules:** IDOR-proof (always scope by authenticated user id, never trust path id for own resources); freeze/suspend blocks trading + withdrawal.

## kyc
**Endpoints:** `POST /kyc/submit` (tier, doc, files), `GET /kyc/status`; admin: `GET /admin/kyc/queue`, `POST /admin/kyc/:id/approve|reject|resubmit`.
**Rules:** **manual decision only** — no code path auto-approves. If Smile ID used, its result is a *signal* shown to the reviewer. Files encrypted at rest, retention date set on submit. Tier limits gate trade/withdraw sizes.
**Emits:** `kyc.submitted`, `kyc.reviewed`.

## wallet (watch-only)
**Endpoints:** `GET /wallet/balances`, `GET /wallet/:asset/deposit-address`.
**Rules:** derives addresses from **xpub** at `m/44'/195'/0'/0/N`; never holds private keys; balances are ledger-derived, not chain-derived (chain used only for deposit detection + reconciliation).

## deposits
**No public write endpoints.** BullMQ `deposits` queue scans TronGrid.
**Rules:** credit only when: address is ours, `token_contract == canonical USDT`, confirmations ≥ threshold, `(tx_hash,log_index)` not already processed. Dust below min ignored. Reorg → mark ORPHANED + reverse only if not yet spent (should not happen post-threshold). Credit via `postJournal(deposit_credit)`.
**Emits:** `deposit.credited`.

## withdrawals
**Endpoints:** `POST /withdrawals` (to_address, amount, 2FA, PIN), `GET /withdrawals`, admin `POST /admin/withdrawals/:id/approve|reject`.
**Flow:** validate KYC/2FA/PIN → debit to pending via postJournal → risk scoring → `PENDING_APPROVAL` (or auto below small threshold if policy allows) → admin approve (two admins if ≥ cap) → signer signs+broadcasts → poll confirm.
**Rules:** address validation + checksum; blacklist check; per-tx/day caps enforced in service **and** signer **and** DB CHECK; idempotency key.
**Emits:** `withdrawal.requested/approved/broadcast/confirmed/failed`.

## offers
**Endpoints:** `POST /offers`, `PATCH /offers/:id`, `POST /offers/:id/pause|activate`, `DELETE /offers/:id`, `GET /offers` (filters: side, asset, method, min/max, verified), `GET /offers/:id`.
**Rules:** `min_trade ≤ max_trade ≤ remaining`; SELL offers must have seller balance backing (soft check at create, hard check at trade open); price in XAF per whole USDT.

## trades + escrow  (review priority #2)
**Endpoints:** `POST /trades` (open from offer), `POST /trades/:id/pay` (submit proof), `POST /trades/:id/confirm` (seller), `POST /trades/:id/cancel`, `GET /trades`, `GET /trades/:id`.
**Rules:** FSM only (§4.5); open trade locks escrow atomically + decrements offer.remaining; confirm requires seller + status PAYMENT_SUBMITTED + optional 2FA/PIN; release splits amount−fee→buyer, fee→treasury; timeout job expires+refunds; DISPUTED freezes; only admin resolves disputed. Every transition writes `trade_events` in same tx. Idempotent confirm (double click = no-op).
**Emits:** `trade.opened/locked/payment_submitted/completed/expired/cancelled/disputed`.

## disputes
**Endpoints:** `POST /trades/:id/dispute`, `POST /disputes/:id/evidence`, `GET /disputes/:id`; admin `GET /admin/disputes`, `POST /admin/disputes/:id/resolve` (RELEASE_TO_BUYER | REFUND_TO_SELLER + notes).
**Rules:** resolution executes via escrow service (RESOLVED_RELEASE/REFUND transitions) — disputes module never touches ledger directly; only COMPLIANCE/SUPPORT admin; audit-logged.
**Emits:** `dispute.opened/resolved`.

## chat
**Gateway:** Socket.IO namespace `/trade/:id` (auth: only buyer, seller, monitoring admin). REST `GET /trades/:id/messages`, `POST /trades/:id/messages` (with attachment pipeline).
**Rules:** attachments → sharp re-encode + EXIF strip + file-type magic check (no SVG) + ClamAV → MinIO private + presigned short TTL; XSS-safe rendering; messages retained for dispute export; admin monitor read-only.

## risk
**Responsibility:** score events (login, trade open, withdrawal). Rules: velocity (Redis counters), device mismatch (FingerprintJS), IP/VPN (GeoLite2), duplicate account heuristics, sanctions screening (OFAC/OpenSanctions). Output score + flags → `risk_events`; high/critical → auto-freeze + escalate.
**Rules:** deterministic, config-driven thresholds; **no LLM**; explainable flags stored.
**Emits:** `risk.flagged`, `user.frozen`.

## notify
**Responsibility:** consume domain events → render (MJML/Handlebars) → send (nodemailer SMTP + in-app row + socket) → log `notification_deliveries`, BullMQ retries.
**Rules:** never include secrets/full addresses; user notification preferences respected.

## admin + treasury
**Endpoints (RBAC-guarded):** dashboards (users, trades, escrows, disputes, KYC, withdrawals), `POST /admin/kill-switch/{withdrawals|trades}` (toggle), `POST /admin/users/:id/{freeze|suspend|restore}`, treasury `GET /admin/revenue`, `GET /admin/treasury/balances`.
**Rules:** RBAC matrix (below); every action → `audit_logs` (hash-chained); large/critical actions need SUPER_ADMIN or dual approval; kill switches halt the relevant queues immediately.

### RBAC matrix (enforce via guard + tests)
| Action | SUPER | FINANCE | COMPLIANCE | SUPPORT | MOD | AUDITOR | ANALYST |
|---|---|---|---|---|---|---|---|
| Approve withdrawal | ✓ | ✓ | | | | | |
| 2nd-approve large wd | ✓ | ✓ | ✓ | | | | |
| Resolve dispute | ✓ | | ✓ | ✓ | | | |
| KYC approve/reject | ✓ | | ✓ | | | | |
| Freeze/suspend user | ✓ | | ✓ | ✓ | ✓ | | |
| Kill switch | ✓ | ✓ | | | | | |
| Ledger adjustment | ✓ | | | | | | |
| View dashboards | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Edit settings/fees | ✓ | ✓ | | | | | |
| View audit logs | ✓ | | ✓ | | | ✓ | |

## health
`GET /health` (liveness), `GET /health/ready` (pg, redis, minio, RPC reachable, chain-lag under threshold, reconciliation status, kill-switch state). Used by Nginx/monitoring.

---
### Cross-cutting rules for every module
- Guards: `JwtAuthGuard` default; `@Public()` opt-out; `RolesGuard` for admin.
- Every controller input parsed by zod; reject unknown fields (whitelist).
- Every money-moving handler: idempotency key required, wrapped in the ledger/escrow serializable path, safe to retry.
- Emit domain events via outbox table (same tx as state change) → dispatcher publishes; guarantees notify/risk/audit never miss an event.
