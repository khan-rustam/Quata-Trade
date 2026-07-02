# risk

Deterministic risk scoring for login / trade-open / withdrawal events (Documents/06 "risk").

- **Purpose:** `RiskService.scoreLogin/scoreTradeOpen/scoreWithdrawal` compute a 0–100 score
  from pure, explainable rules (`risk.rules.ts`): velocity (Redis INCR counters with DB
  fallback), amount near KYC-tier limit, account age < 24h, unseen device fingerprint.
- **Invariants:** NO LLM calls, ever; config-driven thresholds; every call persists a
  `risk_events` row with a flags object naming each triggered rule; score ≥ 70 escalates
  (outbox `risk.flagged`); score ≥ 90 auto-freezes the user (active → frozen) with a
  hash-chained audit row + outbox `user.frozen` — all in one transaction.
- **Who may call it:** auth (login), trades (open), withdrawals (request). No HTTP
  endpoints — the admin module reads `risk_events` directly.
