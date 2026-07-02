---
name: quatatrade-security-gates
description: Audit-gate discipline for QuataTrade. Use when asked about audits, gates, merging or shipping money-path code, security review, launch readiness, or when a build phase is finishing. Emits/updates the gate checklist in Documents/audits/gate-N.md.
---

# QuataTrade Audit Gates

Authority: `Documents/05-build-phases.md` (gate definitions) + `Documents/08-security-checklist.md`
(the checklist items). Records live in `Documents/audits/gate-N.md`.

## Which gate applies

| Touching | Gate | §08 sections |
|---|---|---|
| ledger, fees, balances | 1 | A, B |
| auth, sessions, users | 2 | E |
| wallet, deposits, withdrawals, signer | 3 | D |
| offers, trades, escrow | 4 | B, C |
| disputes, chat, uploads | 5 | F |
| admin, RBAC, kyc, risk, notify | 6 | E (RBAC), G partial, I |
| launch prep | 7 | ALL re-run |

## Gate procedure (no exceptions)

1. Stop feature work for the phase.
2. Tick the relevant §08 items — each box is **a test that must exist**, not a claim.
   If a box has no test, write the test first or the gate fails.
3. Run: `pnpm typecheck && pnpm --filter @quatatrade/backend lint && pnpm test && pnpm test:integration`.
4. Write/update `Documents/audits/gate-N.md` with date + commit hash + per-item status,
   including any deviations awaiting sign-off.
5. A failed gate blocks the next phase. Review order = risk order:
   **signer > ledger > escrow > withdrawals > auth > everything else.**

## Standing must-not-fail items (check on EVERY money-path change)

- No `any` / unchecked casts in `ledger/ escrow/ fees/ wallet/ withdrawals/ deposits/ trades/` (ESLint hard-fails).
- No secrets/keys/mnemonics in repo, env-example, logs, or test fixtures.
- Every endpoint input zod-validated with a **strict** shared schema (unknown fields rejected).
- Every resource access owner-scoped (IDOR: return 404, never leak existence).
- Every admin/security action writes a hash-chained `audit_logs` row via `AuditService`.
- Idempotency on every money-moving operation; replay tests exist.
- Signer code is human-written only — Claude never generates `apps/signer`/Host B code
  (see `backend/SIGNER.md`); flag anything that pretends otherwise.
- KYC has no auto-approve path; risk rules deterministic, no LLM calls.

## Top sinks (from §08 — keep visible)

Mutable balance columns · floats for money · keys in .env/DB · crediting unconfirmed or
fake-contract deposits · dispute-release leaks · oversell races · trusting payment screenshots ·
IDOR · uncapped withdrawals · untested backups.
