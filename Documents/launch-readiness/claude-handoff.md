# QuataTrade — Claude Handoff (continue from home)

**Updated:** 2026-07-04 · **Branch:** `main` · **HEAD = `origin/main` = `c99a9cc`** · working tree clean
**Read order for the next session:** this file → `../../CLAUDE.md` → `Documents/01-overview.md`,
`02-tech-stack.md`. The `Documents/` folder is the single source of truth; the launch verdict + gaps live
in [`README.md`](./README.md) (this folder).

> **Goal:** get the stack running on your home laptop, then take the **code** as close to 100% as code can
> go. The remaining *non-code* launch blockers (legal, signer, pen-test, monitoring) are in `README.md §3`
> and are **not** things a coding session should attempt.

---

## 0. Where things stand right now (2026-07-04)

- **Deployed & LIVE** at **`https://quatatrade.com`** on a shared CloudPanel VPS (`root@srv1287764`,
  `/home/Quata-Trade`, branch `main`). Last deploy of `c99a9cc`-era code is live and healthy.
- **Domain cutover is COMPLETE.** `quatatrade.com` is the **sole** domain. The old `trade.quatadigital.com`
  / `api.trade.` / `cdn.trade.` vhosts + their SAN cert were **removed**. Do not re-add them.
  - `quatatrade.com` → web `127.0.0.1:3800`
  - `api.quatatrade.com` → API `127.0.0.1:4400` · `/health` → `{"status":"ok"}`
  - `cdn.quatatrade.com` → MinIO `127.0.0.1:9100` (root returns 403 by design — objects via presigned URLs)
- **Ports on the box (memorise):** web `3800`, api `4400`, minio `9100`/`9101`. **`4000` = BellaBliss,
  `3000` = another app — NEVER point QuataTrade at those.** Only ever touch `quatatrade-*` pm2 apps.
- **Health / quality:** **261/261 backend tests green**, money-path branch coverage **100%**
  (`ledger/escrow/fees`), frontend typecheck + lint + build clean. Verified end-to-end in a real browser
  (register country picker EN/FR, sign-up gating, login → XAF display, offer rails) with 0 console errors.

---

## 1. What's DONE (recent → this session)

- **Country-segmented markets + phased rollout** (`c9e50c5`, migration `0015`, Deviations Log **D26**).
  `countries` reference table — 26 African markets seeded, **only Cameroon enabled**. `users.country` is
  FK-bound; `country` is denormalized onto `offers`/`trades`. Sign-up is gated to ENABLED markets + a phone
  dial-code check. Offer browse/detail and **`openTrade` (money-path)** are scoped to the caller's market —
  a cross-market OR disabled-market trade is rejected (409) with no money moved / no trade row / offer
  intact (tests-first). `openTrade` re-checks `enabled` so disabling a market freezes new trades. The
  migration normalizes any stray historical country to `CM` before the FK (deploy-safe on a populated DB).
- **Enable-a-country-any-time = admin-editable** (`2dc2f5a`, migration `0016`). Broadened the
  `payment_method` enum with 8 pan-African rails + default fees; each market's rails are **set from the
  admin Markets console** (configure dialog: enabled + rails multi-select + reason + TOTP + audit; an
  enabled market needs ≥1 rail). Fiat display is **currency-aware** (`useUserMarket` → the user's
  `currencyCode`): a Nigerian sees NGN, a Cameroonian XAF. Enabling a second market is now a **data action,
  not code**. ⚠️ Rail labels/colours + which rails a market offers are a **business input** — the client
  sets the real per-market rails + fees.
- **Money-path coverage = 100%** (`ee2ad18`/`a08fb79`, P5). Fault-injection tests added for the
  serialization (`40001`) / deadlock (`40P01`) retry, retry-exhaustion, non-retryable rethrow, the
  unique-violation race, and escrow FSM guard/terminal edges. **The race test caught a real ledger bug:**
  the concurrent same-key recovery re-`SELECT`ed inside a transaction the `23505` had already poisoned
  ("current transaction is aborted"), so it could never recover — now fixed with a **`SAVEPOINT`** around
  the journal insert (`ON CONFLICT` is unavailable: `journal_entries` has append-only RULEs). A few
  provably-unreachable defensive guards carry `/* v8 ignore */` with the stated invariant.
- **Earlier code-readiness pass** (`ad26f9f`, `10717dd`): P1 withdrawal-whitelist UI, P2 admin KYC document
  viewer (short-TTL presigned URLs), P3 enforceable admin step-up 2FA (`ADMIN_2FA_REQUIRED` + prod
  hard-stop), P6a user 2FA-disable, P6b indicative XAF rate centralised.
- **Ops/domain** (`a04900e`): `deploy.sh` health-check defaults + nginx note now target `quatatrade.com`.

---

## 2. What's LEFT

### Code (a home session can do)
- **P4 — French legal pages.** `frontend/lib/legal-content.ts` is hard-coded English, rendered with no
  locale lookup (`app/(public)/legal/[slug]/page.tsx`). Add an `fr` seam (locale-keyed content). ⚠️ **Do
  not invent legal French** — add the seam + a "pending lawyer French" placeholder; final text is a Cameroon
  lawyer dependency. **This is the only substantial code item left.**
- **Minor:** KYC OCR prefill (currently stubbed `null`); a live XAF/NGN rate feed (kills the hard-coded
  indicative `≈ 650` — cosmetic, real trades price off the seller's `priceXafPerUnit`); if the client sends
  mail as `@quatadigital.com`, switch to `@quatatrade.com` + set SPF/DKIM.

### Non-code launch blockers (NOT a coding task — see `README.md §3`)
Legal entity + crypto licence + lawyer-reviewed pages (EN+FR); the human-written **signer** service + cold-key
ceremony + mainnet flip (until then **no USDT can leave custody** — withdrawals can't complete, deposits do);
independent pen-test; monitoring/alerting + offsite backups + restore drill + on-call; real SMTP + company
float accounts. **These are the critical path to a real-money launch — weeks-to-months, mostly legal + the
signer + an external audit.**

---

## 3. Run it on your home laptop

Prereqs: **Node 22**, **pnpm** (`corepack enable`), **Docker** (Postgres/Redis/MinIO + integration tests).

```bash
git clone git@github.com:khan-rustam/Quata-Trade.git   # or: git pull
cd Quata-Trade
pnpm install
pnpm compose:up                 # postgres (host 55432), redis (6379), minio (9000)
cp .env.example backend/.env    # dev defaults are fine (SIGNER_MODE=mock, NODE_ENV=development)
pnpm build:shared               # the FE/BE contract must be built before api/web
pnpm migrate                    # applies all migrations (through 0016)
pnpm dev:api                    # http://localhost:4000  (Swagger at /api/docs if SWAGGER_ENABLED=true)
pnpm dev:worker                 # BullMQ processors (no HTTP port)
pnpm dev:web                    # http://localhost:3000
# frontend/.env.local:  NEXT_PUBLIC_API_URL=http://localhost:4000
```

**Env gotchas (these bite):**
- Backend reads **`backend/.env`** (or `../.env`), NOT `.env.local`. Frontend reads **`.env.local`**.
- `NEXT_PUBLIC_*` is **baked at build time** — changing the API URL needs a frontend rebuild.
- **Local** dev ports (`4000`/`3000`) differ from **prod** ports (`4400`/`3800`). Don't confuse them.
- Money-path safety is Postgres PL/pgSQL triggers + RULEs — **SQLite is not an option**; Redis is required.
- The new-country flow: only `CM` is enabled. To exercise a 2nd market locally, enable one via the admin
  Markets page (or `UPDATE countries SET enabled=true, payment_methods='{BANK_TRANSFER}' WHERE code='NG'`).

---

## 4. Rules — DO NOT re-litigate (from CLAUDE.md + `.claude/skills/`)

- **Contract-first:** change zod in `shared/` → `pnpm build:shared` → backend `ZodPipe` + whitelisting
  mapper → frontend only via `QuataApiClient` → `pnpm -r typecheck`. Money = **BIGINT smallest units as
  strings** over the wire; `bigint` in TS/PG; `decimal.js` for display only; never `number` past display.
  (Fiat prices like `price_xaf_per_unit` are WHOLE local-currency units, currency from `countries`.)
- **Ledger:** append-only double-entry; no balance `UPDATE` outside `LedgerService.postJournal()`.
- **Escrow:** trade status changes only through `EscrowService` (backed by the trade-transitions trigger).
- **Money-path** (`ledger/escrow/fees/wallet/withdrawals/deposits/trades`): **tests first**, never
  `any`/`as unknown as`, **100% branch coverage on `ledger/escrow/fees`** (enforced in `vitest.config.ts`).
- **Signer:** the API/worker never hold spending keys. **Never generate or modify signer code unattended.**
- **KYC:** no auto-approve. **Risk/fraud:** deterministic rules only, no LLM in the decision path.
- **Secrets:** nothing sensitive in the repo (`.env.example` only). Consult the matching skill in
  `.claude/skills/` before working in ledger / escrow-fsm / api-contract / security-gates / brand.
- **Deviations** from the docs go in `Documents/10-client-prompts-appendix.md` → Deviations Log.

---

## 5. Verify before you claim done

```bash
pnpm build:shared
cd backend  && ./node_modules/.bin/tsc --noEmit -p tsconfig.json     # 0 errors
cd frontend && ./node_modules/.bin/tsc --noEmit -p tsconfig.json     # 0 errors
pnpm --filter frontend lint
pnpm --filter frontend build
pnpm --filter @quatatrade/backend exec vitest run --coverage         # 261 tests + 100% money-path (needs Docker)
curl -s http://localhost:4000/health                                 # {"status":"ok"}
```
If Testcontainers specs fail fast with 0 passing, **Docker is down** — start it and re-run (this is the #1
false alarm). Money paths additionally need their gate suite green (`Documents/audits/`).

---

## 6. Deploy from home to the VPS

Push to `origin/main`, then on the VPS:
```bash
cd /home/Quata-Trade && bash deploy.sh
```
Idempotent: pull → install → `build:shared` → build → **migrate** → reload only the 3 `quatatrade-*` apps
→ health-check `quatatrade.com` + `api.quatatrade.com` → auto-rollback on failure. New migrations run
automatically. **Never** point any reverse proxy at ports `4000` (BellaBliss) or `3000`.

---

## 7. What NOT to do in a coding session (human/ops)

Legal entity + crypto licence + lawyer review of legal pages (EN+FR); the human-written **signer** + key
ceremony; flipping to mainnet; external pen-test; offsite backups + restore drill; monitoring/paging +
on-call; provisioning real SMTP + company float accounts. These are the true launch gatekeepers.
