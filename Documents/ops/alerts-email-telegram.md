# QuataTrade — Alerts, Email & Telegram Configuration

The alert **code is built and dormant** — it activates the moment these env vars are set on the VPS.
Everything below goes in **`backend/.env`** on the app host (secrets never in Git). After editing,
reload: `pm2 reload quatatrade-api quatatrade-worker`.

## 1. Telegram (§4)  — bot `@QuataAlertsBot`
```dotenv
TELEGRAM_BOT_TOKEN=<paste the BotFather token here — on the VPS only>
TELEGRAM_CHAT_ID=<your numeric chat id — on the VPS only>
```
> The bot token and your numeric chat id are personal identifiers — keep them in the VPS `.env`,
> never in the repo. (To find your chat id: message the bot, then open
> `https://api.telegram.org/bot<token>/getUpdates` and read `message.chat.id`.)
- Both empty = Telegram disabled. Set both = all alert severities push to the chat.
- To send to a **group**: add `@QuataAlertsBot` to the group, then use the group's (negative) chat id.
- **Test:** trigger a benign alert (e.g. toggle a kill switch in `/admin/settings` and back) — the
  `admin.kill_switch` alert should arrive in Telegram.

## 2. Email via Hostinger SMTP (§5)
⚠️ **The app variable names differ from the panel labels you pasted.** Use these EXACT names:
```dotenv
SMTP_HOST=smtp.hostinger.com
SMTP_PORT=465
SMTP_SECURE=true
SMTP_USER=alerts@quatatrade.com          # NOT SMTP_USERNAME
SMTP_PASS=<the mailbox password — on the VPS only>   # NOT SMTP_PASSWORD
SMTP_FROM=QuataTrade Alerts <alerts@quatatrade.com>
ALERT_EMAIL_TO=<inbox you actually watch, e.g. your Gmail or ops@quatatrade.com>
```
- `ALERT_EMAIL_TO` is where **CRITICAL** alerts are emailed (comma-separated for several recipients).
- **Test:** from the server, `pm2 logs quatatrade-api` while triggering a critical alert; the email
  send is logged. Or send yourself a test from `/admin/alerts` if that action exists.

## 3. Gmail push for the alerts mailbox (§6)
Goal: your **Gmail** rings instantly when `alerts@quatatrade.com` receives mail. Two parts:

### (a) Instant push — forward alerts@ → your Gmail (recommended)
In **Hostinger hPanel → Emails → your domain → Forwarders** (or Email Accounts → Forwarding):
- Create a forwarder: `alerts@quatatrade.com` → `your-name@gmail.com`.
- Now anything delivered to `alerts@` is pushed to Gmail immediately (Gmail's normal push/notifications apply).
- If you set `ALERT_EMAIL_TO=alerts@quatatrade.com`, critical alerts land in alerts@ → forwarded → Gmail push.
  (Or set `ALERT_EMAIL_TO` directly to your Gmail — either works; forwarding keeps one canonical inbox.)

### (b) Reply/send as alerts@ from Gmail (optional)
Gmail → **Settings → Accounts and Import → "Send mail as" → Add another email address**:
- Name: `QuataTrade Alerts`, Email: `alerts@quatatrade.com`, uncheck "Treat as alias" if you prefer.
- SMTP server: `smtp.hostinger.com`, Port `465`, `SSL`, Username `alerts@quatatrade.com`, the mailbox password.
- Gmail sends a verification code to alerts@ (which forwards to you) → confirm.

> IMAP (for reading the full mailbox in a client): `imap.hostinger.com:993` SSL/TLS. Gmail's
> "Check mail from other accounts" only supports **POP** and **polls** (not instant) — so use the
> **forwarder** in (a) for instant push, not POP import.

## 4. Redundancy (recommended)
Also add a Telegram notifier **inside Uptime-Kuma** (same bot) pointed at `/ready`, so even if the app
process is down (and thus can't send its own alert), Uptime-Kuma still pages you that it's unreachable.

## Channel summary
| Channel | Env | Fires on | Notes |
|---|---|---|---|
| Admin Alerts page | — (always on) | all events | `/admin/alerts`, persisted |
| Webhook | `ALERT_WEBHOOK_URL` | all severities | Slack/Discord |
| Email | `SMTP_*` + `ALERT_EMAIL_TO` | CRITICAL | Hostinger SMTP |
| Telegram | `TELEGRAM_BOT_TOKEN` + `TELEGRAM_CHAT_ID` | all severities | `@QuataAlertsBot` |
