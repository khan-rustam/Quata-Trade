# kyc

Manual-review identity verification (Documents/06 "kyc", 08 §F/§I).

- **Purpose:** validated document uploads (magic bytes, ≤5 MiB, SVG banned) into the private `kyc` MinIO bucket; tier submissions (strictly currentTier + 1, one PENDING at a time, keys must be caller-owned); status reads; admin queue + manual review; daily retention purge.
- **Invariants:** NO code path auto-approves — only `KycAdminService.review()` with an existing, active admin id changes `users.kyc_tier`/approves. Retention date is fixed at submit (`kyc_retention_days` setting); the purge job empties `files` but keeps the row. Every submit/review/purge/upload is hash-chain audit-logged; `kyc.submitted`/`kyc.reviewed` go through the outbox in the same tx.
- **Who may call it:** `KycController` (authenticated users) → `KycService`; the admin module (SUPER_ADMIN | COMPLIANCE_ADMIN per RBAC) → `KycAdminService`; the worker → `KycRetentionJob` (@Cron daily, needs `ScheduleModule`).
