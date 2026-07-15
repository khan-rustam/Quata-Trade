# QuataTrade — Operations Runbook

Practical day-to-day operations. Companion docs: [disaster-recovery.md](disaster-recovery.md),
[incident-response.md](incident-response.md), [secrets-inventory.md](secrets-inventory.md),
[wallet-key-ceremony.md](wallet-key-ceremony.md).

## Hosts & processes
- **Host A (app):** shared CloudPanel VPS. PM2 apps (QuataTrade only): `quatatrade-api`,
  `quatatrade-worker`, `quatatrade-web`, `quatatrade-minio`. **Never `pm2 restart all`** — the box
  runs other projects. Nginx proxies `quatatrade.com → 127.0.0.1:3800` (web); API binds `127.0.0.1`.
- **Host B (signer):** separate VPS, no inbound internet, reachable only via WireGuard from Host A.
  Human-managed (`backend/SIGNER.md`). Holds the hot key. **Not deployed from this repo.**

## Deploy
```bash
cd /home/Quata-Trade && bash deploy.sh
```
`deploy.sh` fetches `main`, installs (frozen lockfile), builds shared→backend→frontend, runs
migrations, then `pm2 startOrReload` **only** the three QuataTrade apps, and health-gates the result
(rolls code back on failure — DB migrations are additive and NOT auto-reverted).

## Health & status (added in the ops-readiness work)
| Endpoint | Use |
|---|---|
| `GET /live`, `GET /health` | Liveness — process is up (no dep checks). |
| `GET /ready`, `GET /health/ready` | Readiness — 503 if Postgres or Redis is down. Point the uptime monitor here. |
| `GET /status` | Full snapshot: db, redis, storage, wallet-derivation, disk, memory, kill switches (signer/queue are worker-scoped). |

Quick checks:
```bash
curl -s http://127.0.0.1:3800/../api/v1/health/ready   # via API port; expect {"status":"ok"}
pm2 logs quatatrade-api --lines 20                       # expect "Nest application successfully started"
pm2 status                                               # api/worker/web online, low restart counts
```
> ⚠️ A **high PM2 restart count** = crash-loop. Most common cause seen: an invalid value in
> `backend/.env` (env validation fails fast on boot). Check `pm2 logs <app>` for
> "Environment validation failed". Note dotenv does **not** override a var already in the process
> environment — if a bad value persists after editing `.env`, it's set in the shell/PM2 env.

## Alerts (ops paging)
Alerts fire from `AlertsService` (reconciliation mismatch, reserve shortfall, AML hit, auto-freeze,
kill-switch, stuck broadcast, job errors). Delivery channels — all **best-effort, never block flow**,
all **env-gated** (empty = disabled):
- **Webhook** (`ALERT_WEBHOOK_URL`) — Slack/Discord text.
- **Email** (`ALERT_EMAIL_TO` + Hostinger `SMTP_*`) — CRITICAL only, HTML.
- **Telegram** (`TELEGRAM_BOT_TOKEN` + `TELEGRAM_CHAT_ID`) — all severities.
- **Admin Alerts page** (`/admin/alerts`) — always persisted.

Enable Telegram: create a bot via **@BotFather**, put the token in `backend/.env` as
`TELEGRAM_BOT_TOKEN=…`, set `TELEGRAM_CHAT_ID=…` (your chat/group), `pm2 reload quatatrade-api quatatrade-worker`.
Test: trigger a benign alert or send a test from `/admin/alerts`.

## Kill switches (incident controls)
- **Admin UI:** `/admin/settings` → withdrawals pause / trades pause (TOTP step-up, audit-logged).
- **Automatic:** the reconciliation job pauses withdrawals atomically on any ledger cache↔SUM mismatch.
- Effect propagates within the settings cache TTL (~10s).

## Common tasks
- **Reset an admin password / 2FA** (DB, argon2id): see the account-recovery procedure with the maintainer.
- **Freeze a user:** `/admin/users/:id` → freeze (revokes their live sessions immediately).
- **Activate a production wallet xpub:** `/admin/wallet-config` (public xpub only; audit-logged).
- **Tune fees/caps/limits:** `/admin/settings` (no code change; audit-logged).

## Backups
Provisioning is pending (audit **B5**). Once live: daily/weekly/monthly encrypted off-site to the
secondary Hostinger account, integrity-verified, with a tested restore. Restore steps live in
[disaster-recovery.md](disaster-recovery.md).
