# QuataTrade — Complete Project Reference

> One document that explains the whole project: what it is, how it is built, which technologies and versions it uses, how everything is configured and connected, and where things stand today. Written for both developers and non-technical readers (product managers, stakeholders). Everything here was verified against the actual code and configuration on **2026-07-04**. The `Documents/` folder remains the authoritative specification; this file is the guided tour.

---

## Table of Contents

1. [What QuataTrade Is](#1-what-quatatrade-is)
2. [Current Status at a Glance](#2-current-status-at-a-glance)
3. [How a Trade Works (the Core Flow)](#3-how-a-trade-works-the-core-flow)
4. [Business Rules and Revenue Model](#4-business-rules-and-revenue-model)
5. [Repository Layout](#5-repository-layout)
6. [Technology Stack and Versions](#6-technology-stack-and-versions)
7. [System Architecture](#7-system-architecture)
8. [The Shared Contract Package (`shared/`)](#8-the-shared-contract-package-shared)
9. [Backend in Detail (`backend/`)](#9-backend-in-detail-backend)
10. [Frontend in Detail (`frontend/`)](#10-frontend-in-detail-frontend)
11. [Database Design](#11-database-design)
12. [Security Setup](#12-security-setup)
13. [Integrations and External Services](#13-integrations-and-external-services)
14. [Environment Configuration](#14-environment-configuration)
15. [Local Development Setup](#15-local-development-setup)
16. [Testing and Quality Gates](#16-testing-and-quality-gates)
17. [Continuous Integration (CI)](#17-continuous-integration-ci)
18. [Deployment and Production Operations](#18-deployment-and-production-operations)
19. [Build Phases and Audit-Gate Status](#19-build-phases-and-audit-gate-status)
20. [Known Gaps and Documentation-vs-Code Differences](#20-known-gaps-and-documentation-vs-code-differences)
21. [Developer Tooling (Claude Code, MCP, Skills)](#21-developer-tooling-claude-code-mcp-skills)
22. [Where to Read More](#22-where-to-read-more)

---

## 1. What QuataTrade Is

**QuataTrade is a peer-to-peer (P2P) cryptocurrency marketplace with escrow protection, built for Cameroon and Central Africa**, in English and French.

In plain terms: it is a website where people buy and sell **USDT** (a "stablecoin" cryptocurrency pegged to the US dollar, on the TRON blockchain) directly from each other. The actual cash payment between buyer and seller happens **outside the platform** — via MTN Mobile Money, Orange Money, or QuataTrade's own internal wallet ("QuataPay"). What the platform does is hold the seller's crypto **in escrow** (a safe middle position) during the trade, so neither side can cheat: the buyer pays the seller in cash, the seller confirms receiving it, and only then does the platform release the crypto to the buyer.

What it deliberately is **not**:

- It is **not** a centralized exchange — there is no order book, no market/limit orders.
- It **never touches fiat money** (XAF, mobile-money balances). Fiat payments are recorded as references only.
- It does **not** auto-approve identity checks — all KYC (Know Your Customer) verification is reviewed by a human.
- It uses **no AI/LLMs in fraud or risk decisions** — risk rules are deterministic and auditable.

**Phase 1 scope (what is built):** USDT on TRON (TRC-20) only; a responsive web app plus an admin dashboard; per-trade chat; dispute resolution by admins; email and in-app notifications. Bitcoin, Ethereum, mobile apps (Flutter), airtime top-ups, referral payouts, and dealer features are all explicitly deferred to later phases.

**Live site:** https://quatatrade.com (API at https://api.quatatrade.com, file CDN at https://cdn.quatatrade.com).

---

## 2. Current Status at a Glance

As of 2026-07-04 (source: `Documents/launch-readiness/claude-handoff.md` and `Documents/launch-readiness/README.md`):

| Area | Status |
|---|---|
| Deployment | **Live at quatatrade.com** on a shared CloudPanel VPS; domain cutover from the old test domain (`trade.quatadigital.com`) is complete — the old vhosts were removed. |
| Backend tests | **261/261 green**; money-path branch coverage **100%** (ledger, escrow, fees). |
| Frontend | Typecheck, lint, and build clean; verified end-to-end in a browser with zero console errors. |
| Multi-country support | Done: 26 African markets seeded, **only Cameroon (CM) enabled**; enabling another country is an admin data action (with 2FA + audit log), not a code change. |
| Real-money launch | **Blocked**, mostly by non-code gates: legal entity + crypto licensing + lawyer-reviewed legal pages (EN+FR); the human-written production signer service does not exist yet (so no USDT can leave custody in production — deposits work, withdrawals cannot complete); external penetration test; live monitoring/alerting; offsite backups with a tested restore. |
| Audit gates | Gate 1 (ledger) **PASSED**; Gate 4 (escrow) **CORE PASSED**; Gates 0, 2, 3, 5, 6, 7 not yet signed. See [§19](#19-build-phases-and-audit-gate-status). |
| Readiness estimate | Software ≈85% built and high quality; suitable as a full testnet demo today; not yet permitted/safe to take real customer money. |

---

## 3. How a Trade Works (the Core Flow)

This is the canonical lifecycle every trade follows (memorized across the codebase and enforced by a state machine plus a database trigger):

```
Seller creates offer   →  balance check → crypto reserved (available → escrow_reserved)
Buyer opens trade      →  escrow LOCKED for the trade amount; a 30-minute payment timer starts
Buyer pays seller off-platform (MTN MoMo / Orange Money / QuataPay)
Buyer submits proof    →  status: PAYMENT_SUBMITTED (payment reference, sender name/number, screenshot)
Seller confirms receipt→  escrow RELEASES: amount − fee → buyer's wallet, fee → platform treasury → COMPLETED
Seller denies, or the timer expires with no proof → auto-cancel → escrow returns to the seller
Either party disputes  →  DISPUTED: escrow frozen; only an admin resolution can release or refund
```

The **nine trade statuses** are: `OPENED → ESCROW_LOCKED → PAYMENT_SUBMITTED → COMPLETED | CANCELLED | EXPIRED | DISPUTED → RESOLVED_RELEASE | RESOLVED_REFUND`.

Golden invariants (tested with property-based tests and enforced by database constraints):

- The sum of ledger entries per account/asset is never negative; escrow balances exactly match open trades.
- For every completed trade: `buyer_credit + fee = escrow_locked_amount`, with exact integer (BIGINT) equality.
- No code path releases escrow while a trade is `DISPUTED`, except an admin resolution transition.
- Every status change writes a `trade_events` row in the **same database transaction** as the trade update.

An important design decision: **escrow is ledger-level, not on-chain per trade.** "Locking escrow" moves value between internal ledger accounts (`user:available → user:escrow`) inside a database transaction. Actual blockchain transactions happen only for deposits, withdrawals, and treasury sweeps. This keeps trades instant and fee-free on-chain.

---

## 4. Business Rules and Revenue Model

- **Revenue = trading fee, collected in crypto** into the platform treasury account:
  - **0.30%** (30 basis points) when the buyer pays via the internal QuataPay wallet.
  - **0.50%** (50 basis points) for all other payment methods (MTN MoMo, Orange Money, and the newer pan-African rails).
- **Payment window:** 30 minutes per trade (`TRADE_PAYMENT_WINDOW_MINUTES = 30`).
- **Asset:** USDT-TRC20 only, with 6 decimal places (1 USDT = 1,000,000 smallest units). All money is stored and computed as whole numbers of smallest units.
- **KYC tiers:** tier structure (0–3) with per-tier trade/withdrawal limits defined in the shared constants; verification is always manual.
- **Withdrawal controls:** withdrawals above **500 USDT** (`DUAL_APPROVAL_THRESHOLD = 500_000_000n` smallest units) require **two different admin approvers**. Deposit crediting requires **19 blockchain confirmations** by default, with a minimum deposit of 1 USDT.
- **Payment methods:** 11 defined in the shared constants — QUATAPAY, MTN_MOMO, ORANGE_MONEY plus eight pan-African rails added for multi-country support (BANK_TRANSFER, MPESA, AIRTEL_MONEY, MOOV_MONEY, WAVE, VODAFONE_CASH, OPAY, PALMPAY). Which rails are active per country is configured by admins.
- **Reputation:** display-only tiers computed deterministically from completed trades and completion rate — NEW → BRONZE (≥5 trades, ≥90%) → SILVER (≥25, ≥95%) → GOLD (≥100, ≥98%).
- **Countries:** a `countries` reference table drives a phased rollout. 26 African markets are seeded; only Cameroon is enabled. Sign-up, offer browsing, and trade opening are all scoped to the caller's enabled market; cross-market trades are rejected before any money moves. Currency display follows the user's market (XAF for Cameroon, NGN for Nigeria, etc.).

---

## 5. Repository Layout

This is a **pnpm workspace monorepo** with three packages (`pnpm-workspace.yaml`: `backend`, `frontend`, `shared`).

```
Quata-Trade/
├── CLAUDE.md               # Standing rules for AI-assisted development
├── Documents/              # THE specification — 17 numbered docs + audits/ + ops/ + launch-readiness/
├── shared/                 # @quatatrade/shared — zod schemas, Money helper, constants, typed API client
│   └── src/
│       ├── schemas/        # 15 domain schema files (auth, wallet, trades, admin, …)
│       ├── client/         # QuataApiClient — the one and only HTTP client
│       ├── money.ts        # bigint ↔ display-string conversion (decimal.js)
│       ├── constants.ts    # enums, fees, limits — mirrors PostgreSQL enums 1:1
│       └── reputation.ts   # deterministic reputation tiers
├── backend/                # @quatatrade/backend — NestJS 11 modular monolith on Fastify
│   ├── src/main.ts         # API process entry
│   ├── src/worker.ts       # Background worker process entry (cron jobs, no HTTP)
│   ├── src/modules/        # 24 feature modules (ledger, escrow, trades, wallet, admin, …)
│   ├── src/db/migrations/  # 17 Kysely migrations (raw SQL)
│   ├── src/common/         # crypto, audit chain, auth guards, Redis, MinIO storage
│   ├── src/config/env.ts   # zod-validated environment schema
│   └── SIGNER.md           # Contract for the (separate, human-written) signing service
├── frontend/               # Next.js App Router app (app/ directory, no src/)
│   ├── app/                # Routes: (public), (auth), (app), admin/, maintenance, suspended
│   ├── components/         # ui/, layout/, admin/, public/, trade/, account/, brand/, motion/
│   ├── hooks/ lib/ i18n/ messages/
│   └── next.config.ts
├── docker-compose.yml      # Dev services: postgres, redis, minio (+ clamav via profile)
├── deploy.sh               # One-command production deploy with rollback
├── ecosystem.config.cjs    # PM2 process definitions (api, worker, web)
├── scripts/backup-db.sh    # Encrypted nightly database backup
├── .env.example            # Template for backend/.env (the only env file in git)
├── .github/workflows/ci.yml
├── .mcp.json               # Dev-only MCP servers (read-only Postgres, Context7, Playwright)
└── .claude/                # Project skills and Claude Code settings
```

One package that is intentionally **not** in this repository: **`apps/signer`** — the service that holds hot-wallet keys and signs blockchain transactions. It is written by a human, line-by-line, and deployed on a separate, isolated server. This repo contains only its client interface and a development mock (see [§7](#7-system-architecture) and [§12](#12-security-setup)).

---

## 6. Technology Stack and Versions

All versions below are the exact strings from the committed `package.json` files (pnpm lockfile pins the resolved versions).

### Runtime and tooling

| Item | Choice | Version |
|---|---|---|
| Runtime | Node.js | ≥ 22 (LTS; enforced in `package.json` engines and by `deploy.sh`) |
| Language | TypeScript | `^5.7.0` (backend/shared), `^5` (frontend) — `strict: true` everywhere, plus `noUncheckedIndexedAccess` on the backend |
| Package manager | pnpm | `11.2.2` (pinned via `packageManager` and corepack) |
| Monorepo | pnpm workspaces | 3 packages: backend, frontend, shared |

### Backend (`@quatatrade/backend`)

| Concern | Library | Version |
|---|---|---|
| Framework | `@nestjs/core`, `@nestjs/common` on `@nestjs/platform-fastify` | `^11.0.0` |
| Config | `@nestjs/config` + zod-validated env schema | `^4.0.0` |
| Validation | `zod` (per-route pipe; class-validator is not used) | `^3.25.0` |
| Database driver | `pg` (node-postgres) | `^8.13.1` |
| Query builder | `kysely` (typed SQL; no ORM on money paths) | `^0.28.0` |
| Cache / counters | `ioredis` | `^5.4.2` |
| Scheduling | `@nestjs/schedule` (all background work is cron-based) | `^6.0.0` |
| Queues | `bullmq` — **declared but currently unused in code** (see §20) | `^5.34.0` |
| WebSockets | `@nestjs/websockets` + `@nestjs/platform-socket.io` + `socket.io` | `^11.0.0` / `^4.8.1` |
| Auth | `@nestjs/jwt`, `@nestjs/passport`, `passport-jwt` (JWT verified directly by a custom guard) | `^11.0.0` / `^4.0.1` |
| Password hashing | `argon2` (argon2id) | `^0.44.0` |
| 2FA | `otplib` (TOTP) + `qrcode` | `^12.0.1` / `^1.5.4` |
| Rate limiting | `@nestjs/throttler` + `rate-limiter-flexible` | `^6.3.0` / `^5.0.4` |
| Security headers | `@fastify/helmet` (CSP, HSTS), `@fastify/cookie` | `^13.0.1` / `^11.0.1` |
| Logging | `pino` / `pino-http` via `nestjs-pino` (structured JSON, secret redaction) | `^9.6.0` / `^10.4.0` / `^4.3.0` |
| API docs | `@nestjs/swagger` (dev/staging only, at `/api/docs`) | `^11.0.0` |
| Blockchain | `tronweb` (TRON SDK) | `^6.0.0` |
| HD wallet | `bip39`, `bip32`, `@bitcoinerlab/secp256k1` (xpub-only address derivation) | `^3.1.0` / `^5.0.0` / `^1.1.1` |
| Object storage | `minio` (S3-compatible client) | `^8.0.3` |
| Email | `nodemailer` (SMTP) + `handlebars` templates | `^6.9.16` / `^4.7.8` |
| IDs | `uuidv7` | `^1.0.2` |

Backend dev/test: `vitest ^3.0.0`, `@vitest/coverage-v8 ^3.0.0`, `fast-check ^3.23.0` (property tests), `testcontainers` + `@testcontainers/postgresql ^10.16.0`, `eslint ^9.17.0` + `typescript-eslint ^8.19.0` (flat config), `@swc/core ^1.10.0` + `unplugin-swc ^1.5.1`, `tsx ^4.19.2`, `pino-pretty ^13.0.0`, `@nestjs/cli ^11.0.0`.

### Frontend (`frontend`)

| Concern | Library | Version |
|---|---|---|
| Framework | `next` (App Router) | `16.2.10` (exact-pinned) |
| UI runtime | `react` / `react-dom` | `19.2.4` |
| Styling | `tailwindcss` + `@tailwindcss/postcss` (Tailwind v4, CSS-based config — no `tailwind.config` file) | `^4.3.2` |
| Server state | `@tanstack/react-query` | `^5.101.2` |
| Forms | `react-hook-form` + `@hookform/resolvers` (zod resolver) | `^7.80.0` / `^3.10.0` |
| Validation / contract | `zod` + `@quatatrade/shared` (workspace) | `^3.25.76` / `workspace:*` |
| i18n | `next-intl` (English + French, cookie-based locale) | `^4.13.1` |
| Icons | `lucide-react` | `^0.469.0` |
| Animation | `motion` (Framer Motion successor; the sole animation library per Deviations D24) | `^12.42.2` |
| Charts | `recharts` (admin metrics) | `^3.9.1` |
| Realtime | `socket.io-client` — **installed but currently unused; the UI polls** (see §20) | `^4.8.3` |
| Money display | `decimal.js` | `^10.6.0` |
| QR codes | `qrcode.react` (deposit addresses) | `^4.2.0` |
| Class utils | `clsx` + `tailwind-merge` | `^2.1.1` / `^2.6.1` |

Frontend dev: `eslint ^9` + `eslint-config-next 16.2.10`, `postcss ^8.5.16`, `typescript ^5`.

Notable: **shadcn/ui is not used** (despite being named in the docs) — the UI primitives in `components/ui/` are hand-written, following shadcn-style conventions (a `cn()` helper with clsx + tailwind-merge, lucide icons).

### Shared (`@quatatrade/shared`)

| Concern | Library | Version |
|---|---|---|
| Validation | `zod` | `^3.25.0` |
| Decimal math (display only) | `decimal.js` | `^10.4.3` |
| Build | `tsup` (ESM + CJS + type declarations, target ES2022) | `^8.3.5` |
| Tests | `vitest` | `^3.0.0` |

### Infrastructure (dev via Docker Compose; production runs natively under PM2)

| Service | Image / tool | Purpose |
|---|---|---|
| PostgreSQL | `postgres:16-alpine` | Primary database (dev port **55432**, to avoid clashing with native installs) |
| Redis | `redis:7-alpine` (append-only mode) | Rate limits, velocity counters, cache |
| MinIO | `minio/minio:latest` + `minio/mc` init | S3-compatible file storage; private buckets `kyc`, `proofs`, `disputes`, `chat` |
| ClamAV | `clamav/clamav:latest` (compose `full` profile only) | Antivirus scanning of uploads |
| PM2 | `ecosystem.config.cjs` | Production process manager for api / worker / web |
| Nginx | (host-managed, CloudPanel) | TLS termination and reverse proxy |

---

## 7. System Architecture

QuataTrade is a **modular monolith plus exactly one physically separated service** (the signer). The client's original spec asked for seven microservices; that was deliberately consolidated (recorded in the Deviations Log) because clean NestJS module boundaries give the same separation without the operational cost, and the signer split is the only one that buys real security.

### Processes

```
Browser ──HTTPS──▶ Nginx (TLS, proxy)
                     ├──▶ frontend  (Next.js, PM2 "quatatrade-web",   port 3800 in prod)
                     └──▶ backend   (NestJS API, PM2 "quatatrade-api", port 4400 in prod; 4000 in dev)
                                │
                                ├──▶ PostgreSQL 16   (ledger, trades, users, …)
                                ├──▶ Redis 7         (throttling, velocity counters)
                                └──▶ MinIO           (KYC docs, payment proofs, chat files)

backend worker (same codebase, PM2 "quatatrade-worker", src/worker.ts — no HTTP)
      ├── cron: trade timeouts (every 30 s)        — expires unpaid trades, refunds escrow
      ├── cron: deposit scanner + confirmation (every 30 s) — watches TronGrid for incoming USDT
      ├── cron: withdrawal pipeline + confirmation (every 30 s) — drives approved withdrawals to the signer
      ├── cron: reconciliation (every 10 min)      — re-sums ledger vs cache vs chain; pauses withdrawals on mismatch
      ├── cron: outbox relay (every 15 s)          — reliable domain-event delivery
      ├── cron: email send (every 30 s)            — SMTP notification queue
      └── cron: KYC retention purge (daily 3 AM)   — deletes expired KYC data

signer (SEPARATE HOST, human-written, NOT in this repo)
      ◀── mTLS over WireGuard from the worker only
      exposes exactly: POST /sign/withdrawal · POST /sign/escrow-release (reserved) · GET /health
```

- **API and worker are one codebase, two entry points** (`src/main.ts` and `src/worker.ts`). Only the worker imports `ScheduleModule`, so cron jobs run in exactly one process. The deposit-scanning and signing modules load only in the worker.
- **Communication** between modules is through services and an **outbox table** (domain events written in the same transaction as the state change, relayed by a cron), not through message brokers.
- **Module boundary rules:** only the `ledger` module writes ledger tables; only the `escrow` module mutates trade status; `shared/` is the only home of API request/response shapes.

### The signer service (the security centerpiece)

The API and worker are **watch-only**: they hold an extended public key (xpub) and can derive deposit addresses (path `m/44'/195'/0'/0/N`) but can never spend funds. Spending keys live only in the signer, which:

- runs on a second VPS ("Host B") with a default-deny firewall and **no inbound internet** — it is reachable only through a WireGuard VPN tunnel from the app host, with mutual-TLS client certificates on top;
- **independently re-verifies every withdrawal** using its own read-only database credentials (status is APPROVED, amount within per-transaction cap, daily aggregate within cap, destination not blacklisted, dual approval present for large amounts) before signing anything — so even a fully compromised API cannot drain more than the small hot-wallet float within one cap window;
- enforces its own hard caps (per-transaction / per-hour / per-day) in local config, independent of the API and database;
- is kept under ~600 lines and written/reviewed by a human line-by-line — AI tools never generate its code.

In development and on testnet, `SIGNER_MODE=mock` swaps in a mock signer. The production `RemoteSignerService` in this repo is a deliberate stub that validates its mTLS configuration and throws — the real signer does not exist yet, which is one of the launch blockers. The full contract is in `backend/SIGNER.md`.

### Environments

| Environment | Chain | Signer | Domains |
|---|---|---|---|
| Development | TRON Shasta testnet (or local) | mock | localhost (web 3000, API 4000) |
| Staging/testing (retired) | Shasta/Nile testnet | mock | was `trade.quatadigital.com` — vhosts removed after cutover |
| Production | TRON mainnet (capped limits) | remote (Host B) — **not yet built** | `quatatrade.com`, `api.`, `cdn.`, `status.` |

The switch from testnet to production requires no code changes — only DNS and environment variables (`NODE_ENV=production`, `TRON_NETWORK=mainnet`, `SIGNER_MODE=remote`). The env validator refuses to boot production with any unsafe setting (see [§14](#14-environment-configuration)).

---

## 8. The Shared Contract Package (`shared/`)

`@quatatrade/shared` is **the** contract between frontend and backend. Both sides import the same zod schemas, so any drift between what the API returns and what the UI expects becomes a **compile error**, not a runtime bug.

It contains four things:

1. **Zod schemas** (`src/schemas/`, 15 domain files): `common` (UUID, amount strings, E.164 phone, TRON address regex `^T[1-9A-HJ-NP-Za-km-z]{33}$`, pagination, error shape), `auth`, `users`, `kyc`, `wallet`, `offers`, `countries`, `traders`, `trades`, `disputes`, `chat`, `notifications`, `admin` (the largest — KPIs, user detail, withdrawals, kill switch, audit-log verification), `screening`, and `content`. Requests reject unknown fields; passwords require 10+ characters with mixed case and a digit.

2. **The Money helper** (`src/money.ts`): monetary amounts are **BIGINT smallest units** everywhere (1 USDT = 1,000,000 units), travel **as decimal strings on the wire**, and are converted to human-readable form only at the display layer using `decimal.js` (precision 40, always rounding down). Key functions: `parseAmount` (string → bigint, throws on malformed input), `serializeAmount` (bigint → string, rejects negatives), `toDisplay` / `fromDisplay`, `formatXAF` / `formatFiat`. JavaScript `number` is never used for money.

3. **Constants** (`src/constants.ts`) that mirror the PostgreSQL enums one-to-one: asset codes, account kinds, entry reasons, the 9 trade statuses, offer sides, 11 payment methods, KYC/withdrawal/deposit/dispute statuses, 7 admin roles — plus the business numbers: fee basis points (30/50), the 30-minute payment window, KYC tier limits, and the 500 USDT dual-approval threshold.

4. **The typed API client** (`src/client/index.ts`): `QuataApiClient`, a single class wrapping every endpoint under `/api/v1/...`. Each call attaches the bearer token, sends cookies (`credentials: "include"` for the refresh cookie), fires an `onUnauthorized` callback on 401, and **parses every response through its zod schema** before returning. The stated rule: *"Frontend components never call fetch directly."*

Build: `tsup` producing ESM + CJS + `.d.ts` (target ES2022). The backend and frontend both depend on it as `workspace:*`; the root build script always builds `shared` first.

---

## 9. Backend in Detail (`backend/`)

A NestJS 11 modular monolith running on the **Fastify** adapter.

### Bootstrap (`src/main.ts`)

- Fastify with `trustProxy: true` (behind Nginx) and an 8 MiB body limit (base64 KYC uploads).
- `@fastify/helmet`: Content-Security-Policy (`default-src 'self'`, `frame-ancestors 'none'`) and HSTS (1 year, includeSubDomains).
- CORS locked to the single `WEB_ORIGIN` with credentials.
- Global URL prefix `api/v1` (health endpoints excluded).
- Logging via `nestjs-pino` with redaction of `authorization`, `cookie`, `set-cookie`, `password`, `pin`, `totpCode`, and `token` fields.
- Swagger/OpenAPI at `/api/docs` **only** when `SWAGGER_ENABLED=true` and not in production.
- Three global guards, in order: `ThrottlerGuard` (120 requests/min baseline) → `JwtAuthGuard` → `RolesGuard`.
- Validation is a per-route **zod pipe** (`common/zod.pipe.ts`) using the shared schemas — there is no class-validator.

### Modules (`src/modules/`, 24 folders)

| Module | Responsibility |
|---|---|
| `ledger` | **The only writer of money.** Append-only double-entry journal; `postJournal()` posts balanced legs in one transaction with sorted row locks; balances are cached with an optimistic version and invariant checks. |
| `fees` | Pure bigint fee math (`computeFee`, split), floored, property-tested — no floats, no side effects. |
| `escrow` | **The only mutator of `trades.status`.** Ledger-level escrow lock/release/refund driven by the state machine; backed by the `trade_transitions` table and a DB trigger. |
| `trades` | Trade lifecycle orchestration — opening a trade locks the offer amount, locks escrow, and writes events in a single transaction. |
| `offers` | Offer CRUD, pause/activate, min/max/remaining limits, soft balance check on SELL offers. |
| `wallet` | Watch-only: derives per-user TRC-20 deposit addresses from the xpub, computes ledger-derived balances, handles internal QuataPay transfers. |
| `deposits` | (Worker-only) TronGrid scanner + confirmation crediting: credits only if the address is ours, the token contract is the canonical USDT, confirmations ≥ threshold, and the transaction was not already processed. |
| `withdrawals` | Request → risk hold → approval (dual for ≥500 USDT) → signer; caps enforced in service, signer, and DB CHECK. |
| `signer` | Client for the isolated signing service: mock implementation (dev), remote mTLS stub (prod), plus the withdrawal pipeline/confirmation crons. |
| `auth` | Register, email OTP, login, argon2id hashing, rotating refresh tokens with reuse detection, TOTP 2FA, PIN, password reset (revokes all sessions + 24 h withdrawal hold). |
| `users` | Profiles, sessions, public trader pages (`/traders/:id`). |
| `kyc` | Document upload (magic-byte validated → MinIO), manual admin review queue, retention purge job. **No auto-approval path exists.** |
| `disputes` | Open/evidence/resolve; resolution goes only through the escrow service and requires an admin TOTP code. |
| `chat` | Per-trade Socket.IO chat (see below) with attachment pipeline. |
| `risk` | Deterministic risk scoring: velocity counters (Redis), device/IP signals; login and withdrawal risk. |
| `screening` | AML: sanctions/blacklist wallet screening; `assertAllowed()` is the withdrawal chokepoint. |
| `admin` | Admin auth (separate 10-minute tokens, optional-but-enforceable TOTP step-up), RBAC matrix, dashboards, kill switches, user freeze. |
| `treasury` | Fee-revenue and treasury reporting. |
| `settings` | Runtime business config from the `settings` table; kill switches cached with a short TTL. |
| `notify` | Domain events → in-app + email notifications (Handlebars templates over SMTP). |
| `content` | Public CMS content: FAQs, reviews, contact enquiries; admin editing. |
| `countries` | Phased market rollout; enabled countries and dial codes. |
| `health` | `GET /health` (liveness) and `GET /health/ready` (DB, kill switches) — public, unprefixed. |
| `common/` (cross-cutting) | AES-256-GCM crypto helper, UUIDv7 IDs, hash-chained audit log, alert webhooks, JWT/roles guards, Redis client, MinIO storage service. |

### Background jobs

All background work uses `@nestjs/schedule` cron providers, active only in the worker process: trade timeouts and deposit/withdrawal pipelines every 30 seconds, outbox relay every 15 seconds, email queue every 30 seconds, ledger reconciliation every 10 minutes (a mismatch auto-pauses withdrawals), and KYC retention purge daily at 3 AM.

### WebSockets

One Socket.IO gateway: namespace **`/trades`**, one room per trade (`trade:<id>`). The handshake carries the same short-lived JWT as REST; sockets that fail auth are disconnected silently. A client may join a room only if it is the buyer, the seller, or an admin (read-only monitor). Events: `trade:message`, `trade:status`, `trade:typing`.

### Strictness

`tsconfig` has `strict`, `noUncheckedIndexedAccess`, `noImplicitOverride`, and `noFallthroughCasesInSwitch`. ESLint (flat config) errors on `any` everywhere and, **in money-path folders** (`ledger`, `escrow`, `fees`, `wallet`, `withdrawals`, `deposits`, `trades`), additionally bans non-null assertions, `as unknown as` double-casts, `parseFloat`, and `Number(amount|fee|balance|price)` conversions.

---

## 10. Frontend in Detail (`frontend/`)

A Next.js **App Router** application (routes live in `frontend/app/` — there is no `src/` directory).

### Route map

| Area | Routes |
|---|---|
| Public (route group `(public)`) | `/` landing, `/about`, `/contact`, `/fees`, `/help`, `/how-it-works`, `/security`, `/status`, `/legal/[slug]` (terms, privacy, AML, …), `/traders/[id]` public trader profiles |
| Auth (`(auth)`) | `/login` (with TOTP step), `/register`, `/forgot`, `/reset`, `/verify-email` |
| Signed-in app (`(app)`, guarded by layout) | `/home` dashboard, `/markets`, `/trade` (offer browse), `/trade/new`, `/trade/[id]` offer detail, `/trade/room/[id]` **trade room** (status stepper, countdown, proof submission, chat, dispute), `/wallet` + `/wallet/deposit` (address + QR) + `/wallet/withdraw` + `/wallet/transfer`, `/account` + profile/security/kyc/payment-methods/offers/notifications |
| Admin (`/admin`, separate guard + shell) | dashboard (KPIs), `/admin/login`, users (+detail), kyc queue, disputes, withdrawals, trades, treasury, reports, audit log, countries, content, enquiries, settings (incl. kill switch), profile |
| Utility | `/maintenance`, `/suspended`, plus `robots.ts`, `sitemap.ts`, `manifest.ts` (PWA) |

### Key implementation facts

- **Internationalization:** `next-intl` with **English and French**; the locale comes from a `qt_locale` cookie (no `[locale]` URL segments); messages live in `messages/en.json` and `messages/fr.json`. The language toggle writes the cookie and refreshes.
- **Theming:** dark mode is the default; light mode overrides under `[data-theme="light"]`. Theme is a custom cookie-backed store (`lib/theme-store.ts`, `qt_theme` cookie) — the root layout reads the cookie server-side to avoid a flash. No `next-themes`.
- **Styling:** Tailwind v4 configured entirely in `app/globals.css` via `@theme` — brand tokens (`--color-brand-900 #0B3B36` … `--color-accent-400 #2FD4A7`), semantic colors (success/danger/warning/info and a dedicated **escrow** color), radii, and custom keyframes. Fonts are self-hosted via `next/font`: **Space Grotesk** (display), **Inter** (body), **IBM Plex Mono** (money — always tabular numerals via a `.font-money` utility). Full brand rules: `Documents/11-brand-design-system.md` (brand personality: *Protected. Direct. Fresh.*; tagline *"Crypto to cash. Protected."*).
- **Data layer:** TanStack Query with `staleTime` 30 s, one retry, no refetch-on-focus, and **mutations never retried** (money mutations must never be optimistic). Query keys are centralized in `lib/api/query-keys.ts`. All data flows through the shared `QuataApiClient` (`lib/api/client.ts`).
- **Auth handling:** the access token lives **in memory only** (never localStorage); the refresh token is an **httpOnly cookie**. On 401, the client de-duplicates concurrent refreshes and calls `POST /api/v1/auth/refresh`. Admin uses a **separate client** (`lib/api/admin-client.ts`) with its own 10-minute in-memory token and no refresh — expiry forces re-login. Route guarding is client-side in the `(app)` and `admin` layouts; the server independently re-checks every request.
- **Realtime today:** the trade room and chat **poll** via TanStack Query (trade every 5 s, messages every 4 s, admin KPIs every 30 s). `socket.io-client` is installed but not yet wired (see §20).
- **Forms:** auth forms use `react-hook-form` + `zodResolver` with schemas imported from `@quatatrade/shared`; simpler forms use plain state.
- **Charts:** `recharts` in a single admin component (`components/admin/metric-chart.tsx`), SSR-safed behind a hydration gate.
- **Config:** `next.config.ts` enables React strict mode, transpiles `@quatatrade/shared`, wires the next-intl plugin, and allows remote images from `api.dicebear.com` (avatars). Env vars: `NEXT_PUBLIC_API_URL` (default `http://localhost:4000`) and `NEXT_PUBLIC_SITE_URL`.

---

## 11. Database Design

PostgreSQL 16, accessed exclusively through **Kysely** (a typed SQL builder — deliberately no ORM on money paths, for full control of locking and isolation). The node-postgres driver is configured to return `INT8` columns as **native JavaScript `bigint`**, so money can never silently become a float. Primary keys are UUIDv7. There are **17 migrations** (raw SQL, run with a separate owner-role connection) creating **31 tables**.

### Tables by domain

| Domain | Tables | Notes |
|---|---|---|
| Money (the ledger) | `accounts`, `journal_entries`, `ledger_entries`, `account_balances` | One account per (owner, kind, asset). A journal groups the balanced legs of one economic event and carries a **unique idempotency key**. Ledger entries are signed (credit +, debit −) and **append-only**. Balances are a cache with a `CHECK (balance >= 0)` and an optimistic version. |
| Users & auth | `users`, `sessions`, `auth_tokens`, `admins` | Rotating hashed refresh tokens with device info; admins have roles and TOTP. |
| Wallet & chain | `deposit_addresses`, `deposits`, `withdrawals`, `withdrawal_addresses`, `blocked_addresses` | Deposits are idempotent via `UNIQUE(tx_hash, log_index)`; withdrawals have a `big_needs_two` CHECK enforcing dual approval; blocked addresses back AML screening. |
| Trading | `offers`, `trades`, `trade_events`, `trade_transitions`, `trade_payments` | `trades.short_ref` is a human-friendly reference (e.g. QT-8F3K2). `trade_transitions` whitelists legal status changes; `trade_events` is the immutable per-trade history. |
| Disputes & chat | `disputes`, `dispute_evidence`, `trade_messages` | One dispute per trade; chat retained for dispute export. |
| Compliance & ops | `kyc_submissions`, `audit_logs`, `risk_events`, `notifications`, `settings`, `outbox`, `countries` | `audit_logs` is append-only and **hash-chained** (each row stores the previous row's hash — tampering breaks the chain, verifiable via an admin endpoint). `settings` holds runtime config incl. kill switches. |
| Content | `faqs`, `reviews`, `enquiries` | Public-site CMS content. |

### Integrity enforcement in the database itself

- **Append-only ledger:** PostgreSQL `RULE`s turn UPDATE/DELETE on ledger tables into no-ops, *and* those privileges are revoked from the application role. The app connects with a restricted role (`DATABASE_URL`); only the migration runner uses the owner role.
- **Zero-sum journals:** a deferred constraint trigger (`assert_journal_balanced()`) verifies each journal's legs sum to zero at commit.
- **State-machine backstop:** a `BEFORE UPDATE OF status` trigger on `trades` (`assert_trade_transition()`) rejects any status change not whitelisted in `trade_transitions` — even if application code has a bug.
- **Locking discipline:** `postJournal()` locks `account_balances` rows `FOR UPDATE` in sorted account-ID order (deadlock prevention) inside a single transaction; deposit crediting relies on unique-constraint upserts for idempotency. A nightly/periodic reconciliation re-sums entries against the cache and the chain.
- A dedicated **read-only role** (migration `0007`) exists for BI and the dev-time MCP database connector.

---

## 12. Security Setup

Security is the project's organizing principle. Controls by layer (spec: `Documents/08-security-checklist.md`):

### Money integrity
- All amounts are BIGINT smallest units end-to-end; floats are banned by ESLint rules and code review. Fee math is floored integer arithmetic, property-tested with `fast-check`.
- Double-entry, append-only ledger (see §11); balances are always derivable by re-summing entries.
- Every money-moving operation carries an idempotency key and is safe to retry.

### Key custody
- The API/worker never hold spending keys — xpub-only address derivation; the isolated signer (separate host, WireGuard + mTLS, independent re-verification, hard caps) is the only thing that can sign (see §7).
- The cold wallet is a client-held hardware wallet; the hot wallet keeps only a small operational float, swept to cold.
- Production boot **fails hard** if the mock signer, a dev secret, testnet, disabled storage encryption, or disabled admin 2FA is configured (checks in `src/config/env.ts`).

### Authentication and authorization
- Passwords and PINs hashed with **argon2id**; login lockout after 5 failures (15 min); no user-enumeration (constant-time behavior for unknown emails).
- **JWT access tokens ≤ 15 minutes** (default 10); refresh tokens are 48 random bytes, stored only as SHA-256 hashes, delivered in httpOnly cookies, rotated on every use, with **reuse detection that revokes the whole session chain**.
- **TOTP 2FA** (otplib) for users and admins; secrets stored AES-256-GCM-encrypted under a master key; admin step-up 2FA for sensitive actions, enforceable via `ADMIN_2FA_REQUIRED`; dispute resolution requires the admin's TOTP code.
- **RBAC:** 7 admin roles (SUPER_ADMIN, FINANCE_ADMIN, COMPLIANCE_ADMIN, SUPPORT_ADMIN, MODERATOR, AUDITOR, ANALYST) mapped to actions in an explicit matrix; ledger adjustments are SUPER_ADMIN-only; large withdrawals need two distinct approvers. Global guards reject admin tokens on user routes and vice versa.

### Input, uploads, and injection
- zod whitelist validation at every boundary (unknown fields rejected); Kysely parameterizes all SQL.
- Upload pipeline: magic-byte type check (`file-type` semantics; **SVG banned**), re-encode via sharp with EXIF stripped, ClamAV scan, then storage in **private MinIO buckets** served only through short-TTL presigned URLs. KYC files are encrypted at rest (SSE) with a retention-purge job.
- Helmet CSP/HSTS; CORS locked to one origin; rate limiting global (120/min) plus strict per-route buckets on auth endpoints (5–30/min) and an extra in-memory limiter on admin login.

### Auditability and operations
- **Hash-chained, append-only audit log** covering every admin action, escrow transition, and withdrawal approval; chain verifiable via `GET /api/v1/admin/audit-logs/verify`.
- **Kill switches** (global withdrawal pause, trade pause, per-user freeze), admin-triggered, cached with a short TTL, logged.
- Reconciliation mismatches automatically pause withdrawals. Structured pino logs redact credentials; no secrets/PII in logs.
- Secrets: nothing sensitive in the repo (only `.env.example` is tracked; `.gitignore` excludes all real env files); CI runs **gitleaks** on every push; Claude Code settings additionally deny reading any `.env` file.
- Ops runbooks exist in `Documents/ops/` (business continuity, disaster recovery — RPO ≤ 5 min, incident response with severity levels and Law 2024/017 breach-notification duties).

### Compliance posture
- **KYC can never be auto-approved** — no code path exists for it; a commercial provider (Smile ID) is the recommended assist, and any OCR pre-fill is advisory only.
- Risk/fraud decisions are deterministic rules (velocity, device, IP/GeoLite2 signals, duplicate detection, OFAC/OpenSanctions screening) — **no LLMs in decision paths**.
- Data minimization and retention per Cameroon Law No. 2024/017; a written Deviations Log records every place the build differs from client instructions, with reasons.

---

## 13. Integrations and External Services

| Service | Purpose | How it connects |
|---|---|---|
| **TronGrid** | TRON blockchain access — deposit scanning, confirmations, broadcast | HTTPS API with key (`TRONGRID_API_KEY`); a fallback RPC URL is configurable; per-provider circuit breaker planned. The platform does **not** run its own nodes. |
| **MinIO** | S3-compatible object storage for KYC documents, payment proofs, dispute evidence, chat attachments | Private buckets `kyc`, `proofs`, `disputes`, `chat`; access only via short-lived presigned URLs; SSE encryption required in production; exposed publicly as `cdn.quatatrade.com`. |
| **PostgreSQL 16** | System of record | Two roles: restricted app role (no DDL, no UPDATE/DELETE on append-only tables) and owner role for migrations; plus a read-only role for BI/MCP. |
| **Redis 7** | Rate limiting, risk velocity counters | `ioredis`; append-only persistence in dev compose. |
| **SMTP** (Hostinger in production; Mailpit/Mailhog in dev) | Transactional email — OTPs, notifications | `nodemailer` with Handlebars templates; sends queued and retried by the worker. |
| **ClamAV** | Antivirus scan of uploads | TCP daemon (port 3310); toggleable via `CLAMAV_ENABLED`; optional `full` Docker profile in dev. |
| **DiceBear** | User avatars (8 styles) | Remote image host allowed in Next.js config (`api.dicebear.com`). |
| **Signer service** | Transaction signing (the only key holder) | mTLS over WireGuard, worker → Host B only. Mocked in dev; production instance not yet built. |
| Planned (not yet live) | Smile ID (KYC assist), MaxMind GeoLite2, FingerprintJS OSS, OFAC/OpenSanctions feeds, Prometheus + Grafana, Uptime Kuma, GlitchTip error tracking, Firebase FCM push (Phase 2) | Referenced in specs and partially stubbed; see §20. |

---

## 14. Environment Configuration

There is exactly one tracked template: **`.env.example`** (copied to `backend/.env`; never commit a real env file). The backend validates the entire environment with a **zod schema** at boot (`backend/src/config/env.ts`) and refuses to start if anything is missing or invalid.

| Group | Variables |
|---|---|
| App | `NODE_ENV`, `PORT` (default 4000), `WEB_ORIGIN` |
| Database | `DATABASE_URL` (restricted app role), `DATABASE_MIGRATION_URL` (owner role, migrations only), `DATABASE_APP_PASSWORD` |
| Redis | `REDIS_URL` |
| Auth & crypto | `JWT_ACCESS_SECRET` (≥32 chars), `JWT_ACCESS_TTL_SECONDS` (60–900, default 600), `REFRESH_TTL_DAYS` (default 30), `MASTER_ENCRYPTION_KEY` (32-byte base64 — wraps TOTP secrets and KYC file keys), `ADMIN_2FA_REQUIRED` |
| Storage | `MINIO_ENDPOINT`, `MINIO_PORT`, `MINIO_USE_SSL`, `MINIO_ACCESS_KEY`, `MINIO_SECRET_KEY`, `STORAGE_SSE_ENABLED` |
| Email | `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM` |
| TRON | `TRON_NETWORK` (shasta/nile/mainnet), `TRONGRID_API_URL`, `TRONGRID_API_KEY`, `TRON_FALLBACK_RPC_URL`, `USDT_TRC20_CONTRACT`, `DEPOSIT_CONFIRMATIONS` (default 19), `DEPOSIT_MIN_AMOUNT` (default 1 USDT), `WALLET_XPUB` (watch-only), `WALLET_HOT_ADDRESS` |
| Signer | `SIGNER_MODE` (mock/remote), `SIGNER_URL`, `SIGNER_CA_CERT_PATH`, `SIGNER_CLIENT_CERT_PATH`, `SIGNER_CLIENT_KEY_PATH` |
| Uploads AV | `CLAMAV_ENABLED`, `CLAMAV_HOST`, `CLAMAV_PORT` |
| Misc | `SWAGGER_ENABLED`, `LOG_LEVEL`, `ALERT_WEBHOOK_URL` |
| Frontend | `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_SITE_URL` (in `frontend/.env.local`) |

**Production hard-stops:** with `NODE_ENV=production` the app throws at boot if `SIGNER_MODE=mock`, a known dev JWT secret or dev master key is present, Swagger is enabled, `WALLET_XPUB` is empty, `TRON_NETWORK` is not mainnet, storage SSE is off, or admin 2FA enforcement is off.

---

## 15. Local Development Setup

Prerequisites: Node.js ≥ 22, pnpm 11.2.2 (via corepack), Docker.

```bash
pnpm compose:up            # start postgres (port 55432), redis (6379), minio (9000/9001)
cp .env.example backend/.env
pnpm install
pnpm build:shared          # build the contract package first
pnpm migrate               # run the 17 Kysely migrations
pnpm dev:api               # API on http://localhost:4000  (Swagger at /api/docs)
pnpm dev:worker            # background jobs
pnpm dev:web               # web app on http://localhost:3000
```

All root scripts (`package.json`): `dev:api` / `dev:worker` / `dev:web`, `build` (shared → backend → frontend, in order), `build:shared`, `migrate` / `migrate:down`, `test` (shared + backend unit/property), `test:integration` (Testcontainers), `lint`, `typecheck`, `compose:up` / `compose:full` (adds ClamAV) / `compose:down`.

Notes: dev Postgres listens on **55432** to avoid clashing with native installs; a `minio-init` container auto-creates the four private buckets; `pnpm-workspace.yaml` explicitly allowlists which packages may run build scripts (argon2, sharp, esbuild, @swc/core, …) and denies telemetry/optional ones — part of supply-chain hygiene.

---

## 16. Testing and Quality Gates

Framework: **Vitest 3** everywhere, with two backend projects:

- **Unit + property tests** (`pnpm test`): 14 unit spec files plus `fast-check` property tests on fee math (25,000 cases) and money helpers.
- **Integration tests** (`pnpm test:integration`): 8 suites (ledger, escrow, auth, admin, deposits, withdrawals, wallet, screening) running against **real PostgreSQL 16 in Testcontainers**, serially, including concurrency races (e.g. parallel escrow locks must never oversell; concurrent confirm-vs-expiry must produce exactly one terminal state — this suite caught a real ledger bug that was fixed with a SAVEPOINT).

**Coverage policy:** 100% branch/function/line/statement coverage is **enforced** (v8 provider) on the money-path core — `ledger/ledger.service.ts`, `fees/fees.ts`, `escrow/escrow.service.ts` — and currently holds at 100%. The broader target is ≥80% on the rest of the backend. Money-path code is written **tests-first** by project rule.

Current state: **261/261 backend tests green.** End-to-end Playwright tests and load/soak tests are specified for Phase 7 (not yet built).

---

## 17. Continuous Integration (CI)

One GitHub Actions workflow (`.github/workflows/ci.yml`), on every push to `main` and every pull request; ~sequence:

1. Checkout (full history) → **gitleaks secret scan**
2. pnpm 11 + Node 22 with caching → `pnpm install --frozen-lockfile`
3. Build the shared contract package
4. `pnpm -r typecheck` → backend lint (including the money-path `any` ban)
5. Shared + backend unit/property tests
6. Integration tests (Testcontainers PostgreSQL 16)
7. Full build (backend + frontend)
8. `pnpm audit --audit-level high` (dependency vulnerabilities)

Project rule: no merge to `main` without CI green, and money-path changes additionally require their audit-gate suite (see §19).

---

## 18. Deployment and Production Operations

Production runs on a **shared CloudPanel VPS** (other unrelated apps run on the same box — hence pinned ports and the rule to only ever touch `quatatrade-*` PM2 apps).

### Processes (PM2, `ecosystem.config.cjs`)

| PM2 app | What | Port |
|---|---|---|
| `quatatrade-api` | `backend/dist/main.js` | 4400 (prod; from `backend/.env`) |
| `quatatrade-worker` | `backend/dist/worker.js` | — (no HTTP) |
| `quatatrade-web` | `next start` | 3800 |

All fork-mode, single instance, auto-restart, 700 MB memory cap. Nginx (CloudPanel-managed) terminates TLS and proxies: `quatatrade.com` → 127.0.0.1:3800, `api.quatatrade.com` → 127.0.0.1:4400, `cdn.quatatrade.com` → MinIO on 127.0.0.1:9100.

### Deploy flow (`./deploy.sh`)

One command, fail-safe by design: re-executes itself from a temp copy (so `git reset` can't corrupt the running script) → preflight checks (git/node/pm2/curl, `backend/.env` present, Node ≥ 22, pnpm pinned) → records the current commit as a rollback point → `git fetch` + `git reset --hard origin/main` → `pnpm install --frozen-lockfile` → `pnpm build` → `pnpm migrate` (skippable) → `pm2 startOrReload` + `pm2 save` → verifies every PM2 app is online and health-checks the local web port, `https://api.quatatrade.com/health`, and `https://quatatrade.com`. On any error after the pull, it automatically rolls back to the previous commit and rebuilds (database migrations are additive and are deliberately not auto-reverted).

### Domains (`Documents/16-dns-and-subdomains.md`)

Single production domain **`quatatrade.com`** with subdomains: `www` (redirect), `api`, `cdn`, `status`; internal/restricted ones planned (`grafana`, `errors`, `secrets`, `minio`). The signer host **never gets DNS** — WireGuard only. The former testing domain (`trade.quatadigital.com`) has been fully retired.

### Backups and incident response

`scripts/backup-db.sh` produces nightly AES-256-encrypted `pg_dump` archives with 14-day retention (documented restore procedure ends with verifying the audit-log hash chain). The specs additionally call for pgBackRest continuous WAL archiving and restic offsite copies with **monthly restore drills** — configured on paper, not yet proven in production (a launch blocker). Runbooks: `Documents/ops/business-continuity.md`, `disaster-recovery.md` (RPO ≤ 5 min), `incident-response.md` (SEV levels; ledger mismatches are never hand-edited — only via an audited SUPER_ADMIN adjustment endpoint).

---

## 19. Build Phases and Audit-Gate Status

Development follows eight phases (`Documents/05-build-phases.md`), each ending in an **audit gate** — a written, testable checklist that must pass before the next phase ships. Gate records live in `Documents/audits/`.

| Phase | Scope | Gate status |
|---|---|---|
| 0 — Foundation | Monorepo, skeletons, Docker, CI | No gate file signed |
| 1 — Ledger core | Double-entry ledger, fees, postJournal | **PASSED** (2026-07-02; re-verify before mainnet) |
| 2 — Identity & auth | Register/login/JWT/TOTP/PIN | Not signed |
| 3 — Wallet, deposits, withdrawals | xpub derivation, chain scanner, signer contract | **Not signed — crypto-critical launch blocker** |
| 4 — Offers, trades, escrow FSM | The trading core | **CORE PASSED** (2026-07-02; HTTP layer + disputes re-run pending) |
| 5 — Disputes & chat | Evidence, resolution, Socket.IO chat, uploads | Not signed |
| 6 — Admin, RBAC, risk, notify | Dashboards, kill switches, audit chain | Not signed |
| 7 — Hardening & launch prep | E2E, load, backups drill, pen test | **Not signed — the launch gate** |
| 8+ — Deferred | BTC/ETH, Flutter, referrals, FCM, self-hosted nodes | Post-launch |

Also in `Documents/audits/`: a 2026-07-02 security review (6 findings, all confirmed fixed) and a remediation tracker. Every deliberate deviation from the client's original spec or from the docs is recorded in the **Deviations Log** (`Documents/10-client-prompts-appendix.md`) — currently ~26 entries (D1–D26), covering scope decisions (USDT-only, monolith-not-microservices, manual KYC), technical choices made during the build (locking strategy, crypto library substitution, audit-chain sequencing), and later additions (motion library standardization, public trader profiles, country segmentation).

---

## 20. Known Gaps and Documentation-vs-Code Differences

An honest list of where reality differs from the written specs (useful to anyone reading `Documents/` first):

| Topic | Docs say | Code actually has |
|---|---|---|
| Next.js | Next.js 15 | **Next.js 16.2.10** (with React 19.2.4) |
| Realtime in the UI | socket.io-client for trade room and notifications | Backend gateway exists (`/trades` namespace), but the frontend currently **polls** (5 s trade / 4 s chat); `socket.io-client` is installed and unwired |
| Queues | BullMQ queues (`deposits`, `withdrawals`, …) | All background work is `@nestjs/schedule` **cron jobs**; `bullmq` is a declared dependency with zero imports |
| UI kit | shadcn/ui | Hand-written primitives in `components/ui/` (shadcn-style conventions, no shadcn CLI) |
| Charts / tables | `lightweight-charts`, `@tanstack/react-table` | Neither installed; admin charts use **recharts**; tables are plain markup. Market charts await the rate service |
| Auth strategy | passport-jwt strategy | `passport`/`passport-jwt` installed, but JWT is verified directly in a custom guard |
| Encryption at rest | `sodium-native` | Node's built-in **AES-256-GCM** (Deviations D16) |
| postJournal isolation | SERIALIZABLE + retry | **READ COMMITTED + sorted pessimistic locks** (Deviations D14, accepted with rationale) |
| Middleware/i18n routing | (implied) locale routes | Cookie-based locale, no `middleware.ts`; auth guarding is client-side layouts + server-side checks per request |

Open work (from the 2026-07-04 handoff): French versions of the legal pages (the only substantial remaining code item), KYC OCR pre-fill (stubbed), a live XAF/NGN rate feed, switching outbound mail to @quatatrade.com — plus the non-code launch blockers listed in [§2](#2-current-status-at-a-glance) (legal entity/license/lawyer review, the human-written production signer and key ceremony, pen test, live monitoring, offsite backup drills, real SMTP/float accounts).

---

## 21. Developer Tooling (Claude Code, MCP, Skills)

The project is built AI-assisted with strict guardrails (`CLAUDE.md` at the root + `Documents/12-claude-code-skills.md`):

- **Project skills** in `.claude/skills/` encode domain discipline: `quatatrade-ledger` (money rules), `quatatrade-escrow-fsm` (state-machine rules), `quatatrade-api-contract` (FE/BE contract changes), `quatatrade-security-gates` (audit-gate checklists), `quatatrade-brand` (design system).
- **MCP servers** (`.mcp.json`, dev-only): a **read-only** PostgreSQL connector (dedicated `quatatrade_readonly` role, never pointed at production), Context7 (library docs), and Playwright (browser automation).
- **Settings** (`.claude/settings.json`): explicitly **denies reading any `.env` file**; enables official plugins (security-guidance, PR review toolkit, commit commands, CLAUDE.md management).
- Hard behavioral rules: signer code is never AI-generated; money-path diffs must be minimal and reviewable line-by-line; silent assumptions are banned (log to the Deviations Log instead); typecheck + relevant tests must run before claiming any task done.

---

## 22. Where to Read More

| Document | Content |
|---|---|
| `Documents/01-overview.md` | Product definition, decisions, legal guardrails, the canonical trade flow |
| `Documents/02-tech-stack.md` | The definitive stack (additions require a Deviations Log entry) |
| `Documents/03-architecture.md` | Monolith + signer architecture, data flows, environment promotion |
| `Documents/04-database-schema.md` | Full schema with constraints and triggers |
| `Documents/05-build-phases.md` | Phases 0–8 and audit-gate definitions |
| `Documents/06-backend-modules.md` | Module-by-module backend spec, RBAC matrix |
| `Documents/07-frontend-spec.md` | Page inventory and frontend rules |
| `Documents/08-security-checklist.md` | The security control catalog (Gates map to it) |
| `Documents/09-testing-and-integration.md` | Test pyramid, key scenarios, monitoring plan |
| `Documents/10-client-prompts-appendix.md` | Verbatim client spec + the Deviations Log (D1–D26) |
| `Documents/11-brand-design-system.md` | Brand, colors, typography, motion |
| `Documents/14` / `15` | Legal document set (L1–L16), public pages (P1–P35), launch questions |
| `Documents/16` / `17` | DNS/subdomain plan (production + retired testing setup) |
| `Documents/audits/` | Gate 1 & 4 records, security review, remediation tracker |
| `Documents/ops/` | Business continuity, disaster recovery, incident response runbooks |
| `Documents/launch-readiness/` | Current-state handoff (2026-07-04) and the launch readiness report |
| `backend/SIGNER.md` | The full signer-service contract |

---

*This file is a synthesized snapshot (2026-07-04). If it ever disagrees with `Documents/` or the code, the code and `Documents/` win — and the difference belongs in the Deviations Log.*
