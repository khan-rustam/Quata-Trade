# QuataTrade — Launch Security Audit & Remediation (2026-07-15)

Five parallel specialist reviewers audited the full security surface against the live code
(money-path fund safety · identity/access · keys/crypto/signer · API perimeter · ops/config/silent-failures).

## Verdict
**No CRITICAL issues. No attacker path to steal platform funds.** The money core (double-entry
ledger, escrow FSM, idempotency, locking, watch-only key isolation, fail-closed signer boundary)
was traced adversarially and verified solid. Findings were access-layer, second-factor, and
config/ops hardening. The remediation below closes both HIGHs and the actionable MEDIUM/LOW items.

## Fixed & verified (this batch)

| # | Sev | Finding | Fix | Where |
|---|-----|---------|-----|-------|
| 1 | HIGH | No server-side session revocation; `refresh()` ignored user status (frozen user kept tokens ≤30d) | `refresh()` rejects non-active + kills the session chain; freeze/suspend/close and risk auto-freeze revoke all live sessions in-tx | `auth.service.ts`, `admin.service.ts`, `risk.service.ts` |
| 2 | HIGH | PIN silently skipped on escrow-release confirm when omitted | PIN mandatory when set, via pure tested `missingSecondFactor()` helper | `trades/second-factors.ts` (+spec), `trades.controller.ts` |
| 4 | MED | TOTP codes replayable within window (no single-use) | Persist last-consumed step (`totp_last_step`), atomic compare-and-set at all 6 verify sites (user login, 2FA-verify, trade confirm, withdrawal; admin login, step-up, enrol) | migration `0030`, `common/auth/totp-step.ts` (+spec), user + admin verify sites |
| 5 | MED | USDT contract not pinned to canonical mainnet | Prod hard-stop: `USDT_TRC20_CONTRACT === TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t` | `config/env.ts` (+spec) |
| 6 | MED | `WALLET_XPUB` not format-validated (xprv would pass env) | Schema refine rejects `xprv/tprv/yprv/zprv…` | `config/env.ts` (+spec) |
| 7 | MED | `DEPOSIT_CONFIRMATIONS` floor was `min(1)` (reorg risk) | Prod hard-stop `>= 19` (TRON finality) | `config/env.ts` (+spec) |
| 8 | MED | `WALLET_HOT_ADDRESS` not required → reserve/solvency check silently skippable in prod | Prod hard-stop requires it | `config/env.ts` (+spec) |
| 9 | MED | Reconciliation kill-switch flip non-atomic + no cache invalidation | New atomic `SettingsService.pauseWithdrawals()` (FOR UPDATE + invalidate); job uses it | `settings.service.ts`, `reconciliation.job.ts` |
| 12 | MED | Deactivated/demoted admin kept privileges until token expiry | Guard re-checks `admins.active` + uses LIVE role per admin request (users unaffected) | `common/auth/jwt-auth.guard.ts` |
| L1 | LOW | Reconciliation `run()` had no per-check isolation / failure alert | Each sub-check wrapped; failures emit critical `reconciliation.job_error` | `reconciliation.job.ts`, `alerts.service.ts` |
| L2 | LOW | `SIGNER_MODE=remote` didn't require mTLS config at boot | Prod hard-stop requires URL + 3 cert paths | `config/env.ts` (+spec) |
| L3 | LOW | Login timing oracle (locked/closed distinguishable) | Password verified first so all reject paths pay equal argon2 cost | `auth.service.ts` |
| L4 | LOW | PIN lockout overshoot under concurrency | Per-user `pg_advisory_xact_lock` serializes attempts | `pin.service.ts` |
| — | LOW | Socket.IO CORS `origin:true`; `TRON_FALLBACK_RPC_URL` unvalidated; duplicate AES-GCM helper | CORS pinned to `WEB_ORIGIN`; fallback URL `.url()`; `secret-crypto.ts` removed → single `common/crypto` | `chat.gateway.ts`, `config/env.ts`, `withdrawals/*` |

**Verification:** `pnpm -r typecheck` clean · backend unit **219/219** · shared **16/16** · backend lint clean ·
migration `0030` up/down reversible · env hard-stops covered by 24 tests.

## Deferred (scoped, lower priority — not launch-blocking)

- **#3 admin TOTP step-up on KYC-approve / user-freeze** — these are RBAC-gated + audit-logged today
  and, in production, ANY sensitive admin action already fails closed without enrolled 2FA
  (`ADMIN_2FA_REQUIRED`). Adding a per-action step-up needs the frontend `TotpActionDialog` wired on
  the KYC + users admin pages (+ `totpCode` on 2 request schemas) — a full-stack change to do and
  E2E-verify as its own small task, not crammed here.
- **Uploads EXIF-strip + AV scan (B28)** — needs the `sharp` (native) and `clamscan` deps installed
  (approved in Documents/02) + a running **ClamAV daemon**. Infra + dependency work; tracked in the
  master audit as B28. Current mitigations: SVG banned, magic-byte sniff, size caps, private buckets,
  short-TTL presigned URLs, `Content-Type` from the sniffed type.
- **Query-param `.strict()`** — unknown query params are stripped (standard, safe); rejecting them is
  cosmetic and risks breaking clients that append tracking params. Accepted as-is.

## Unchanged blockers to holding real customer funds (from the master audit)
Signer service (Host B) does not exist · offsite backups + tested restore · monitoring/vault/host
hardening · external pen-test · legal entity + crypto licensing. **Deposits work; withdrawals cannot
execute until the signer exists.**
