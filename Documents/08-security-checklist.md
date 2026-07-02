# 08 — Security Checklist (Critical Checkpoints)

> This is the "must not fail" list. Each audit gate in `05-build-phases.md` ticks the relevant section here into `docs/audits/gate-N.md` with commit hash + date. Treat every box as a test that must exist, not just a claim.

## A. Money math & ledger integrity  (Gate 1)
- [ ] All amounts BIGINT smallest units end-to-end; `number`/float banned past display (ESLint + grep check in CI).
- [ ] Fee = `floor(amount * bps / 10000)`; `buyerCredit + fee === amount` exactly (property test, thousands of random cases).
- [ ] No rounding leak: sum of all splits over many trades loses/gains nothing vs inputs.
- [ ] Every journal balances to zero (DB trigger + property test).
- [ ] User balances can never go negative (DB CHECK + attempted-overdraw test).
- [ ] Cached balance always equals recomputed sum of entries (reconciliation test).
- [ ] Ledger is append-only: UPDATE/DELETE blocked by RULE and by REVOKE on app role (test tries both, expects failure).
- [ ] Every money operation has a unique idempotency key; replaying the same op does not double-apply (test).

## B. Concurrency & isolation  (Gates 1, 4)
- [ ] All money moves run SERIALIZABLE with retry on 40001 (max 3, jitter).
- [ ] `account_balances` locked `FOR UPDATE` in globally sorted order (no deadlock) — test with parallel cross-transfers.
- [ ] Parallel escrow locks on one seller balance never oversell available (Testcontainers, N concurrent).
- [ ] Parallel "open trade" on one offer never oversell `offers.remaining`.
- [ ] Double seller-confirm is idempotent (second is a no-op, funds move once).
- [ ] Expiry-job vs seller-confirm race yields exactly one terminal state (test both orderings).
- [ ] BullMQ jobs idempotent (re-delivery safe); deposit scanner safe to run overlapping.

## C. Escrow / trade state machine  (Gate 4)
- [ ] Transitions only via FSM; DB trigger rejects illegal transitions (test each illegal pair).
- [ ] No code path releases escrow while status = DISPUTED except admin `RESOLVED_*`.
- [ ] Every transition writes `trade_events` in the SAME transaction as the status change (test rollback leaves neither).
- [ ] Timeout auto-cancel refunds seller exactly once.
- [ ] Dispute resolution moves funds only through escrow service, never disputes module directly.

## D. Blockchain / wallet / keys  (Gate 3)
- [ ] API/worker/DB hold **no** private keys or mnemonics (grep + config review + secret scanner in CI).
- [ ] Deposit addresses derive from **xpub only**.
- [ ] Deposit credited only if `token_contract == canonical USDT contract` (fake-token test rejected).
- [ ] Confirmation threshold enforced; unconfirmed/dust not credited (test).
- [ ] `UNIQUE(tx_hash, log_index)` makes deposit crediting idempotent (replay test).
- [ ] Reorg/orphan handling: address monitored across reorg depth; orphaned tx not left credited (test on regtest/testnet).
- [ ] Withdrawal address validated + checksummed; blacklist/sanctions checked.
- [ ] Signer independently re-verifies status=APPROVED, amount ≤ per-tx cap, daily aggregate ≤ cap, destination not blacklisted — refuses otherwise (tests simulate a "compromised API" sending bad requests; signer must reject).
- [ ] Per-tx / per-hour / per-day caps enforced in service AND signer AND DB CHECK.
- [ ] Signer host: no inbound internet, WireGuard-only, mTLS, ufw default-deny (infra review).
- [ ] Hot float small; sweep to client-held cold (hardware wallet) above threshold.
- [ ] On-chain vs ledger reconciliation job runs, and pauses withdrawals on mismatch (test injects mismatch).

## E. AuthN / AuthZ  (Gate 2, 6)
- [ ] argon2id for passwords + PIN; per-secret salts.
- [ ] Access token ≤10 min; refresh rotating, hashed at rest, revocable; logout revokes (tests).
- [ ] No user enumeration (identical responses/timing for unknown vs wrong password).
- [ ] Brute-force lockout on login + PIN; throttling on all auth endpoints.
- [ ] TOTP 2FA required for withdrawals and all admin actions.
- [ ] IDOR: every resource access scoped to owner; test accessing another user's trade/wallet/withdrawal/message → 403/404 (never leak).
- [ ] RBAC matrix enforced by guard; test each role against each protected action (allow + deny cases).
- [ ] Large-withdrawal dual-approval enforced end-to-end (single admin cannot release).
- [ ] Ledger adjustments SUPER_ADMIN only + mandatory reason + audit.

## F. Input, uploads, injection  (Gates 5, all)
- [ ] Every endpoint validates input with zod, rejects unknown fields (whitelist).
- [ ] Parameterized queries only (Kysely) — no string-built SQL (review + test).
- [ ] File uploads: magic-byte check (file-type), SVG banned, size limits, sharp re-encode + EXIF strip, ClamAV scan before persist.
- [ ] Uploaded files in private MinIO buckets, served via short-TTL presigned URLs, never public, never in webroot.
- [ ] KYC files encrypted at rest per-file (sodium); access audit-logged; retention date enforced by a purge job.
- [ ] XSS: chat and any user text escaped on render; CSP via helmet.
- [ ] SSRF: no server-side fetch of user-supplied URLs; RPC/webhook endpoints allow-listed.
- [ ] Webhook/callback signatures verified (if any provider used).

## G. Infra, secrets, ops  (Gates 0, 3, 7)
- [ ] No secrets in repo/history (git-secrets/gitleaks in CI); `.env.example` only.
- [ ] Secrets from Infisical/SOPS; master keys never on app-host disk in plaintext.
- [ ] VPS hardened: ufw default-deny, fail2ban, unattended-upgrades, SSH keys only, no root login.
- [ ] Nginx: TLS (certbot), HSTS, sane timeouts, request size limits, rate limit at edge too.
- [ ] Containers: non-root users, minimal base images, no capabilities they don't need, internal services not published to host.
- [ ] Backups: pgBackRest + restic, encrypted, offsite; **restore drill tested** (not just backup taken).
- [ ] Audit logs append-only + hash-chained (prev_hash/row_hash), tamper test detects edits.
- [ ] Monitoring: chain-lag, reconciliation status, withdrawal volume anomaly, error rate, disk/mem alerts.
- [ ] Kill switches (withdrawals, trades) tested to actually halt the queues.

## H. Dependency & AI-code discipline  (all gates)
- [ ] Exact-pinned deps + lockfile; Dependabot + `npm audit` + Socket.dev in CI; block on high severity.
- [ ] No postinstall scripts from unaudited packages; review crypto-lib updates manually (supply-chain risk).
- [ ] Money-path code: tests written **before** implementation; property tests for math; concurrency tests for locks.
- [ ] Signer code: human-authored/reviewed line-by-line; Claude Code does not modify it unattended.
- [ ] Every AI-generated money-path PR reviewed against this checklist before merge; reviewer signs the gate doc.
- [ ] No `any`/unchecked casts in `ledger/ escrow/ wallet/ withdrawal/ fees/ signer/` (ESLint hard-fail).

## I. Privacy / legal  (Gate 6, 7)
- [ ] KYC/biometric handling documented; consent captured; retention + purge enforced (Cameroon Law 2024/017 alignment).
- [ ] No KYC-as-training-data pipeline in v1 (explicitly out of scope; documented in deviations log).
- [ ] Data-subject request path exists (export/delete within legal limits).
- [ ] Deviations log signed by client; developer's written risk advisory retained.

---
### Top 10 things that most commonly sink platforms like this (keep visible)
1. Storing balances as a mutable column instead of a ledger. 2. Floats for money. 3. Private keys in .env/DB. 4. Crediting deposits before confirmations / from fake token contracts. 5. Releasing escrow during a dispute via an overlooked path. 6. Race conditions overselling escrow/offers. 7. Trusting screenshot payment proof as automatic (it isn't — seller confirms in their own account; that's why the human-confirm step exists). 8. IDOR exposing others' trades/wallets. 9. No withdrawal caps/approval → single compromise drains hot wallet. 10. Backups never test-restored.
