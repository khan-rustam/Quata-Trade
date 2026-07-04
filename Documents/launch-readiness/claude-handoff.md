# QuataTrade — Claude Handoff (continue the code from home)

**Updated:** 2026-07-04 · **Branch:** `main` · **Latest on `origin/main`**
**Read order for the next session:** this file → `../../CLAUDE.md` → `Documents/01-overview.md`,
`02-tech-stack.md`. The `Documents/` folder is the single source of truth. The launch verdict + gaps live
in [`README.md`](./README.md) (this folder).

> **Goal of this doc:** get a fresh machine (your home laptop) running the stack, then take the **code**
> as close to 100% as code can go. The remaining *non-code* launch blockers (legal, signer, pen-test,
> monitoring) are listed in `README.md §3` and are **not** things a coding session should attempt.

---

## ✅ Progress — 2026-07-04 (code-readiness pass)

Shipped + verified this session (commit `ad26f9f` + follow-up on `origin/main`; shared build + backend
typecheck + **150/150 backend unit tests** + frontend lint + build all green):

- **P1 — Withdrawals now work in the UI.** `/wallet/withdraw` picks from saved, whitelisted, past-cooldown
  addresses (list + inline add/remove) instead of the free-form address the backend always rejected.
- **P2 — Admin KYC document viewer.** `GET /admin/kyc/:id/documents` → short-TTL (120s) presigned URLs,
  `RBAC.kycReview`-gated, audit-logged (`kyc.documents_viewed`); the review dialog renders images inline +
  PDF/file links.
- **P3 — Admin step-up 2FA is now enforceable.** New `ADMIN_2FA_REQUIRED` flag + prod boot hard-stop; when
  on, `verifyTotp` fails closed for non-enrolled admins on every money/escrow action. Test phase (flag off)
  unchanged. **Roll-out:** enroll all admins' 2FA in staging, then set `ADMIN_2FA_REQUIRED=true` for prod.
- **P6a — User 2FA disable flow.** `POST /auth/2fa/disable` (verify a current code → clear secret + 24h
  withdrawal hold + audit) + "Disable 2FA" UI on the security page.
- **P6b — De-magicked the indicative XAF rate** into `frontend/lib/market.ts` (display-only; real pricing
  uses the seller's `priceXafPerUnit`).
- **P5 — Money-path coverage is now 100%** (branch/function/line/statement on `ledger/escrow/fees`),
  enforced in `backend/vitest.config.ts`. Added the fault-injection tests Gate 1 was missing:
  serialization (40001) / deadlock (40P01) retry-then-succeed, retry exhaustion, non-retryable rethrow,
  the unique-violation race, and the escrow FSM guard/terminal edges. **This caught a real ledger bug:**
  the concurrent same-key recovery re-`SELECT`ed inside a transaction the 23505 had already poisoned
  ("current transaction is aborted") — it could never recover, so a genuinely concurrent duplicate request
  errored instead of replaying. Fixed with a `SAVEPOINT` (ON CONFLICT is unavailable — `journal_entries`
  has append-only RULEs). A few provably-unreachable defensive guards carry `/* v8 ignore */` with the
  stated invariant. Needs Docker/Testcontainers to run (`pnpm test:integration`). 257/257 backend green.
- **Ops:** Hostinger SMTP host/port template in `.env.example` (fill `SMTP_USER`/`SMTP_PASS` on the box —
  `smtp.hostinger.com:465`, `SMTP_SECURE=true`); removed the stale root `HANDOFF.md` (this folder is the source).

### Remaining code items
- **P4 — French legal pages:** the locale *seam* is not built, and the final French text is a **lawyer
  dependency** (do not invent legal French). **This is the only substantial code item left.**
- Minor: KYC OCR prefill (stubbed), a real rate feed, a logged-in EN/FR visual pass.

**Non-code launch blockers are unchanged** (see [`README.md`](./README.md)): legal entity + crypto licence
+ lawyer-reviewed pages, the human-written signer + key ceremony, external pen-test, monitoring/backups/
on-call. Those gate a real-money launch and are not coding tasks.

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

### P5 — 100% branch coverage on money paths ✅ DONE (2026-07-04)
`ledger/escrow/fees` now have **100% branch/function/line/statement** coverage, enforced by
`backend/vitest.config.ts` thresholds. Fault-injection tests were added for the serialization-retry
(`40001`), deadlock (`40P01`), retry-exhaustion, non-retryable rethrow, and unique-violation race-recovery
paths in `ledger.service.ts`, plus the escrow FSM guard/terminal edges. **The race test caught a real bug:**
the same-key recovery re-`SELECT`ed inside a transaction the `23505` had already aborted, so it could never
recover — now fixed with a `SAVEPOINT` (`ON CONFLICT` is unavailable: `journal_entries` has append-only
RULEs). Runs under Testcontainers (`pnpm test:integration`, needs Docker). Gate 1 formal re-sign is a human
audit task, not code.

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
