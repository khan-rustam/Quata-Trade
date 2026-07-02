# notify

Domain events → per-user notifications: in-app rows + SMTP email (Documents/06 "notify").

- **Purpose:** `NotifyService.dispatch(eventType, payload)` maps outbox events
  (user/deposit/withdrawal/trade/dispute/kyc) to recipients; trade events notify BOTH
  parties. Each recipient gets an `in_app` row (delivered immediately) and an `email` row
  (queued → nodemailer attempt; failure keeps it queued with attempts+1 — the notifications
  table doubles as the delivery log).
- **Invariants:** templates (`notify.templates.ts`, Handlebars, EN) never contain secrets,
  OTP codes, or full addresses; context is whitelist-built (`safeContext`); amounts appear
  only as display strings. Email failure never throws out of dispatch.
- **Who may call it:** the outbox relay job (`src/jobs/outbox-relay.job.ts`) drives dispatch;
  users hit `GET /api/v1/notifications` and `POST /api/v1/notifications/:id/read` (owner-scoped).
