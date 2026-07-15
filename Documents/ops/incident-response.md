# Incident Response Runbook

Owner: client entity (operator). Scope: QuataTrade v1 (app host + isolated signer host).
Legal duty: Cameroon **Law No. 2024/017** on personal data — a personal-data breach must be
notified to the authority (and affected users where required) **without undue delay**.

> Fill the `[[…]]` placeholders (on-call names/numbers, authority contact, entity) before launch.

## 0. On-call & severity
- **On-call:** [[primary]] / [[backup]] · Escalation to [[owner]] for SEV-1.
- **SEV-1** — funds at risk / ledger corruption / key compromise / active breach. Page immediately.
- **SEV-2** — degraded money path (deposits/withdrawals stalled, signer down). Page in business hours.
- **SEV-3** — non-money degradation (chat, notifications, UI).

## 1. Detect
Signals that should reach a human:
- **AlertsService** delivers to **webhook** (`ALERT_WEBHOOK_URL`), **email** (`ALERT_EMAIL_TO`, criticals),
  **Telegram** (`TELEGRAM_BOT_TOKEN`+`TELEGRAM_CHAT_ID`, all severities), and the admin **Alerts page**.
  Events: `reconciliation.mismatch`, `reconciliation.reserve_shortfall`, `reconciliation.job_error`,
  `withdrawal.broadcast_stale`, `aml.hit`, `user.frozen`, `risk.flagged`, `admin.kill_switch`, `ledger.adjustment`.
- **Ledger reconciliation** (10-min cron) auto-pauses withdrawals on any cached-vs-ledger mismatch, and
  now alerts if the reconciliation job itself fails to run.
- **Audit-chain verify:** `GET /api/v1/admin/audit-logs/verify` → `{ ok:false }` means tampering.
- **Health probes:** point uptime monitoring at `/ready` (503 on core-dep down); `/status` gives the full
  infra snapshot (db/redis/storage/wallet/disk/memory). **A crash-looping API/worker (high PM2 restart
  count) is an incident** — usually an invalid `backend/.env` value failing boot validation.
- **pino error logs** (pm2), TronGrid circuit-breaker warnings.

## 2. Triage & declare
Confirm scope in ≤10 min: which money path, how many users/funds, is it spreading. Declare severity,
open an incident channel, assign an Incident Lead + Scribe. Start a timeline (Scribe logs every action UTC).

## 3. Contain (the levers — all admin, all audited)
- **Halt withdrawals** (also halts the signer pipeline): `POST /api/v1/admin/kill-switch` → `withdrawals_paused=true`.
- **Halt trading:** same endpoint → `trades_paused=true`.
- **Freeze a user:** `POST /api/v1/admin/users/:id/freeze` (blocks their trades/withdrawals/transfers).
- **Suspected key compromise:** halt withdrawals, power down / disconnect the **signer host (Host B)**,
  rotate the hot key; cold keys are client-held hardware — invoke the key-holder.
- **Bad deploy:** `deploy.sh` auto-rolls back on failed health; else re-run to redeploy the prior commit.
- **Leaked secret:** rotate it in the vault, redeploy (`pm2 --update-env`), revoke sessions if auth-related.

## 4. Eradicate & recover
- Fix root cause. For ledger mismatch: do **not** hand-edit balances — investigate the journal, correct only
  via `POST /api/v1/admin/ledger/adjustment` (SUPER_ADMIN, TOTP, double-entry, audited).
- If data loss: restore per **disaster-recovery.md**, then `pnpm migrate` + audit-chain verify.
- Re-enable kill switches only after reconciliation is clean and the cause is confirmed fixed.

## 5. Notify
- **Breach of personal data:** notify [[data-protection authority]] without undue delay; notify affected
  users if there is a risk to them (Law 2024/017). Keep the decision + timeline in the incident record.
- Status-page + user comms for outages.

## 6. Post-mortem (within 5 business days)
Blameless. Timeline, root cause, impact, what caught it / what didn't, and concrete action items with owners
(esp. gaps this incident exposed in monitoring, alerting, or the money path). File under `Documents/audits/`.
