# V1 Security Remediation — tracker

Source: the V1 Security Requirements compliance audit (2026-07-03). This tracks the fixes for the
launch-blocking gaps. Full matrix (96 controls) lives in the audit artifact.

## Client decisions
- **DEFERRED (add once the platform is otherwise 100% ready, before real money):**
  - **Mandatory admin 2FA** — 2FA (TOTP) is fully built but optional; making it mandatory + hard-failing
    the admin step-up when 2FA is absent is deferred per the client.
  - **Mandatory escrow-release step-up** — seller confirm-release currently enforces TOTP/PIN only if the
    seller has them set; making it mandatory depends on the same 2FA-enrollment work. Deferred with the above.
  - *(Both are recorded so they are not forgotten — they remain launch-blockers for real money.)*

## Environment note
This dev sandbox has **no Docker**, so the **integration / audit-gate test suite (Testcontainers) cannot run
locally** — it runs in CI (`.github/workflows/ci.yml`). Money-path changes here are verified by `tsc` + ESLint
+ unit tests locally and **must be green in CI before shipping to real money** (CLAUDE.md money-path rule).

## Done so far (committed + pushed)
- ✅ **Item 1** — risk engine wired (login / trade-open / withdrawal); `risk_events` + alerts + admin counter now live. tsc/lint/unit green.
- ✅ **Item 2** — ops/security alert delivery (`AlertsService` → webhook; reconciliation emits an event; risk/kill-switch/ledger-adjustment paged).
- ✅ **Item 6a** — env production hard-stops (dev master key / testnet / missing xpub rejected) + unit tests.
- ✅ **Item 7** — `scripts/backup-db.sh` (encrypted) + `Documents/ops/` DR / BCP / incident-response runbooks.
- ✅ **Item 3** — withdrawal address whitelist (`withdrawal_addresses`, cooldown) + `withdrawal_hold_until` set on password-reset / 2FA-enable; enforced in `withdrawals.request`. Integration coverage in CI.
- ✅ **Item 4a** — AML / sanctions / wallet-blacklist screening: `blocked_addresses` + deterministic `ScreeningService`; **outbound** withdrawal destinations screened at whitelist AND at spend time (`aml.hit` alert, generic 403); compliance API (`/admin/screening/addresses`, SUPER+COMPLIANCE). Integration spec in CI.
- ⏳ **Remaining (money-path → verify in CI):** 4b AML inbound (deposit-source screening) · 5 on-chain reconciliation · 6b at-rest KYC/PII encryption.

## Fixes (in progress)

| # | Gap | Approach | Status |
|---|---|---|---|
| 1 | **Risk engine unwired** | Inject `RiskService` and call `scoreLogin` (auth.service, before session), `scoreTradeOpen` (trades.controller), `scoreWithdrawal` (withdrawals.controller) — fail-open; auto-freeze (score ≥ 90) then blocks money ops via the existing "not active" guards. Populates `risk_events`, `risk.flagged`/`user.frozen` outbox, and the admin risk counter. | **wired — CI-verify** |
| 2 | **No alert delivery** | Deliver reconciliation-mismatch, `risk.flagged`, `user.frozen`, and privileged admin (`admin.kill_switch`, `ledger.adjustment`, freeze, withdrawal-approval) events to an ops/security channel (email + webhook) via the notify pipeline. | **done — CI-verify** |
| 3 | **No address whitelist / no credential-change cooldown** | Saved-address allowlist (new table + endpoints), hold on newly-added addresses, and a `withdrawal_hold_until` set on password reset + 2FA change; enforced in `withdrawals.request`. | **done — CI-verify** |
| 4 | **No AML/sanctions/blacklist screening** | Blacklist/sanctions table + deterministic screening of withdrawal destinations (4a — done) and deposit senders (4b — pending); compliance-managed. | **4a done — CI-verify; 4b pending** |
| 5 | **Signer + on-chain↔ledger reconciliation** | Add on-chain hot-wallet↔ledger comparison to the reconciliation job + a remote-withdrawal confirmation poller. **Signer itself is human-written (Host B) — scaffold/contract only, never generated here.** | pending |
| 6 | **At-rest encryption thin + no vault** | Encrypt KYC/PII at rest; add prod hard-stops in `env.ts` (reject dev `MASTER_ENCRYPTION_KEY`, require `WALLET_XPUB`, force `TRON_NETWORK=mainnet`). Vault = ops (document). | **6a done; 6b pending** |
| 7 | **Backups / DR / BCP / pentest** | Encrypted `pg` backup script + restore drill; DR, BCP, and incident-response runbooks. HSM + external pentest = ops (document). | **done — CI-verify** |

## Item 4 — detail (4a done, pending CI)
- **`blocked_addresses`** (migration 0012): one deterministic blocklist (`sanctions` / `blacklist` / `manual`),
  `UNIQUE(asset,address)`, partial index on active rows, explicit `GRANT` to the app role.
- **`ScreeningService`** (deterministic, no external calls, no LLM — Documents/12 risk rule):
  `check()` (read), `assertAllowed()` (outbound chokepoint: on a hit records an `aml.hit` outbox event →
  `AlertsService` pages the on-call, then throws `BlockedAddressError`), `block()/unblock()/listBlocked()`.
- **Outbound enforcement** in `withdrawals.service`: destination screened both when **whitelisted** (`addAddress`)
  and **at spend time** (`request`, before the money tx — an address can be listed *after* being whitelisted).
  The controller maps `BlockedAddressError` → a **generic 403** ("not permitted"): the specific match reason is
  logged + paged to compliance, never disclosed to the user (no sanctions-list enumeration).
- **Compliance API** `/admin/screening/addresses` (GET/POST/DELETE), guarded by `RBAC.kycReview`
  (SUPER + COMPLIANCE). Typed in `shared` (`zBlockAddressRequest` etc.) + client methods. Frontend admin UI is a
  follow-up (owned by the admin-console work).
- **4b (pending):** inbound deposit-source screening — capture the TRC20 `from` address and, at the deposit
  **credit** chokepoint (`DepositConfirmationService`), hold + `aml.hit` instead of crediting when the sender is
  blocked. `Trc20Transfer.from` is already available; needs `deposits.from_address` + an `aml_hold` flag.
- Screening lives in `modules/screening/` (`@Global`), imported by both the API (`app.module`) and the worker
  (`worker.module`, for 4b). The compliance controller is inert under the worker's application context.

## Item 1 — detail (done, pending CI)
- `RiskService` was fully built + unit-tested but injected nowhere. Now wired at:
  - `auth.service.ts` login → `scoreLogin` (before `issueSession`, so new-device detection works).
  - `trades.controller.ts` `open()` → `scoreTradeOpen` (controller-layer to avoid a money-path service ctor change).
  - `withdrawals.controller.ts` `request()` → `scoreWithdrawal` (same).
- All three are **fail-open** (`.catch(() => undefined)`): a scoring outage never blocks a legitimate action;
  an auto-freeze that *does* commit is enforced by the existing account-status guards.
- Modules `auth`, `trades`, `withdrawals` now import `RiskModule`. `auth.integration.spec` passes a stub RiskService.
