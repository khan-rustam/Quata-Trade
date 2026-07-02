# QuataTrade — Master Build Documentation

**Version:** 1.0 · **Date:** 2026-07-02 · **Owner:** Solo developer (you) · **Audience:** You + Claude Code

This is the single source of truth for building QuataTrade. Every Claude Code session must load `01-overview.md` plus the part relevant to the current task. Nothing gets built that isn't in these documents; anything that deviates gets written into `10-client-prompts-appendix.md` → Deviations Log.

## Document Map

| # | File | Purpose | Read when |
|---|------|---------|-----------|
| 01 | `01-overview.md` | What we're building, why, constraints, decisions already made | **Every session** |
| 02 | `02-tech-stack.md` | Definitive stack, exact libraries, versions, what is banned | Setup + adding any dependency |
| 03 | `03-architecture.md` | Modular monolith + signing service, repo layout, boundaries | Setup + creating any new module |
| 04 | `04-database-schema.md` | Full SQL: ledger, escrow state machine, all tables, constraints | Any DB or money work |
| 05 | `05-build-phases.md` | Phase plan: start/end points, audit gates, definition of done | Planning every feature |
| 06 | `06-backend-modules.md` | Module-by-module backend spec with rules | Building any backend module |
| 07 | `07-frontend-spec.md` | Screens, layouts, shared types, API contract discipline | Building any UI |
| 08 | `08-security-checklist.md` | Critical checkpoints — the "must not fail" list | Before merging money-path code; every audit gate |
| 09 | `09-testing-and-integration.md` | Test strategy, backend↔frontend integration verification, monitoring | Writing tests; end of every phase |
| 10 | `10-client-prompts-appendix.md` | Client's original prompts verbatim + deviations log | Scope questions; client discussions |
| 11 | `11-brand-design-system.md` | Brand identity: colors, typography, tagline, motion, design QA | Any UI/marketing work |

## How to use with Claude Code

1. Put this folder at repo root as `/docs`. Create a `CLAUDE.md` at repo root containing:
   - "Read `/docs/01-overview.md` and `/docs/02-tech-stack.md` before any task."
   - "Money-path code (ledger, escrow, wallets, withdrawals): tests FIRST, then implementation. Never use `any`. Never use floats for amounts."
   - "Never generate or modify anything under `apps/signer/` without the human explicitly asking, and flag every line for review."
2. Work in the phase order in `05-build-phases.md`. Do not let Claude Code jump ahead.
3. At each **AUDIT GATE** in `05-build-phases.md`, stop feature work and run the corresponding section of `08-security-checklist.md` + the test suite in `09-testing-and-integration.md`.
4. Review order = risk order: signer > ledger > escrow state machine > withdrawals > auth > everything else.

## Non-negotiable ground rules (apply to every part)

- **Amounts:** BIGINT smallest units only (SUN/satoshi/wei). `decimal.js` for display only.
- **Ledger:** append-only double-entry. No `UPDATE` on balances. Balance = SUM of entries, cached with invariant checks.
- **State machine:** escrow/trade states change only through the transition table in `04-database-schema.md`. No direct status UPDATEs.
- **Keys:** the web/API app never holds spending keys. Deposit addresses derive from xpub only. Signing lives in the isolated signer service.
- **Idempotency:** every money-moving operation carries an idempotency key and is safe to retry.
- **TypeScript:** `strict: true`, `any` banned in `ledger/`, `escrow/`, `wallet/`, `withdrawal/` via ESLint override.
- **Legal guardrails (from prior research):** client owns the entity, licenses, admin/treasury keys, and legal risk — in writing. You are the contractor. Deviations from client prompts made for legal/security reasons are logged, not hidden.
