# Business Continuity Plan (BCP)

How QuataTrade keeps operating (or fails safe) when a dependency or host degrades. The guiding rule for a
custody platform: **degrade to safe, not to lossy** — halting money movement is always acceptable; risking
funds is not.

> Fill `[[…]]` (contacts, providers, SLAs) before launch.

## Single points of failure (v1) & mitigations
| SPOF | Impact | Mitigation / degraded mode |
|---|---|---|
| **Single-primary Postgres** | Total outage on loss | pgBackRest + tested restore (DR plan); consider a warm replica post-launch. RPO ≤ 5 min. |
| **Single app host** | API/web down | pm2 auto-restart + `deploy.sh` rollback; documented rebuild via HANDOFF.md. Consider a second host + LB later. |
| **Signer host (Host B)** | No withdrawals | Withdrawals pause automatically (kill switch); deposits/trades continue. Cold keys client-held. |
| **TronGrid (RPC)** | Deposits/withdrawals stall | Circuit breaker backs off; **wire `TRON_FALLBACK_RPC_URL`** (currently configured but unused) for failover. |
| **SMTP provider** | No email (OTP/verify/reset) | Emails stay queued + retried by `EmailSendJob`; switch `SMTP_*` to a backup provider. |
| **Redis** | Queues/rate-limits/velocity degrade | Rebuildable; risk velocity falls back to DB counts. Restart/replace; not a data-loss event. |
| **MinIO** | Uploads/KYC unavailable | Trading/withdrawals continue; KYC + proof upload paused until restored. |

## Degraded-mode operation (keep the safe parts up)
- **Withdrawals only impaired** → keep deposits + trading; `withdrawals_paused=true` until fixed.
- **Ledger integrity in doubt** → pause withdrawals immediately (reconciliation does this automatically), keep read-only surfaces up, investigate before anything moves.
- **Chain provider down** → deposits/withdrawals queue and resume; nothing is lost, only delayed.

## Communications
- Internal: incident channel + on-call ([[numbers]]). External: status page + in-app banner (maintenance route exists).
- Regulatory: personal-data breaches follow **incident-response.md** (Law 2024/017).

## Recovery priorities (in order)
1. **Ledger correctness** (no double-spend, balances = SUM of entries).
2. Custody safety (keys, signer isolation).
3. Withdrawals, then deposits, then trading, then ancillary (chat/notifications).

## Review
Exercise this plan + the DR restore drill at least [[quarterly]]; update after every SEV-1 post-mortem.
