# admin

RBAC-guarded operations console (Documents/06 "admin + treasury"; matrix in `admin.rbac.ts`, tested in `admin.integration.spec.ts`).

**Purpose:** admin login (argon2id + MANDATORY TOTP, generic failures, strict rate limit), dashboards (KPIs/users/trades/withdrawals/KYC/disputes), user freeze/suspend/restore, KYC review, withdrawal approve/reject (dual approval ≥ threshold), dispute resolution, kill switches, whitelisted settings edits, audit-log reads, and the ONLY manual money endpoint (`POST /admin/ledger/adjustment`, SUPER_ADMIN + TOTP + reason).

**Invariants:**
- No money or trade-state writes here — everything delegates to LedgerService / EscrowService (via DisputesAdminService) / WithdrawalsService / KycAdminService. KYC has no auto-approve path.
- Every action (including every login attempt outcome) lands in the hash-chained `audit_logs`.
- Sensitive actions (withdrawal decisions, kill switch, settings, adjustments) re-verify the admin's OWN TOTP; failures are generic and never logged with the code.
- v1 admins have NO refresh tokens: 10-minute JWTs (`{sub, typ:"admin", role}`), re-login on expiry (Deviations Log). Login lockout (5 fails/15 min/email) is in-memory per process, on top of the route throttle.
- GET `/admin/kill-switch` is treated as a dashboard read (all 7 roles); the toggle is SUPER+FINANCE. Withdrawal `reject` maps to the matrix's "Approve withdrawal" row (SUPER+FINANCE).

**Who may call it:** admin JWTs only (RolesGuard blocks `typ=user` everywhere); `POST /admin/auth/login` is the single `@Public()` route. `seed-admin.ts` (tsx script) bootstraps the first SUPER_ADMIN and prints its otpauth URL once.
