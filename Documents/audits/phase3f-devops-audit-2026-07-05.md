# Phase 3F — DevOps / Operations Audit

**Date:** 2026-07-05 · **Method:** parallel SRE readers over deploy.sh/PM2, infra/secrets/TLS, backups/DR/monitoring, and scaling/resilience; scored synthesis. CI/CD was analyzed in the scoring pass (one CI-area reader returned a stub); Docker is covered from the compose file directly. All findings cite real paths/lines.
**Verdict:** **NOT operationally ready to run real money.** Acceptable only for the current testnet/staging posture (`SIGNER_MODE=mock`, `NODE_ENV=staging`, TRON shasta) — which is what the box actually runs today. The defining pattern across every area: **the application code is disciplined; the operational layer is a stub.** The runbooks describe a mature custody-grade setup; almost none of it is implemented.

## Scores (100 = HA with tested failover, drilled PITR DR, full observability + paging, vaulted secrets, CI-gated CD)

| Dimension | Score | One-line |
|---|---|---|
| **CI** | **68/100** | The bright spot — but decoupled from delivery, so its gates don't govern production |
| **Deploy** | **45/100** | Mechanically careful script; fails the custody bar on migrate/rollback/health |
| **Resilience** | **27/100** | Single-node everything; money-path worker is an unmitigated SPOF |
| **Monitoring/DR** | **17/100** | "Docs excellent, implementation stub" — blind and un-paged on a fund-holding system |

Severity tally: **4 Critical · 19 High · 20 Medium · 10 Low · 4 Info.**

## CRITICAL findings (4)

**F-C1 · Application secrets — including the KYC/TOTP `MASTER_ENCRYPTION_KEY` — sit in plaintext `backend/.env` on a shared VPS.** No Infisical/SOPS despite Documents/02 §Auth spec'ing it and Documents/08 §68 requiring it. That 32-byte key wraps every KYC file key and TOTP secret; on a **shared CloudPanel box**, any co-tenant compromise or a path-traversal/LFI bug in a neighboring app yields the key that decrypts all KYC PII and can mint TOTP-bypassing tokens. **The single highest-leverage custody risk.** Fix: load the master key (and JWT/DB/SMTP secrets) from a vault at process start before real-money launch.

**F-C2 · Backups are local-only on the same box; offsite is commented out; never restore-drilled.** `backup-db.sh` writes only to `/var/backups/quatatrade` on the same host as Postgres; the restic/S3/rclone offsite lines are all commented out; the cron exists only as a header comment (not installed by any repo automation); the AES key is co-located with the ciphertext. **A backup that has never been restored is not a backup** — zero restore-drill records exist in `Documents/audits/`. For a double-entry custody ledger, **loss of the single VPS destroys the money-of-record AND its only backups simultaneously**, with no path to reconstruct balances. Fix: enable one offsite target (different provider/region), key off-host, and run + record one restore drill before launch.

**F-C3 · The documented RPO ≤5min (pgBackRest continuous WAL) does not exist — real RPO is ~24h with no PITR.** No pgBackRest stanza/config/WAL archiving exists anywhere; the only backup is the nightly logical `pg_dump`. On-chain deposits/withdrawals confirmed after the last dump are lost from the ledger while the funds moved on-chain — an unreconcilable custody gap. Fix: build pgBackRest WAL archiving to meet the stated RPO, or correct DR/BCP to state the real number and shorten cadence. **Do not launch real money against a 24h RPO.**

**F-C4 · The web origin (`quatatrade.com`) and cdn ship no HSTS, no CSP, and leak `x-powered-by`.** `next.config.ts` defines no `headers()`; only the API has helmet HSTS+CSP. The origin serving login/registration forms is **SSL-strippable on first visit and has no CSP** on the pages that collect passwords and 2FA. (Confirms Phase 1 C5 with the root cause.) Fix at the nginx edge: HSTS + CSP (report-only first) + `frame-ancestors` on apex/www/cdn; `poweredByHeader:false`.

## Deploy pipeline (score 45)

`deploy.sh` is unusually careful for a hand-rolled script — self-reexec from a throwaway copy (so `git reset --hard` can't corrupt it mid-run), PM2 driven only by pinned app names (**blast radius to the co-tenant apps BellaBliss:4000 / other:3000 is well contained**; web pinned to 3800), `backend/.env` required. But the custody-critical path has three linked defects:

- **F-H1 · No pre-deploy DB backup before running ledger migrations.** A buggy/destructive migration has, at best, a ~24h-stale, never-verified dump.
- **F-H2 · Forward-only rollback never reverts migrations** — `git reset --hard PREV_COMMIT` + a comment "migrations are additive," on an *unenforced* assumption. A destructive or partially-applied migration leaves old code running against a schema it was never written for. (Kysely commits each migration in its own transaction, so a mid-batch failure leaves the DB ahead by N-1 while code rolls back.)
- **F-H3 · A failed health check does NOT roll back** — the ERR trap is disarmed (`deploy.sh:196`) immediately before the health checks, which only `exit 2`. A crash-looping release stays live. **This directly contradicts `incident-response.md:33`, which tells on-call "deploy.sh auto-rolls back on failed health" — a trust hazard worse than the missing behavior.**

Plus: fork/1-instance PM2 reloads are **not zero-downtime** (kill/restart, dropping in-flight requests + websockets); no graceful-drain window (~1.6s default SIGKILL can hard-kill the worker mid money-job); no deploy concurrency lock; `git reset --hard` silently discards on-box tracked hotfixes; **CI-green never gates the deploy** (deploy pulls `origin/main` and rebuilds with no proof the SHA passed CI).

## Infra / secrets / TLS

Beyond F-C1/F-C4: **F-H4 · API binds `0.0.0.0`** (`main.ts:54`) on the shared box — reachable off-nginx (bypassing TLS/HSTS/edge rate-limits) unless a host firewall blocks it, and **no firewall is codified anywhere**. **F-H5 · The read-only MCP DB role is provisioned in production** by migration `0007` with a **public default password** (`readonly_dev_only` if `QT_MCP_DB_PASSWORD` unset) and `SELECT` on ALL tables incl. KYC/PII, ledger, and session-token hashes — a standing exfiltration path, especially combined with F-H4. **`.env.example` defaults `PORT=4000`/`WEB_ORIGIN=:3000`** collide with the co-tenant apps with no prod guardrail. **nginx/TLS config is not version-controlled** (all edge security lives in hand-edited CloudPanel vhosts — unauditable, lost on rebuild — which is *why* F-C4 exists). **Host hardening** (ufw/fail2ban/unattended-upgrades/SSH-key-only) is spec'd with **zero in-repo automation or verification**. `docker-compose` publishes **Redis with no password and MinIO with dev creds on `0.0.0.0`** (dev-only, but poor hygiene). Staging is exempt from the prod hard-stops, so a staging box copied from `.env.example` exposes Swagger + debug logging. Dependabot/Socket.dev/husky are spec'd but absent.
*(Positive: the WireGuard/mTLS signer isolation is modeled correctly and kept out of the repo — `SIGNER_MODE=mock` is forbidden in prod, `WALLET_XPUB` required. The consequence is that production cannot boot until Host B is built — the known launch gate.)*

## Monitoring / DR (score 17 — the weakest dimension)

- **F-H6 · Alerting silently no-ops in production.** `ALERT_WEBHOOK_URL` defaults to `""` and, unlike the 7 other production hard-stops in `env.ts`, has **no boot guard** — `AlertsService.send()` returns early when empty. So **ledger-mismatch, on-chain reserve shortfall (an insolvency signal), AML/sanctions hit, kill-switch flip, and risk auto-freeze all reach only unwatched pm2 logs.** Nobody is paged for the exact custody events the system was built to detect. (The plumbing reconciliation→outbox→relay→alerts is correctly wired — only delivery config is missing.) Fix: add `ALERT_WEBHOOK_URL` to the prod hard-stops + configure a real pager + verify a synthetic `reconciliation.mismatch` reaches it.
- **F-H7 · The entire monitoring stack (Prometheus/Grafana/Uptime-Kuma/GlitchTip) is unbuilt** — no config anywhere; no metrics endpoint; no external uptime probe; no on-call. Operators learn of failures from users.
- **F-H8 · `/health/ready` is a false-green stub** — it checks only Postgres + kill-switches and returns `ok`, while Documents/06 specifies pg/redis/minio/RPC/chain-lag/reconciliation. A Redis/MinIO/RPC outage still reports healthy to any probe.
- **F-H9 · MinIO (KYC/PII, dispute evidence, proofs, chat) has NO backup at all** — `backup-db.sh` is Postgres-only. Loss permanently destroys KYC docs (a regulatory retention obligation) and dispute/chargeback evidence.
- **F-H10 · The public `/status` page is hardcoded "All systems operational"** — it will actively lie during any incident (including a reconciliation-triggered withdrawals pause), which is worse than no status page. (Confirms Phase 1 H3.)
- **F-H11 · Cold-wallet key backup/redundancy is undefined** — 95%+ of custody on a single client-held hardware device with no Shamir/SLIP-39/multisig/geo-redundancy; "recover via the key-holder ceremony" is not a recovery plan against loss/fire/death-of-key-holder.
- **F-H12 · The incident-response runbook is not executable** — on-call, breach-notification authority, and RTO are all `[[placeholders]]`. When an alert eventually fires there is no one named to page and no authority for the Law-2024/017-mandated breach notification.
- **Mediums:** no backup dead-man's-switch (a silent backup failure is discovered at restore time); backup key + DB password exposed inline in the documented crontab on a shared box; reserve-shortfall detection is alert-only, off by default (`WALLET_HOT_ADDRESS` blank), and shares the disabled webhook.

## Resilience / scaling (score 27)

Single shared VPS, single PM2 fork process per app, no HA/failover. **The whole money pipeline — escrow-expiry refunds, deposit scan+credit, withdrawal pipeline, 10-min ledger reconciliation, outbox→alert relay — runs as in-process `@nestjs/schedule` crons in ONE worker: an unmitigated SPOF** (no BullMQ despite the docs; unsafe to run a second instance — jobs claim rows without cross-process guards; corroborates 3A-H4). `max_restarts:10` + no external watchdog means a crash-loop becomes a permanent silent "errored" outage that (given F-H6) pages nobody. API pinned to one instance with in-memory throttler + in-memory Socket.IO adapter + per-process settings/kill-switch cache (Redis wired but unused), so scale-out is impossible without multiplying rate limits and splitting chat/kill-switch state. Single Postgres primary + single Redis, no replica, untested restore. A crash mid-withdrawal wedges funds in `SIGNING` with no auto-detection.

## CI (score 68 — strongest, but decoupled)

`ci.yml` does real work: gitleaks secret scan, frozen-lockfile install, shared-contract build, cross-workspace typecheck (enforces the FE/BE contract), any-ban lint on money paths as a hard fail, unit + property tests, Testcontainers PG16 integration tests, full build, and `pnpm audit --audit-level high` as a blocking gate, with concurrency cancel-in-progress. Held below the bar by: **no branch-coverage gate in CI** despite CLAUDE.md's 100%-branch requirement on ledger/escrow/fees; no SAST/CodeQL; no Dependabot/Socket.dev; CI lints backend only (frontend/shared unlinted — 3A); frontend typecheck skipped (3A); and — most importantly — **the pipeline is decoupled from delivery**: `deploy.sh` pulls `origin/main` with no proof the SHA passed CI, so the strong gates don't actually govern what reaches production. Docker (`docker-compose.yml`) is dev-only (prod is native PM2) but pins `minio/mc/clamav` to `:latest` (non-reproducible) and ships dev creds.

## Minimum gate to reconsider for mainnet custody

Vault the master key + add a prod boot hard-stop for `ALERT_WEBHOOK_URL`; enable + verify encrypted offsite backups (DB **and** MinIO) plus one recorded restore drill; add HSTS/CSP to the web origin; bind the API to `127.0.0.1` + codify the host firewall; stand up a real `/health/ready` + external uptime/paging + error tracking; add a pre-migrate DB snapshot and make health-check failure actually roll back (or fix the runbook); put the money-path worker on a durable queue with a watchdog; define cold-key redundancy; and fill the incident-runbook placeholders + establish on-call. Until then, **testnet only**.

*Full structured findings: workflow `wf_f2c12dff-879` journal. Cross-references: Phase 1 (HSTS/CSP, status page), 3A (worker SPOF, shared-DB), 3B (alerting/observability, stuck SIGNING), 3E (backup/restore of append-only tables), 3H (failure-mode synthesis).*
