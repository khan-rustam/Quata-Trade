---
name: quatatrade-admin-rbac
description: Admin, RBAC, audit-log and kill-switch rules for QuataTrade. Use when touching backend/src/modules/admin, any admin route or guard, the audit log, dual approval, ledger adjustment, kill switches, or app/admin in the frontend. Triggers on admin, RBAC, role, permission, guard, audit log, hash chain, dual approval, kill switch, freeze, impersonate, super admin.
---

# QuataTrade Admin & RBAC Rules

Authority: `Documents/08-security-checklist.md` §E/§G + `Documents/06-backend-modules.md`.
Roles are defined in `shared/src/constants.ts` (`ADMIN_ROLES`); the matrix the frontend
mirrors is `frontend/lib/admin-rbac.ts`; enforcement is server-side guards.

## The server decides, always

`frontend/lib/admin-rbac.ts` decides which nav links to **show**. It is not a security
control — a hidden route must still 403 when reached directly, and there is a comment in
that file saying exactly this. Keep it true:

- Every admin route has a server-side guard checking the role from the session, never
  from a client-supplied value, header, or socket payload.
- When you add an admin capability, you add it in **three** places: the server guard,
  the `RBAC` map, and a test asserting each role is allowed **and** each other role is
  denied. A capability with no deny-test is untested.
- Least privilege is the default. These are `SUPER_ADMIN`-only and must stay that way:
  `ledgerAdjustment` (the only manual money endpoint), `manageWalletConfig` (key
  ceremony), `manageAdmins`, `manageReleases`.

## Separation of duties

- **TOTP 2FA is required for every admin action**, not just login (§08 §E).
- **Large withdrawals require two different admins.** The threshold is editable in
  settings and there is a DB trigger backstop (`0017_dual_approval_trigger.ts`) — the
  app gate and the trigger must always agree. If you change one, change both, and read
  the comment at the top of that migration first: a mismatch previously made an approval
  band un-committable. A single admin must never be able to release a large withdrawal,
  including by approving twice.
- Ledger adjustments require `SUPER_ADMIN` **plus a mandatory reason** plus an audit row.
- KYC approval is manual-only and never auto-escalates (`quatatrade-kyc-risk`).

## The audit log

Append-only and **hash-chained** (`prev_hash`/`row_hash`), ordered by a monotonic append
sequence — not by `created_at`, which forks the chain under concurrent inserts and makes
`verifyChain()` report false tampering. That fix is `0008_audit_chain_seq.ts`; do not
reintroduce timestamp ordering.

- Every admin action writes an audit row: who, what, which resource, before/after where
  meaningful, and **why** when a reason is required.
- Reads of sensitive data are audited too, not only writes — KYC document views in
  particular.
- The audit viewer is read-only. There is no edit or delete path, and no admin role that
  gets one.
- A tamper test must detect an edited row.

## Kill switches

Global withdrawal pause, global trade pause, and per-user freeze. All are admin-triggered,
all are logged, and all must be **tested to actually halt the queues** — a flag that the
BullMQ workers do not consult is not a kill switch. Each needs a confirm step in the UI
stating what will stop.

## Admin UI

Follows the same rules as the rest of the frontend: tokens only, both themes, **both
languages** (admins read French too), 44px targets, tables that collapse or scroll inside
their own container (`quatatrade-responsive`). Destructive and money actions name the
exact consequence and amount, and require confirm + 2FA. Never render "all clear" for
data the console failed to load — an empty state and an error state are different things.

## NEVER do

- NEVER gate an admin capability on the client only, or trust a role from a request body,
  header, query param, or socket payload.
- NEVER add an admin path that mutates balances outside `LedgerService.postJournal()`.
- NEVER let one admin identity satisfy both approvals on a large withdrawal.
- NEVER add an UPDATE or DELETE path to the audit log, or reorder the chain.
- NEVER add an admin action without an audit row, or with a generic "admin action" label
  that does not identify the resource.
- NEVER add impersonation or "act as user" without an explicit human decision, a
  Deviations Log entry, and an audit trail — it is a full account-takeover primitive.
- NEVER expose a kill switch, ledger adjustment, or wallet-config endpoint without 2FA
  and a deny-test for every role that must not reach it.
