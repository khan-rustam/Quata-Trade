# treasury

Read-only revenue and platform-position dashboards (Documents/06 "admin + treasury").

**Purpose:** `GET /admin/revenue` — fees earned today/this month/lifetime (UTC), summed from positive treasury legs of journals with reason `escrow_release_buyer` / `escrow_release_fee` / `withdrawal_fee`; `GET /admin/treasury/balances` — `platform_treasury`, `platform_pending_sweep` and `external` net position from `account_balances`.

**Invariants:**
- Never writes anything: balances are ledger-derived; revenue is a SUM over `ledger_entries` (append-only).
- All amounts are BIGINT strings on the wire; `external` may be negative (net on-chain position), fee revenue never is.
- `escrow_release_buyer` is included because EscrowService books the trade fee as a treasury leg inside that journal (Deviations Log).

**Who may call it:** admin JWTs with any of the 7 roles (view-dashboards row of the RBAC matrix, enforced via `@Roles` + RolesGuard).
