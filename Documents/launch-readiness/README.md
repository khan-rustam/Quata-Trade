# QuataTrade — Launch Readiness Report

**Date:** 2026-07-03 · **Commit analysed:** `928cccf` (`origin/main`) · **Author:** Claude (4-agent audit)
**Scope:** P2P USDT-TRC20 custodial-escrow marketplace for Cameroon (EN + FR).

> This report is the honest, evidence-based answer to *"can we launch 100%?"*. Short answer: **no — not
> for real money yet.** The **software is ~85% built and genuinely high quality**, but taking real users'
> funds is blocked by a handful of hard gates that are **mostly legal/human, not code**. It is an
> excellent **testnet demo today**. See [`claude-handoff.md`](./claude-handoff.md) to continue the code work.

---

## 1. Verdict & scorecard

| Dimension | Built | Real-money ready | The gap |
|---|---|---|---|
| **Code / features** | ~88% | ~72% | Withdrawals can't complete in the UI; hard dependency on the external signer |
| **Security / money-path** | ~90% | ~60% | 5 of 7 audit gates unsigned (incl. crypto-critical Gate 3); admin 2FA not enforced; no external pen-test |
| **Legal / compliance** | ~80% pages exist | **~15–20%** | No legal entity, no crypto licence, no lawyer review, no French legal text |
| **Ops / launch** | runbooks written | ~40% | No live monitoring/alerting; backups local-only & never restore-tested; on-call blank; manual payment rails |

**Bottom line:** technically deployable and impressively engineered, but **not lawful or safe to take real
money today.** Realistic distance to a compliant real-money launch is **weeks-to-months**, and the critical
path is dominated by **legal + the signer + an external audit**, not by more coding. A **public testnet
beta** could run much sooner.

---

## 2. What is genuinely done (this is strong work)

- **Double-entry, append-only ledger** — the only writer is `LedgerService.postJournal()`; append-only is
  enforced at the DB with rules blocking even the owner (`backend/src/db/migrations/0002_ledger.ts`),
  zero-sum trigger, non-negative CHECK, idempotency keys, and a 10-minute reconciliation job that pauses
  withdrawals + pages ops on any cached-vs-recomputed drift. **Gate 1 PASSED.**
- **Escrow state machine** — `EscrowService` is the only mutator of `trades.status`; every transition is a
  guarded `WHERE status = from` UPDATE + `trade_events` + outbox in one tx, backstopped by a
  `trade_transitions` table + `BEFORE UPDATE` trigger. **Gate 4 core PASSED.**
- **Deposits** — real on-chain TRC20 scanning via TronGrid; exact canonical-contract match (fake-token
  rejection), confirmations before crediting, on-chain sender AML screening, tainted-source holds.
- **Withdrawals** — full pipeline (request → risk → approval → signer handoff → broadcast → confirm/refund),
  dual approval for large amounts (two different admins + DB CHECK), per-tx/daily/tier caps with an
  advisory-lock TOCTOU fix, TOTP + PIN, address whitelist with cooldown, 24h post-password-reset hold,
  AML screening at whitelist and spend time, and reverted-tx handling (settles only on on-chain SUCCESS).
- **Key isolation** — the API/worker hold **no** spending keys; deposit addresses derive from an
  account-level **xpub only** (a private xpub is rejected); signing is delegated to an external service;
  all **7 production boot hard-stops** are present in `backend/src/config/env.ts` (mock-signer, testnet,
  missing-xpub, SSE-off, Swagger-on, dev-key detection all refuse to boot in production).
- **KYC** — submit + magic-byte sniff + SVG/HTML ban; **no auto-approve** (only an active admin raises a
  tier); MinIO SSE-S3 at-rest encryption (required in prod); retention-purge job.
- **Admin** — full console (users, withdrawals, disputes, kyc, treasury, content, reports, settings,
  kill-switch, hash-chained audit log) with an RBAC matrix + step-up TOTP wired on money actions.
- **Contract-first everywhere** — one zod contract in `shared/`, a typed API client, whitelisting mappers.
- **Bilingual (EN + FR)** app + admin + marketing UI (legal pages are the exception — see §4).

---

## 3. Hard blockers, in the order to tackle them

### 🥇 1. Legal & regulatory — do this FIRST (contractual/human; gates everything)
- **No legal entity in the product** — Imprint (`/legal/imprint`) is entirely empty; the company block is
  seeded blank (`backend/.../migrations/0011_content.ts` → `legalName`, `registrationNo`/RCCM, address,
  phone all `""`; **no NIU field even exists** in the schema).
- **Crypto licence/authorisation is unresolved** — `Documents/15` states this *"determines whether launch
  is even permissible"* under CEMAC/COBAC. No licence or legal opinion is on file.
- **No lawyer review** — every legal page carries a "Draft — pending legal review" banner and version
  `0.1 (draft)`; Terms have no enforceable liability/indemnity/governing-law clauses.
- **Legal pages are English-only** — all legal text is hard-coded in `frontend/lib/legal-content.ts` with
  **no locale lookup**; French is legally expected in Cameroon and is a launch gate in `Documents/15 §D`.
- **The developer-protecting dev agreement (liability + indemnity) is unsigned** — a "before writing more
  code" item that is still open.

### 🥈 2. The signer + mainnet — no payouts are possible without it
- The real signer (isolated **Host B**, human-written) **does not exist yet**; `RemoteSignerService.
  signWithdrawal()` throws by design. In production (`SIGNER_MODE=remote` forced) **no USDT can leave
  custody** — every withdrawal fails into stuck-SIGNING/human reconciliation. Deposits (crypto-in) work.
- Needs: author + deploy the signer, mTLS/WireGuard transport, and the **cold-wallet key ceremony**
  (hardware wallets not yet provisioned). **Never generate signer code unattended (CLAUDE.md).**
- Confirm the box is actually on **mainnet** and not still `TRON_NETWORK=shasta`.

### 🥉 3. Security sign-off
- **Gates 2, 3, 5, 6, 7 are unsigned** (only `Documents/audits/gate-1.md` and `gate-4.md` exist, both with
  caveats). The crypto-critical **Gate 3** (withdrawals/reconciliation/"no key anywhere") and the launch
  **Gate 7** are not signed.
- **Money-path branch coverage ~84%**, below the mandated **100%** on `ledger/escrow/fees`; fault-injection
  tests for the serialization-retry and unique-violation race branches are missing.
- **No independent professional pen-test.**
- **Admin 2FA + escrow-release step-up are optional**, not enforced (`admin-auth.service.ts:135` no-ops when
  disabled) — explicitly recorded as real-money blockers.

### 4. Operations
- **No live monitoring/alerting** — `/status` is a static placeholder; `ALERT_WEBHOOK_URL` is unset (paging
  silently degrades to log-only). No Grafana/Prometheus/Uptime-Kuma/error-tracking.
- **Backups are local-only** (offsite line commented out in `scripts/backup-db.sh`) and **never
  test-restored**; no on-call rotation (runbook contact fields are blank).
- **Payment rails (MoMo/Orange/QuataPay) are 100% manual** — buyers pay off-platform and upload a receipt;
  every fiat confirmation and dispute is manual admin work (by design for v1, but a real staffing load).

---

## 4. Code-fixable vs human-only

**Code (a home Claude session can do — see `claude-handoff.md` for the how):**
1. Wire the **withdrawal address whitelist** into `/wallet/withdraw` (today the UI submits a free-form
   address and the backend rejects it — withdrawals are broken in the happy path).
2. Add the **admin KYC document viewer** (presigned image URLs) — reviewers currently see only a file count.
3. **Enforce admin 2FA + escrow step-up** (flip the optional guards + a prod hard-stop).
4. **French legal pages** (add a locale seam to `frontend/lib/legal-content.ts`).
5. Close **ledger/escrow/fees branch coverage to 100%** + fault-injection tests.
6. Minor: live rate feed (kills the hardcoded `≈ 650`), 2FA-disable endpoint, KYC OCR prefill.

**Human / client only (the real gatekeepers):** register the legal entity; obtain the crypto licence or a
lawyer's opinion; get all legal pages lawyer-reviewed in EN+FR; name a compliance officer/DPO; sign the dev
agreement; author + deploy the signer and run the key ceremony; flip to mainnet with capped limits;
commission an external pen-test; set up offsite backups + a tested restore; stand up monitoring/paging +
on-call; provision real SMTP + company float accounts.

---

## 5. Critical path to a compliant real-money launch

1. **Legal**: sign the dev agreement → register the entity → get the crypto licence/opinion → lawyer-review
   all legal pages → localise them to French → fill the company block (+ add the NIU field).
2. **Signer**: author + deploy Host B, key ceremony, mTLS; flip to mainnet with **low caps**.
3. **Security**: sign Gates 2/3/5/6/7 against green CI; close money-path coverage to 100%; external pen-test.
4. **Enforce** mandatory admin 2FA + escrow step-up.
5. **Ops**: offsite backups + tested restore; monitoring/uptime/error-tracking/pager; on-call rotation +
   filled runbooks; real SMTP + `ALERT_WEBHOOK_URL`.
6. **Then** flip the launch gate in `Documents/15 §D` and remove the legal-page draft banners.

Meanwhile you can run a **public testnet beta** to validate the product with users at zero real-money risk.

---

## 6. Sources

Cross-checked against the deployed code (`928cccf`), `Documents/05-build-phases.md` (audit gates),
`Documents/08-security-checklist.md`, `Documents/14-client-legal-and-public-pages.md`,
`Documents/15-launch-questions-and-status.md`, `Documents/audits/`, `HANDOFF.md`, and the
`security-review-2026-07-02.md` / `security-remediation.md` audit notes. The project's own self-assessment
("testnet ≈ 80% / mainnet ≈ 50%") is consistent with this report; the extra detail is the per-dimension
breakdown and the code-vs-human split.
