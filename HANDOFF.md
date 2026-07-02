# QuataTrade — Claude Handoff

**Date:** 2026-07-03 · **Branch:** `main` · **Last commit:** `ea4143d` (pushed to `origin/main`)
**Repo:** github.com/khan-rustam/Quata-Trade

> **Next Claude: start here.** Read this file, then `CLAUDE.md`, `Documents/01-overview.md`, and
> `Documents/02-tech-stack.md`. The `Documents/` folder is the single source of truth.
> Launch-readiness + UI/UX R&D brief (artifact): https://claude.ai/code/artifact/569c15e4-f5e4-48b5-a6ed-a349f39b37b6

---

## 1. What this project is (30 seconds)

P2P **USDT-TRC20** marketplace with **custodial escrow** for Cameroon/Central Africa (EN + FR).
Fiat happens off-platform (MTN MoMo / Orange Money / QuataPay). Monorepo: `shared/` (zod
contract), `backend/` (NestJS API + BullMQ worker), `frontend/` (Next.js 16 App Router).
**v1 scope = USDT only** (BTC/ETH are Phase 3+). Signer service is **human-written, not in this repo**.

**Readiness (from the audit):** polished **testnet demo ≈ 80%**, **real-money mainnet ≈ 50%**.

---

## 2. Run it on the new PC

The previous Mac had a userspace toolchain in `~/.local` (Node/pnpm/Postgres/Redis) with helper
scripts `~/.local/quata-{start,stop,status}.sh`. **Those do NOT exist on the new PC — recreate the
stack.** Two paths:

### Path A — Docker (easiest, matches the repo)
```bash
# prereqs: Node 22, pnpm (corepack enable), Docker
pnpm install
pnpm compose:up                 # starts postgres (host port 55432), redis (6379), minio (9000)
# backend/.env  <- copy from .env.example; it already targets postgres port 55432
cp .env.example backend/.env    # then edit secrets if needed (dev defaults are fine locally)
pnpm migrate                    # applies migrations incl. 0010_profiles
pnpm dev:api                    # http://localhost:4000  (Swagger /api/docs)
pnpm dev:worker                 # BullMQ processors (no HTTP port)
pnpm dev:web                    # http://localhost:3000
# frontend/.env.local:  NEXT_PUBLIC_API_URL=http://localhost:4000
#                       NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

### Path B — no Docker (native)
Install Node 22, `postgresql@16`, `redis`. Create DB `quatatrade` + a superuser role `quatatrade`
(pwd `quatatrade_dev_only`); migrations auto-create the `quatatrade_app`/`quatatrade_readonly`
roles. Point `DATABASE_URL`/`DATABASE_MIGRATION_URL` at your local Postgres, then
`pnpm install && pnpm build:shared && pnpm migrate && pnpm dev:*`.

### ⚠️ Env gotchas (these bit us)
- **Backend reads `backend/.env` (or `../.env`) — NOT `.env.local`.** See `backend/src/app.module.ts`.
- **Frontend reads `.env.local`** (Next.js). Shell-exported vars override it.
- Money-path safety triggers are Postgres PL/pgSQL — **SQLite is not an option**, and Redis is required.

---

## 3. What shipped this session (all committed + pushed)

- **Landing redesign** — animated keyhole-lock hero, **Framer-Motion-ONLY** system
  (`frontend/components/motion/*`, `components/brand/animated-keyhole.tsx`), scroll-driven escrow
  sequence, trust-triple offer cards. **GSAP + Rive were removed** (client has no designer).
- **Full public-site i18n (EN + FR)** — header/nav/buttons/footer + 6 marketing pages
  (how-it-works, security, fees, help, contact, about) localized via next-intl. All render 200 in both.
- **Profiles BACKEND (contract-first, done + verified):**
  - `shared/`: extended `zUserProfile` + `zUpdateProfileRequest` (opt-in `displayName`, `avatarStyle`,
    `avatarSeed`, `bio`, `pendingEmail`); new `zPublicTrader` (`schemas/traders.ts`); `REPUTATION_TIERS`
    + `AVATAR_STYLES` (`constants.ts`); deterministic `reputationTier()` (`reputation.ts`); typed-client
    methods `changeEmail`/`verifyEmailChange`/`trader`.
  - `backend/`: migration `0010_profiles.ts`; `users.service.ts` computes reputation tier + trade stats
    and handles new update fields; new **public** `GET /api/v1/traders/:id` (`traders.controller.ts`).
- **Deviations Log:** D24 (Framer-only animation), D25 (profile fields + reputation).

**Verified:** `pnpm build:shared` clean; backend + frontend `tsc --noEmit` = 0 errors; ESLint clean;
`GET /api/v1/traders/<id>` returns a valid `PublicTrader`.

---

## 4. What's PENDING (priority order — the next task list)

1. **Profiles FRONTEND UI** (backend is ready, contract in place — just build the UI):
   - Avatar **picker** in `frontend/app/(app)/account/profile/page.tsx` — DiceBear **styles + seed**
     (constant `AVATAR_STYLES`); update `components/ui/avatar.tsx` to accept `style`/`seed`.
   - Add editable **display name** (opt-in handle) + **bio** to the profile form (schema already allows them).
   - **Email-change** UI (calls `api.changeEmail` / `api.verifyEmailChange`) — *but delivery needs SMTP (see #2)*.
   - New public page `frontend/app/(public)/traders/[id]/page.tsx` — merchant profile using `api.trader(id)`:
     trust triple + **reputation-tier badge** (build a small badge component) + active-offer count.
   - Admin profile: light enhancement to match.
2. **SMTP fix + email-change delivery** — password-reset and verify-OTP emails currently **do not send**
   (dead-end flows + no SMTP retry). Fix the notify pipeline, then wire email-change OTP to the *new* address.
   Files: `backend/src/modules/notify/*`, `backend/src/jobs/outbox-relay.job.ts`, `backend/src/modules/auth/auth.service.ts`.
3. **App-wide i18n sweep** — logged-in app + admin are still ~95% hardcoded English (public site is done).
4. **Launch blockers before real money** (from the audit — several are human-only):
   - **Signer integration + key ceremony** on isolated Host B (mTLS) — *human-written, never generate it*.
   - **100% branch coverage** on ledger/escrow/fees + fault-injection tests (CI floor is 84%).
   - Real-chain **testnet E2E**, on-chain↔ledger reconciliation + alerting, upload **AV/EXIF** scan,
     **mandatory admin 2FA**, session/status revocation at the guard, **wire the risk engine** (it's dead code),
     **legal content** (Cameroon Law 2024/017), and prod boot hard-stops (mainnet/xpub guards).

---

## 5. Decisions & rules — DO NOT re-litigate

- **Animation = Framer Motion only** (motion/react). No GSAP, no Rive. Transform/opacity only,
  `prefers-reduced-motion` honored, motion on marketing + app-chrome — **never money/trade-room screens**.
- **Avatar = DiceBear picker, no photo uploads** (uploads would need the unbuilt AV/EXIF pipeline).
- **`display_name` is opt-in** — the privacy-masked counterparty name (`displayNameOf`) stays the default.
- **Reputation is deterministic** (no LLM). Tiers: Gold ≥100 trades & ≥98%; Silver ≥25 & ≥95%; Bronze ≥5 & ≥90%; else New.
- **Contract-first** (mandatory per `.claude/skills/quatatrade-api-contract`): change zod in `shared/` →
  `pnpm build:shared` → backend `ZodPipe` + whitelisting mapper → frontend only via `QuataApiClient` →
  `pnpm -r typecheck`. Money = BIGINT smallest-units as **strings** over the wire.
- **Consult the project skills** in `.claude/skills/` before touching their areas (ledger, escrow-fsm,
  api-contract, security-gates, brand).
- **Money-path code** = tests first; never `any`/`as unknown as`; 100% branch coverage on ledger/escrow/fees.

---

## 6. Known issue to fix (optional, quick)

`.claude/settings.json` was committed (in the `42a4e14 "updates"` commit) with **`enabledPlugins`
removed** and a session permission allowlist added — likely unintended. If the plugins should stay
enabled, restore the `enabledPlugins` block.

---

## 7. Quick verification commands

```bash
pnpm build:shared
cd backend  && ./node_modules/.bin/tsc --noEmit -p tsconfig.json     # 0 errors expected
cd frontend && ./node_modules/.bin/tsc --noEmit -p tsconfig.json     # 0 errors expected
cd frontend && ./node_modules/.bin/eslint <changed files>
curl -s http://localhost:4000/health/ready                           # {"status":"ok","db":"up",...}
curl -s http://localhost:4000/api/v1/traders/<user-uuid>             # PublicTrader JSON
# FR render check: curl -s -b qt_locale=fr http://localhost:3000/how-it-works | grep "Comment ça marche"
```

---

## 8. Suggested first move for the next session

Build **Profiles frontend UI** (item 4.1) — it's the highest-value pending piece and the backend
contract is already live and verified, so it's pure frontend work. Then SMTP (2), then app-wide i18n (3).
