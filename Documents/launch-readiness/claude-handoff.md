# QuataTrade — Claude Handoff (continue the code from home)

**Date:** 2026-07-03 · **Branch:** `main` · **Commit:** `928cccf` (`origin/main`)
**Read order for the next session:** this file → `../../HANDOFF.md` (running log) → `../../CLAUDE.md` →
`Documents/01-overview.md`, `02-tech-stack.md`. The `Documents/` folder is the single source of truth.
The launch verdict + gaps live in [`README.md`](./README.md) (this folder).

> **Goal of this doc:** get a fresh machine (your home laptop) running the stack, then take the **code**
> as close to 100% as code can go. The remaining *non-code* launch blockers (legal, signer, pen-test,
> monitoring) are listed in `README.md §4` and are **not** things a coding session should attempt.

---

## 1. Current state snapshot (as of this session)

- **Deployed & LIVE** on a shared CloudPanel VPS (`/home/Quata-Trade`, branch `main`). It runs alongside
  many other projects — **only ever touch `quatatrade-*` pm2 apps.**
- **Production domain cutover to `quatatrade.com` is in progress:**
  - `quatatrade.com` → web (Next.js) `127.0.0.1:3800`
  - `api.quatatrade.com` → API (NestJS) `127.0.0.1:4400`  ·  `/health` → `{"status":"ok"}`
  - `cdn.quatatrade.com` → MinIO `127.0.0.1:9100`
  - DNS ✅, env ✅ (`WEB_ORIGIN`, `MINIO_ENDPOINT`, `NEXT_PUBLIC_API_URL` all point at `quatatrade.com`),
    frontend rebuilt ✅, api/cdn TLS ✅. **Last remaining infra step:** issue the apex Let's Encrypt cert
    for `quatatrade.com` **without `www`** (www's stale IPv6 blocks the ACME check; the `AAAA` record was
    deleted, so www will validate once its cache clears — add it back then).
- **Ports on the box (memorise — a wrong port points at another project):** web `3800`, api `4400`, minio
  `9100`/`9101`. **`4000` = BellaBliss, `3000` = another app — never point QuataTrade at those.**
- **Deploy** = `cd /home/Quata-Trade && bash deploy.sh` (idempotent: pull → install → build → migrate →
  reload only the 3 `quatatrade-*` apps → health-check → auto-rollback on failure).
- **Repo reality:** `HEAD == origin/main == 928cccf`, working tree clean. `HANDOFF.md` (repo root) is the
  running session log; keep it updated.

---

## 2. Run it on your home laptop

Prereqs: **Node 22**, **pnpm** (`corepack enable`), **Docker** (for Postgres/Redis/MinIO + integration tests).

```bash
git clone git@github.com:khan-rustam/Quata-Trade.git   # or: git pull
cd Quata-Trade
pnpm install
pnpm compose:up                 # postgres (host port 55432), redis (6379), minio (9000)
cp .env.example backend/.env    # dev defaults are fine locally (SIGNER_MODE=mock, NODE_ENV=development)
pnpm migrate                    # applies all migrations
pnpm dev:api                    # http://localhost:4000  (Swagger at /api/docs when SWAGGER_ENABLED=true)
pnpm dev:worker                 # BullMQ processors (no HTTP port)
pnpm dev:web                    # http://localhost:3000
# frontend/.env.local:  NEXT_PUBLIC_API_URL=http://localhost:4000
```

**Env gotchas (these bite):**
- Backend reads **`backend/.env`** (or `../.env`), **not** `.env.local`. Frontend reads **`.env.local`**.
- `NEXT_PUBLIC_*` is **baked in at build time** — changing the API URL needs a rebuild.
- Local dev ports (`4000`/`3000`) are **different** from the VPS prod ports (`4400`/`3800`). Don't confuse them.
- Money-path safety triggers are Postgres PL/pgSQL — **SQLite is not an option**; Redis is required.

---

## 3. The code roadmap toward 100%

Priority order. Each is genuinely code-fixable. Full context + exact symptoms in `README.md §3–4`.

### P1 — Withdrawals are broken in the UI (functional bug, do first)
The backend `request()` only accepts a **pre-saved, active, past-cooldown whitelisted** destination
(`backend/src/modules/withdrawals/withdrawals.service.ts` ~L210), and the routes + client methods exist
(`withdrawals.controller.ts` addWithdrawalAddress/withdrawalAddresses; `shared` client
`addWithdrawalAddress`/`withdrawalAddresses`) — **but the frontend never calls them** and
`frontend/app/(app)/wallet/withdraw/page.tsx` submits a free-form address → every UI withdrawal is rejected.
**Do:** build an address-book UI — list saved addresses, an "add address" form (with the cooldown notice),
and change the withdraw page to **pick from saved addresses** instead of free-form entry.

### P2 — Admin can't view KYC documents
No presigned-URL endpoint exists for KYC objects (grep of `modules/kyc` + `modules/admin` = 0), so the admin
KYC queue shows only a file **count** — reviewers would approve blind, which undercuts the mandated manual
review. **Do:** add an admin-gated (RBAC `kycReview`) endpoint returning short-TTL presigned GET URLs for a
submission's objects (mirror the trade-proof presign in `trades.service.ts` ~L185), then render the
images/docs in the admin KYC page. SSE-S3 at-rest encryption is compatible with presigned GET.

### P3 — Enforce admin 2FA + escrow-release step-up
`admin-auth.service.ts` (~L135) no-ops the step-up when an admin hasn't enabled 2FA, and login only prompts
if enabled — so admin money actions are password + RBAC only. **Do:** gate this behind config
(`ADMIN_2FA_REQUIRED`, default true in production) or a prod boot hard-stop: force enrolment before
sensitive actions and make `verifyTotp` throw in prod when 2FA is off. Same enrolment unlocks mandatory
escrow-release step-up. *(2FA was made optional on purpose for the test phase — this flips it for prod.)*

### P4 — French legal pages
`frontend/lib/legal-content.ts` is hard-coded English and rendered with **no locale lookup**
(`app/(public)/legal/[slug]/page.tsx`). **Do:** add an `fr` seam (locale-keyed content or `messages/`) so
the legal route serves French. ⚠️ **Do not invent legal French** — add the seam + a "pending lawyer French"
placeholder; the finalised text must come from the Cameroon lawyer (see `README.md §3.1`).

### P5 — 100% branch coverage on money paths
`ledger/escrow/fees` require **100% branch coverage** (CLAUDE.md); actual floor ≈ **84%**. **Do (tests
first):** add fault-injection tests for the serialization-retry (`40001`) and unique-violation race-recovery
branches in `ledger.service.ts`. Runs under Testcontainers (`pnpm test:integration`, needs Docker).

### P6 — Minor / nice-to-have
- Live XAF rate feed (kills the hard-coded `≈ 650` on home/markets — cosmetic; real trades price off the
  seller's `priceXafPerUnit` + `api.feePreview`, so it's not a money bug).
- 2FA **disable** endpoint (missing).
- KYC OCR prefill (currently stubbed `null`).
- Visual EN/FR click-through of the behind-auth pages (the i18n sweep couldn't render them in-browser).

---

## 4. Rules — DO NOT re-litigate (from CLAUDE.md + skills)

- **Contract-first:** change zod in `shared/` → `pnpm build:shared` → backend ZodPipe + whitelisting mapper
  → frontend only via `QuataApiClient` → `pnpm -r typecheck`. Money = **BIGINT smallest units as strings**
  over the wire; `bigint` in TS/PG; `decimal.js` for display only; never `number` past the display layer.
- **Ledger:** append-only double-entry; no balance `UPDATE` outside `LedgerService.postJournal()`.
- **Escrow:** status changes only through `EscrowService` transitions (backed by the trade-transitions
  trigger). No direct status writes.
- **Money-path code** (`ledger/escrow/fees/wallet/withdrawals/deposits/trades`): **tests first**, never
  `any`/`as unknown as`, 100% branch coverage on `ledger/escrow/fees`.
- **Signer:** the API/worker never hold spending keys. **Never generate or modify signer code unattended.**
- **KYC:** no auto-approve. **Risk/fraud:** deterministic rules only, no LLM in the decision path.
- **Secrets:** nothing sensitive in the repo (`.env.example` only). **Consult the matching skill in
  `.claude/skills/` before working in ledger / escrow-fsm / api-contract / security-gates / brand.**
- **Animation** (frontend): Framer Motion only; transform/opacity; honour `prefers-reduced-motion`; never on
  money/trade-room screens.

---

## 5. Verify before you claim done

```bash
pnpm build:shared
cd backend  && ./node_modules/.bin/tsc --noEmit -p tsconfig.json     # 0 errors
cd frontend && ./node_modules/.bin/tsc --noEmit -p tsconfig.json     # 0 errors
pnpm --filter frontend lint
pnpm --filter frontend build
pnpm test                                                            # unit + property (money paths)
pnpm test:integration                                                # Testcontainers (needs Docker)
curl -s http://localhost:4000/health/ready                           # {"status":"ok",...}
```
Money paths additionally need their gate suite green (`Documents/audits/`).

---

## 6. Deploy from home to the VPS (when a change is ready)

Push to `origin/main`, then on the VPS:
```bash
cd /home/Quata-Trade && bash deploy.sh
```
It only reloads the 3 `quatatrade-*` apps on their correct ports (web 3800 / api 4400 / minio 9100), runs
migrations, health-checks, and auto-rolls-back on failure. If you add a migration, it runs automatically.
**Never** point any reverse proxy at ports `4000` (BellaBliss) or `3000`.

---

## 7. What NOT to do in a coding session (human/ops — see README §3)

Legal entity + crypto licence + lawyer review of legal pages (EN+FR); the human-written **signer** + key
ceremony; flipping to mainnet; external pen-test; offsite backups + restore drill; monitoring/paging +
on-call; provisioning real SMTP + company float accounts. These are the true launch gatekeepers and are
outside a code session's remit.
