# QuataTrade — Standing Rules for Claude Code

Read `Documents/01-overview.md` and `Documents/02-tech-stack.md` before any task.
The `Documents/` folder is the single source of truth. Anything that deviates gets
an entry in `Documents/10-client-prompts-appendix.md` → Deviations Log.

## Repository layout (maps to Documents/03-architecture.md)

| Docs name | Actual folder | What it is |
|---|---|---|
| `packages/shared` | `shared/` | zod schemas, Money helper, constants, typed API client — THE FE/BE contract |
| `apps/api` + `apps/worker` | `backend/` | NestJS 11 modular monolith; `src/main.ts` (API) + `src/worker.ts` (BullMQ processors) |
| `apps/web` | `frontend/` | Next.js (App Router) + Tailwind 4 |
| `apps/signer` | **not in this repo** | Human-written only. See `backend/SIGNER.md` for the contract. |

## Non-negotiable rules

- **Amounts:** BIGINT smallest units only (USDT-TRC20 = 6 decimals). `bigint` in TS,
  `bigint` columns in PG, **strings over the wire**. `decimal.js` for display only.
  Never `number` for money past the display layer.
- **Ledger:** append-only double-entry. No `UPDATE` on balances outside
  `LedgerService.postJournal()`. Balance = SUM of entries, cached with invariant checks.
- **State machine:** trade/escrow status changes only through `EscrowService`
  transitions backed by the `trade_transitions` table + DB trigger. No direct
  status UPDATEs anywhere else.
- **Keys:** the API/worker never hold spending keys. Deposit addresses derive from
  xpub only. Signing lives in the isolated signer service (human-written, not here).
  **Never generate or modify signer code unattended; flag every line for review.**
- **Idempotency:** every money-moving operation carries an idempotency key and is
  safe to retry.
- **Money-path code** (`ledger/`, `escrow/`, `fees/`, `wallet/`, `withdrawals/`,
  `deposits/`, `trades/`): tests FIRST, then implementation. Never `any`,
  never `as unknown as` (ESLint hard-fails). 100% branch coverage on
  `ledger/`, `escrow/`, `fees/`.
- **Validation:** zod at every API boundary, schemas live in `shared/` only.
  Reject unknown fields. Frontend imports the same schemas.
- **KYC:** no code path may auto-approve. Manual review only.
- **Risk:** deterministic rules only. No LLM calls in fraud/risk decision paths.
- **Secrets:** nothing sensitive in the repo — `.env.example` only. No private keys
  or mnemonics in DB, env, logs, or any Claude context.
- Work in the phase order of `Documents/05-build-phases.md`; do not jump ahead of
  an unpassed AUDIT GATE.

## Commands

- `pnpm compose:up` — start postgres/redis/minio (Docker)
- `pnpm migrate` — run Kysely migrations
- `pnpm dev:api` / `pnpm dev:worker` / `pnpm dev:web`
- `pnpm test` — unit + property tests; `pnpm test:integration` — Testcontainers suite
- `pnpm lint` / `pnpm typecheck`
