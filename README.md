# QuataTrade

P2P USDT-TRC20 marketplace with ledger-level escrow for Cameroon / Central Africa.
**Read `Documents/README.md` first — it is the single source of truth.**

## Layout

| Folder | What |
|---|---|
| `Documents/` | Master build documentation (specs, phases, security checklist, audits) |
| `shared/` | zod schemas + Money helper + typed API client — **the** FE/BE contract |
| `backend/` | NestJS 11 modular monolith (Fastify): API (`src/main.ts`) + worker (`src/worker.ts`) |
| `frontend/` | Next.js (App Router) + Tailwind 4 |

## First-time setup

```bash
# 1. infra (Docker Desktop must be running)
pnpm compose:up                 # postgres:16, redis:7, minio (+buckets)

# 2. env
cp .env.example backend/.env    # dev defaults match docker-compose

# 3. install + build contract
pnpm install
pnpm build:shared

# 4. database
pnpm migrate

# 5. run
pnpm dev:api                    # http://localhost:4000  (Swagger: /api/docs in dev)
pnpm dev:worker                 # scheduled jobs: timeouts, reconciliation, scanner
pnpm dev:web                    # http://localhost:3000
```

## Tests

```bash
pnpm test               # unit + property (fees: 25k cases)
pnpm test:integration   # Testcontainers PG16 — Gate 1 (ledger) + Gate 4 (escrow)
```

Money-path rule: tests are written **before** implementation; 100% branch coverage
required on `ledger/`, `escrow/`, `fees/` (see `Documents/09`).

## Non-negotiables (short version — full list in `CLAUDE.md`)

- Amounts are **BIGINT smallest units**; strings on the wire; no floats, ever.
- Balances are **ledger-derived** (append-only double-entry); nothing updates a balance column directly except `LedgerService.postJournal`.
- Trade status changes **only** through `EscrowService` (FSM + DB trigger backstop).
- The API never holds private keys — xpub-only. The signer is a separate, human-written service (`backend/SIGNER.md`).
- KYC never auto-approves. Risk rules are deterministic — no LLMs.

## Audit gates

Gate records live in `Documents/audits/`. A phase does not proceed until its gate is green
(`Documents/05-build-phases.md`).
