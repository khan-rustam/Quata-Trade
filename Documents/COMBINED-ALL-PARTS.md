# QuataTrade — Complete Build Documentation (All Parts Combined)

> Single-file version of the full doc set (Parts 1–11). Load `01` + the relevant part into each Claude Code session; keep this combined file as the master reference.

---


<!-- ============================================================ -->
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


---


<!-- ============================================================ -->
# 01 — Project Overview & Context

> Load this file at the start of every Claude Code session.

## What QuataTrade is

A **P2P cryptocurrency marketplace with escrow protection** for Cameroon / Central Africa (English + French). Buyers and sellers trade crypto directly with each other; fiat payment happens **off-platform** via MTN Mobile Money, Orange Money, or the internal QuataPay wallet. QuataTrade locks the seller's crypto in escrow during the trade and releases it to the buyer when the seller confirms fiat receipt. Revenue = trading fee (0.3% QuataPay / 0.5% MoMo & Orange) collected in crypto into the platform treasury.

It is **not** a centralized order-book exchange. There is no order matching, no market/limit orders, no fiat custody.

## What we are building (Phase 1 scope — authoritative)

- **Asset:** USDT on TRON (TRC20) only. BTC and ETH are Phase 3+. BSC/Polygon deferred indefinitely.
- **Platform:** Responsive web app (Next.js) + admin dashboard. Flutter mobile apps deferred.
- **Payments:** MTN MoMo and Orange Money recorded as off-platform references (we never touch fiat). QuataPay internal wallet = internal ledger transfer.
- **Escrow:** custodial escrow via HD-wallet architecture with an **isolated signing service**; API app is watch-only (xpub).
- **KYC:** Tier structure per client spec, but verification decisions are **manual-review-first**. Commercial provider (Smile ID) is the recommended path; a DIY assist pipeline (OCR pre-fill) may exist but **never auto-approves**.
- **Risk:** deterministic rules engine (velocity, device, IP, duplicate detection). No LLM-based fraud detection in v1.
- **Disputes:** evidence upload + admin resolution center. Escrow frozen during dispute; only admin resolution releases.
- **Chat:** per-trade Socket.IO chat with proof-of-payment upload, admin monitoring, dispute export.
- **Notifications:** email (SMTP) + in-app; FCM push later.
- **Extras deferred:** airtime/data module, dealer module, referral system (stub tables only), AI support chat, analytics beyond basic KPIs.

## Decisions already made (do not re-litigate in code sessions)

| Decision | Choice | Why |
|---|---|---|
| Backend | NestJS 11 + TypeScript strict | Dev reads TS fluently (critical for reviewing AI code); JS has the reference blockchain libs |
| Architecture | Modular monolith + one separate signer service | 7 microservices is an anti-pattern for a solo dev; signer isolation is the only split that buys real security |
| DB | PostgreSQL 16, double-entry append-only ledger | Money integrity |
| Chain access | TronGrid free tier (+ fallback RPC), not self-run nodes | "Self-host everything" costs more than it saves; nodes are Phase 4 at the earliest |
| KYC | Manual-first, Smile ID recommended; DIY auto-approval **banned** | Homegrown liveness/face-match gets farmed by fraud rings; biometric data liability (Cameroon Law 2024/017) |
| AI fraud | Rules engine, not Ollama/LLMs | No labeled data exists pre-launch; LLMs are the wrong tool |
| Client's "no third parties" mandate | Accepted for notify/chat/ledger; **rejected for auto-KYC and unrestricted custody**; compromise architecture for custody | Documented in 10-appendix Deviations Log; developer advised client of risks in writing |

## Legal & safety guardrails baked into the build

These exist because of the CEMAC/COBAC regulatory position on crypto, Cameroon Law No. 2024/017 on personal data, and the developer's personal exposure. They are **product requirements**, not suggestions:

1. **Client holds the keys.** Treasury/cold wallet keys, signer host root access, and withdrawal-approval admin accounts belong to the client's entity. Developer never becomes sole key custodian in production.
2. **Withdrawal caps.** Hot wallet holds a small operational float; withdrawals above threshold require manual admin approval (multi-admin for large amounts).
3. **KYC data minimization.** Documents encrypted at rest per-file, access-audited, retention schedule enforced. The client's "keep everything as AI training data" instruction is implemented **only** as: retain per legal retention policy, with consent language, and no training pipeline in v1.
4. **Audit logs are append-only** and cover every admin action, every escrow transition, every withdrawal approval.
5. **Kill switches:** global withdrawal pause, trade pause, and per-user freeze — admin-triggerable, logged.
6. **Written deviation log** (`10-client-prompts-appendix.md`) records where and why the build differs from client prompts.

## Core trade flow (canonical — memorize)

```
Seller creates offer  →  balance check  →  crypto reserved (available → escrow_reserved)
Buyer opens trade     →  escrow LOCKED for trade amount, payment timer starts (e.g. 30 min)
Buyer pays seller off-platform (MoMo/Orange/QuataPay)
Buyer submits proof   →  status: PAYMENT_SUBMITTED (reference, sender name/number, screenshot)
Seller confirms       →  escrow RELEASES: amount−fee → buyer wallet, fee → treasury  →  COMPLETED
Seller denies / timer expires with no proof →  auto-cancel path → escrow returns to seller
Either party disputes →  DISPUTED: escrow frozen, admin resolution only
```

Golden invariants (tested property-based, enforced by DB constraints):
- Sum of all ledger entries per account/asset ≥ 0 at all times; escrow account balances exactly match open trades.
- For every completed trade: `buyer_credit + fee = escrow_locked_amount`. Exact BIGINT equality.
- No path releases escrow while `status = DISPUTED` except an `admin_resolution` transition.
- Every state transition row exists in `trade_events` before the trade row reflects it (same DB transaction).

## Success criteria for v1 launch

- Full trade lifecycle works end-to-end on TRON **Shasta/Nile testnet**, then mainnet with capped limits (e.g. max 200 USDT/trade, 1,000 USDT hot wallet float).
- Every audit gate in `05-build-phases.md` passed and recorded.
- Concurrency tests prove no double-lock/double-release under parallel load.
- Client sign-off on the deviations log.


---


<!-- ============================================================ -->
# 02 — Definitive Tech Stack

> Adding any dependency not listed here requires a human decision + entry in the Deviations Log. Pin exact versions in lockfiles. Crypto-adjacent npm packages are supply-chain attack targets: enable Dependabot, `npm audit` in CI, Socket.dev free tier.

## Runtime & Language
| Item | Choice | Notes |
|---|---|---|
| Runtime | Node.js 22 LTS | Same for API + signer + worker |
| Language | TypeScript 5.x | `strict: true` everywhere; `noUncheckedIndexedAccess: true`; ESLint bans `any`/`as unknown as` in `ledger/ escrow/ wallet/ withdrawal/ signer/` |
| Package manager | pnpm | Workspace monorepo, strict lockfile |

## Backend
| Concern | Library | Notes |
|---|---|---|
| Framework | `@nestjs/core` 11 + `@nestjs/platform-fastify` | Fastify adapter |
| Config | `@nestjs/config` + zod-validated env schema | App fails fast on missing/invalid env |
| Validation | `zod` at every API boundary | One validation library; class-validator not used |
| Scheduling | `@nestjs/schedule` | Trade timeouts, reconciliation cron |
| Queues | `bullmq` + Redis 7 | Queues: `deposits`, `withdrawals`, `notifications`, `trade-timeouts`, `reconciliation`. Every job carries `idempotencyKey` |
| WebSockets | `@nestjs/websockets` + `socket.io` | Per-trade rooms, admin monitor namespace |
| Logging | `pino` + `pino-http` | Structured JSON; request IDs; never log secrets/PII/full addresses of keys |
| API docs | `@nestjs/swagger` | OpenAPI served only in dev/staging |

## Database & Data
| Concern | Choice | Notes |
|---|---|---|
| DB | PostgreSQL 16 | Single primary; managed backup via pgBackRest |
| Query layer | **Kysely** | Typed SQL builder — full control of `FOR UPDATE`, isolation levels, CHECKs. No Prisma/TypeORM on money paths |
| Migrations | `kysely` migrations (or `node-pg-migrate`) | All schema in VCS; no manual prod changes |
| Money math | BIGINT smallest units in DB + `bigint` in TS | `decimal.js` for display conversion only |
| Cache/locks | Redis 7 | Rate limits, velocity counters, socket adapter |

## Blockchain (Phase 1 = TRON only)
| Concern | Library/Service | Notes |
|---|---|---|
| TRON SDK | `tronweb` | Address gen validation, TRC20 transfer building |
| RPC | TronGrid free tier + one fallback (GetBlock/Ankr free) | API keys in secrets manager; per-provider circuit breaker |
| HD wallets | `bip39`, `bip32`, `@bitcoinerlab/secp256k1` | Seed generated **once, offline, by human**; API app holds **xpub only** |
| Phase 3 (ETH) | `viem` | Preferred over ethers v6 |
| Phase 3 (BTC) | `bitcoinjs-lib` | With regtest test harness |
| Local test chains | TRON Quickstart (docker), later `anvil`, `bitcoind -regtest` | Integration tests never hit mainnet |

## Auth & Security
| Concern | Library | Notes |
|---|---|---|
| Password/PIN hashing | `argon2` (argon2id) | Separate salts; PIN rate-limited 5 attempts → lock |
| Sessions | `passport-jwt` via `@nestjs/passport` | Access token 10 min; refresh token rotating, stored hashed in PG, revocable |
| 2FA | `otplib` + `qrcode` | TOTP; required for withdrawals + admin |
| Headers | `helmet` (fastify variant) | CSP, HSTS |
| Rate limiting | `@nestjs/throttler` + `rate-limiter-flexible` (Redis) | Per-IP + per-user; stricter buckets on auth/withdrawal endpoints |
| Crypto at rest | `sodium-native` | KYC files + any stored sensitive blobs; per-file keys wrapped by master key from secrets manager |
| Secrets | Infisical (self-hosted OSS) or SOPS+age | Nothing sensitive committed; `.env.example` only |

## Frontend
| Concern | Library | Notes |
|---|---|---|
| Framework | Next.js 15 (App Router) + React 19 | |
| Styling | Tailwind CSS 4 + shadcn/ui | Dark + light mode |
| Server state | TanStack Query v5 | Query keys per resource; optimistic updates banned on money data |
| Forms | react-hook-form + `@hookform/resolvers/zod` | Same zod schemas as backend via shared package |
| i18n | `next-intl` | en + fr from day one |
| Realtime | `socket.io-client` | Trade room, notifications |
| Charts | `lightweight-charts` | Markets tab |
| Tables | `@tanstack/react-table` | Admin |
| Shared types | `packages/shared` workspace | zod schemas + inferred types + API client; **the** contract between FE/BE |

## Uploads, Chat Media, KYC Files
| Concern | Choice | Notes |
|---|---|---|
| Storage | MinIO (self-hosted S3) | Private buckets: `kyc/` (encrypted), `proofs/`, `disputes/`; presigned URLs, short TTL |
| Image processing | `sharp` | Re-encode to JPEG/WebP, strip EXIF; originals discarded |
| Type validation | `file-type` (magic bytes) | Allow jpeg/png/webp/pdf(KYC); **SVG banned** |
| AV scan | ClamAV daemon + `clamscan` | Scan before persist |

## KYC & Risk
| Concern | Choice | Notes |
|---|---|---|
| Recommended provider | Smile ID (💰 per check) | Cameroon ID coverage; decision still surfaces in admin queue |
| DIY assist (optional, non-deciding) | PaddleOCR / Tesseract 5, PassportEye (MRZ) | Pre-fills fields for human reviewer only |
| Face match (only if client refuses provider) | DeepFace or InsightFace | **Manual review mandatory**; no auto-approve threshold exists in code |
| IP intel | MaxMind GeoLite2 (free) | VPN/geo signals |
| Device fingerprint | FingerprintJS OSS | Signal, not sole factor |
| Sanctions/wallet screening | OFAC SDN + OpenSanctions datasets (free, refreshed weekly) | Name + wallet screening job |
| Risk engine | Plain TypeScript rules + Redis velocity counters | Config-driven thresholds in DB |

## Notifications
`nodemailer` (SMTP) · MJML + Handlebars templates · in-app via PG table + socket push · `firebase-admin` FCM in Phase 2 · BullMQ retries + `notification_deliveries` log table.

## Testing (see 09 for strategy)
`vitest` · `fast-check` (property tests on ledger/fees) · `@testcontainers/postgresql` + redis · `supertest` · Playwright (E2E) · coverage gate: 100% branch on `ledger/`, `escrow/`, `fees/`; ≥80% elsewhere on backend.

## Infra & Ops
Ubuntu 24.04 VPS ×2 (app host + signer host) · Docker + Compose (no k8s) · Nginx + certbot · ufw, fail2ban, unattended-upgrades · WireGuard tunnel app↔signer · pgBackRest + restic offsite encrypted backups (restore tested monthly) · Prometheus + Grafana + Uptime Kuma · GlitchTip (OSS Sentry) · GitHub Actions CI (lint, typecheck, tests, audit) with husky pre-commit.

## Explicitly banned in this codebase
- Floating point (`number`) for any monetary amount anywhere past the display layer.
- `UPDATE users SET balance = ...` — balances are ledger-derived.
- Private keys or mnemonics in: DB, .env, app host filesystem, logs, or any Claude Code context.
- Auto-approval logic in KYC.
- LLM calls in the fraud/risk decision path.
- `eval`, dynamic `require`, unpinned dependencies, postinstall scripts from unaudited packages.
- Direct status column updates on `trades`/`escrows` outside the state-machine service.


---


<!-- ============================================================ -->
# 03 — Architecture & Repository Structure

## Shape: Modular Monolith + Isolated Signer

The client's spec asks for 7 microservices. We implement the same **capabilities** as modules inside one NestJS app, plus exactly one physically separate service (the signer). Each module keeps a clean internal API (Nest module boundaries + exported service interfaces) so any module can later be extracted into a real microservice without rewriting the platform — this satisfies the client's "independently replaceable components" objective at 1/10th the operational cost.

```
                    ┌────────────────────────────────────────────┐
  Browser ──HTTPS──▶│  Nginx (TLS, rate limit, static)           │
                    └───────────────┬────────────────────────────┘
                                    │
                 ┌──────────────────▼───────────────────┐
                 │  apps/api  (NestJS modular monolith) │
                 │  auth · users · kyc · wallet(watch)  │
                 │  offers · trades · escrow · disputes │
                 │  chat · notify · risk · admin ·      │
                 │  ledger · treasury                   │
                 └──┬───────────┬───────────┬───────────┘
                    │           │           │
              PostgreSQL      Redis       MinIO
                    │           │
                 ┌──▼───────────▼────┐        ┌─────────────────────────┐
                 │ apps/worker       │        │ HOST B (isolated)       │
                 │ BullMQ processors │◀──WG──▶│ apps/signer             │
                 │ deposit scanner   │ tunnel │ holds encrypted keys    │
                 │ withdrawal pipe   │        │ signs within policy     │
                 │ timeouts, recon   │        │ NO inbound internet     │
                 └───────────────────┘        └─────────────────────────┘
                          │
                    TronGrid / fallback RPC (outbound only)
```

## Monorepo layout (pnpm workspaces)

```
quatatrade/
├── CLAUDE.md                  # Claude Code standing rules (from README)
├── docs/                      # THIS documentation set
├── packages/
│   ├── shared/                # zod schemas, DTO types, enums, API client
│   │   └── src/{schemas,types,constants,client}/
│   └── config/                # eslint, tsconfig, prettier presets
├── apps/
│   ├── api/                   # NestJS monolith
│   │   └── src/modules/
│   │       ├── auth/          # register, login, JWT, 2FA, sessions, PIN
│   │       ├── users/         # profiles, devices, security center
│   │       ├── kyc/           # tiers, submissions, review queue (manual)
│   │       ├── ledger/        # double-entry core — HIGHEST REVIEW PRIORITY
│   │       ├── wallet/        # watch-only: xpub address derivation, balances
│   │       ├── deposits/      # confirmation tracking, credit logic
│   │       ├── withdrawals/   # request → risk → approval → signer handoff
│   │       ├── offers/        # create/edit/pause, limits, filters
│   │       ├── trades/        # lifecycle orchestration
│   │       ├── escrow/        # state machine — HIGHEST REVIEW PRIORITY
│   │       ├── fees/          # pure fee math functions (property-tested)
│   │       ├── disputes/      # evidence, timeline, admin resolution
│   │       ├── chat/          # socket gateway, proof uploads
│   │       ├── risk/          # rules engine, velocity, device, sanctions
│   │       ├── notify/        # email/in-app dispatch + delivery log
│   │       ├── admin/         # RBAC, dashboards APIs, kill switches
│   │       ├── treasury/      # fee accounts, revenue reports
│   │       └── health/        # readiness, chain-lag, reconciliation status
│   ├── worker/                # same codebase modules, BullMQ processors entry
│   ├── signer/                # SEPARATE deployable — see below
│   └── web/                   # Next.js 15
│       └── src/app/{(public),(auth),(app)/{home,markets,trade,wallet,account},admin}/
├── infra/
│   ├── docker-compose.yml     # dev: pg, redis, minio, clamav, tron-quickstart
│   ├── docker-compose.prod.yml
│   └── nginx/, prometheus/, grafana/
└── .github/workflows/ci.yml
```

## Module boundary rules

1. Modules talk through exported **service interfaces**, never through each other's tables. Only `ledger` writes ledger tables; only `escrow` mutates trade/escrow state; everyone else calls them.
2. `packages/shared` is the only place API request/response shapes live. Frontend imports the same zod schemas — a contract mismatch is a compile error, which is how "we will test the integration of backend and frontend completely with types" is enforced structurally.
3. Domain events (`trade.locked`, `payment.submitted`, `escrow.released`, `dispute.opened`, `withdrawal.approved`) are emitted via a thin in-process event bus + outbox table; `notify`, `risk`, and `audit` subscribe. This is the client's "event-driven communication" — without Kafka.
4. Every module folder contains: `*.module.ts`, `*.service.ts`, `*.controller.ts`, `dto/` (zod), `*.spec.ts`, and `README.md` (10 lines: purpose, invariants, who may call it).

## The signer service (apps/signer) — isolation contract

- Runs on **Host B**: separate VPS, ufw default-deny, **no inbound internet**; reachable only via WireGuard from Host A; outbound only to RPC providers.
- Holds the encrypted hot-wallet key material (sodium sealed, master key entered at process start by a human or fetched from Infisical over the tunnel — **never** on disk in plaintext, never in the repo, never shown to Claude Code).
- Exposes exactly three mTLS endpoints over the tunnel:
  - `POST /sign/withdrawal` — input: withdrawal ID. Signer independently re-reads the withdrawal row from PG (read-only creds), verifies status = `APPROVED`, verifies amount ≤ per-tx cap, verifies daily aggregate ≤ daily cap, verifies destination not on blacklist, then signs + broadcasts + writes tx hash. **Policy checks live in the signer**, so a compromised API cannot make it sign arbitrary transactions.
  - `POST /sign/escrow-release` — same pattern for escrow → buyer transfers (if on-chain movement is used; internal-ledger escrow needs no signing).
  - `GET /health`
- Hard caps in signer config: max per-tx, max per-hour, max per-day. Exceeding = refuse + alert, regardless of what the API says.
- Cold wallet: hardware wallet held by **client**, receives sweep above hot float threshold; signer only ever knows hot keys.
- **Claude Code never generates signer code unattended.** Human writes/reviews this app line-by-line; it should stay under ~600 lines total.

## Escrow model decision (important nuance)

Escrow is **ledger-level**, not per-trade on-chain movement: user deposits land in platform deposit addresses and are swept to the hot/cold wallets; the internal ledger tracks each user's balance; "locking escrow" = ledger transfer `user:available → user:escrow` inside a serializable PG transaction. On-chain transactions happen only for deposits, withdrawals, and sweeps. This is how real P2P platforms work — it makes escrow atomic, instant, fee-free, and testable, and concentrates all chain risk into the deposit/withdrawal pipelines.

## Environments

| Env | Chain | Purpose |
|---|---|---|
| dev (local compose) | TRON Quickstart / Shasta | daily development |
| staging (small VPS) | Shasta or Nile testnet | full E2E incl. real RPC |
| prod | TRON mainnet | capped limits at launch |

Promotion requires: CI green, audit gate for the phase passed, migration dry-run on staging snapshot.


---


<!-- ============================================================ -->
# 04 — Database Schema (PostgreSQL 16)

> Authoritative schema for Phase 1. All amounts BIGINT smallest units (USDT-TRC20 = 6 decimals → 1 USDT = 1_000_000). All tables get `created_at timestamptz NOT NULL DEFAULT now()`; mutable tables also `updated_at`. UUIDv7 primary keys (`id uuid PRIMARY KEY DEFAULT uuidv7()` via extension or app-generated).

## 4.1 Enums

```sql
CREATE TYPE asset_code       AS ENUM ('USDT_TRC20');            -- extend later: BTC, ETH
CREATE TYPE account_kind     AS ENUM ('user_available','user_escrow','platform_treasury',
                                      'platform_hot','platform_pending_sweep');
CREATE TYPE entry_reason     AS ENUM ('deposit_credit','withdrawal_debit','withdrawal_fee',
                                      'escrow_lock','escrow_release_buyer','escrow_release_fee',
                                      'escrow_refund','internal_transfer','adjustment');
CREATE TYPE trade_status     AS ENUM ('OPENED','ESCROW_LOCKED','PAYMENT_SUBMITTED',
                                      'COMPLETED','CANCELLED','EXPIRED','DISPUTED',
                                      'RESOLVED_RELEASE','RESOLVED_REFUND');
CREATE TYPE offer_status     AS ENUM ('ACTIVE','PAUSED','EXHAUSTED','DELETED');
CREATE TYPE offer_side       AS ENUM ('SELL','BUY');
CREATE TYPE payment_method   AS ENUM ('QUATAPAY','MTN_MOMO','ORANGE_MONEY');
CREATE TYPE kyc_status       AS ENUM ('NONE','PENDING','APPROVED','REJECTED','RESUBMIT');
CREATE TYPE withdrawal_status AS ENUM ('REQUESTED','RISK_HOLD','PENDING_APPROVAL','APPROVED',
                                       'SIGNING','BROADCAST','CONFIRMED','REJECTED','FAILED');
CREATE TYPE deposit_status   AS ENUM ('SEEN','CONFIRMING','CREDITED','ORPHANED','IGNORED_DUST');
CREATE TYPE dispute_status   AS ENUM ('OPEN','AWAITING_EVIDENCE','UNDER_REVIEW','RESOLVED');
CREATE TYPE admin_role       AS ENUM ('SUPER_ADMIN','FINANCE_ADMIN','COMPLIANCE_ADMIN',
                                      'SUPPORT_ADMIN','MODERATOR','AUDITOR','ANALYST');
```

## 4.2 The Ledger (heart of the system — append-only double-entry)

```sql
-- One row per (owner, kind, asset). Users get user_available + user_escrow per asset.
CREATE TABLE accounts (
  id          uuid PRIMARY KEY,
  owner_user_id uuid REFERENCES users(id),        -- NULL for platform accounts
  kind        account_kind NOT NULL,
  asset       asset_code   NOT NULL,
  UNIQUE (owner_user_id, kind, asset)
);

-- A journal groups the balanced legs of one economic event.
CREATE TABLE journal_entries (
  id              uuid PRIMARY KEY,
  reason          entry_reason NOT NULL,
  reference_type  text NOT NULL,        -- 'trade' | 'deposit' | 'withdrawal' | ...
  reference_id    uuid NOT NULL,
  idempotency_key text NOT NULL UNIQUE, -- retry-safe money movement
  created_by      text NOT NULL         -- 'system' | admin id
);

-- Legs. Amount signed: positive = credit, negative = debit.
CREATE TABLE ledger_entries (
  id          uuid PRIMARY KEY,
  journal_id  uuid NOT NULL REFERENCES journal_entries(id),
  account_id  uuid NOT NULL REFERENCES accounts(id),
  asset       asset_code NOT NULL,
  amount      bigint NOT NULL CHECK (amount <> 0),
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON ledger_entries (account_id, created_at);

-- Append-only enforcement at DB level:
CREATE RULE ledger_no_update AS ON UPDATE TO ledger_entries DO INSTEAD NOTHING;
CREATE RULE ledger_no_delete AS ON DELETE TO ledger_entries DO INSTEAD NOTHING;
-- (also REVOKE UPDATE, DELETE from the app role)

-- Zero-sum invariant per journal, deferred to commit:
CREATE OR REPLACE FUNCTION assert_journal_balanced() RETURNS trigger AS $$
BEGIN
  IF (SELECT COALESCE(SUM(amount),0) FROM ledger_entries WHERE journal_id = NEW.journal_id) <> 0
  THEN RAISE EXCEPTION 'journal % not balanced', NEW.journal_id; END IF;
  RETURN NULL;
END $$ LANGUAGE plpgsql;
CREATE CONSTRAINT TRIGGER trg_journal_balanced
  AFTER INSERT ON ledger_entries DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION assert_journal_balanced();

-- Cached balances (performance) — ONLY written by ledger service in the same tx,
-- with non-negativity enforced for user accounts:
CREATE TABLE account_balances (
  account_id uuid PRIMARY KEY REFERENCES accounts(id),
  balance    bigint NOT NULL DEFAULT 0,
  version    bigint NOT NULL DEFAULT 0,           -- optimistic check
  CONSTRAINT non_negative CHECK (balance >= 0)
);
```

**Ledger service contract (TypeScript):** single method `postJournal({reason, reference, idempotencyKey, legs: [{accountId, amount}]})` that, in ONE serializable transaction: locks affected `account_balances` rows `FOR UPDATE` in a **globally consistent order (sorted by account_id)** to prevent deadlocks, inserts journal + legs, updates cached balances, and relies on CHECK + trigger as the last line of defense. Nightly reconciliation job re-sums entries vs cache and vs on-chain wallet totals; any mismatch → alert + withdrawal pause.

## 4.3 Users, Auth, KYC

```sql
CREATE TABLE users (
  id uuid PRIMARY KEY, email citext UNIQUE NOT NULL, phone text UNIQUE,
  password_hash text NOT NULL, pin_hash text,
  first_name text, last_name text, country char(2) NOT NULL DEFAULT 'CM',
  email_verified_at timestamptz, phone_verified_at timestamptz,
  kyc_tier smallint NOT NULL DEFAULT 0, kyc_status kyc_status NOT NULL DEFAULT 'NONE',
  totp_secret_enc bytea, totp_enabled boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'active'
    CHECK (status IN ('active','frozen','suspended','closed')),
  reputation_score int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz
);

CREATE TABLE sessions (            -- rotating refresh tokens
  id uuid PRIMARY KEY, user_id uuid NOT NULL REFERENCES users(id),
  refresh_hash text NOT NULL, device_fingerprint text, ip inet, user_agent text,
  expires_at timestamptz NOT NULL, revoked_at timestamptz, rotated_from uuid
);

CREATE TABLE kyc_submissions (
  id uuid PRIMARY KEY, user_id uuid NOT NULL REFERENCES users(id),
  tier smallint NOT NULL, doc_type text NOT NULL,
  files jsonb NOT NULL,             -- MinIO object keys (encrypted objects)
  ocr_prefill jsonb,                -- assist only, never a decision
  status kyc_status NOT NULL DEFAULT 'PENDING',
  reviewed_by uuid REFERENCES admins(id), review_notes text, reviewed_at timestamptz,
  retention_delete_after date NOT NULL      -- data-protection retention schedule
);
```

## 4.4 Wallets, Deposits, Withdrawals

```sql
CREATE TABLE deposit_addresses (
  id uuid PRIMARY KEY, user_id uuid NOT NULL REFERENCES users(id),
  asset asset_code NOT NULL, address text NOT NULL UNIQUE,
  derivation_path text NOT NULL UNIQUE,      -- from xpub, e.g. m/44'/195'/0'/0/N
  active boolean NOT NULL DEFAULT true
);

CREATE TABLE deposits (
  id uuid PRIMARY KEY, user_id uuid NOT NULL, asset asset_code NOT NULL,
  address text NOT NULL, tx_hash text NOT NULL, log_index int NOT NULL DEFAULT 0,
  amount bigint NOT NULL CHECK (amount > 0),
  token_contract text NOT NULL,               -- MUST equal canonical USDT contract
  block_number bigint, confirmations int NOT NULL DEFAULT 0,
  status deposit_status NOT NULL DEFAULT 'SEEN',
  credited_journal_id uuid REFERENCES journal_entries(id),
  UNIQUE (tx_hash, log_index)                  -- idempotent scanning
);

CREATE TABLE withdrawals (
  id uuid PRIMARY KEY, user_id uuid NOT NULL, asset asset_code NOT NULL,
  to_address text NOT NULL, amount bigint NOT NULL CHECK (amount > 0),
  fee bigint NOT NULL CHECK (fee >= 0),
  status withdrawal_status NOT NULL DEFAULT 'REQUESTED',
  risk_score int, risk_flags jsonb,
  approved_by uuid REFERENCES admins(id), second_approver uuid REFERENCES admins(id),
  tx_hash text, failure_reason text,
  idempotency_key text NOT NULL UNIQUE,
  CONSTRAINT big_needs_two CHECK (amount < 500000000 OR second_approver IS NOT NULL)
  -- example: ≥500 USDT requires two admins; tune via config + keep DB backstop
);
```

## 4.5 Offers, Trades, Escrow State Machine

```sql
CREATE TABLE offers (
  id uuid PRIMARY KEY, user_id uuid NOT NULL REFERENCES users(id),
  side offer_side NOT NULL, asset asset_code NOT NULL,
  price_xaf_per_unit bigint NOT NULL CHECK (price_xaf_per_unit > 0),  -- XAF per whole USDT
  min_trade bigint NOT NULL, max_trade bigint NOT NULL,
  remaining bigint NOT NULL CHECK (remaining >= 0),
  payment_methods payment_method[] NOT NULL,
  terms text, status offer_status NOT NULL DEFAULT 'ACTIVE',
  CHECK (min_trade > 0 AND min_trade <= max_trade)
);

CREATE TABLE trades (
  id uuid PRIMARY KEY, short_ref text UNIQUE NOT NULL,   -- human ref e.g. QT-8F3K2
  offer_id uuid NOT NULL REFERENCES offers(id),
  seller_id uuid NOT NULL, buyer_id uuid NOT NULL CHECK (buyer_id <> seller_id),
  asset asset_code NOT NULL,
  amount bigint NOT NULL CHECK (amount > 0),             -- crypto in escrow
  price_xaf_per_unit bigint NOT NULL,
  fiat_amount_xaf bigint NOT NULL,
  payment_method payment_method NOT NULL,
  fee_bps int NOT NULL,                                   -- 30 or 50
  fee_amount bigint NOT NULL CHECK (fee_amount >= 0),
  status trade_status NOT NULL DEFAULT 'OPENED',
  payment_deadline timestamptz, completed_at timestamptz,
  escrow_journal_id uuid, release_journal_id uuid,
  CHECK (fee_amount < amount)
);

-- Immutable event log — every transition writes here in the SAME transaction:
CREATE TABLE trade_events (
  id uuid PRIMARY KEY, trade_id uuid NOT NULL REFERENCES trades(id),
  from_status trade_status, to_status trade_status NOT NULL,
  actor text NOT NULL,          -- 'buyer' | 'seller' | 'system' | 'admin:<id>'
  metadata jsonb, created_at timestamptz NOT NULL DEFAULT now()
);

-- Allowed transitions enforced in DB (backstop to the service-level FSM):
CREATE TABLE trade_transitions (from_status trade_status, to_status trade_status,
                                PRIMARY KEY (from_status,to_status));
INSERT INTO trade_transitions VALUES
 ('OPENED','ESCROW_LOCKED'), ('OPENED','CANCELLED'),
 ('ESCROW_LOCKED','PAYMENT_SUBMITTED'), ('ESCROW_LOCKED','CANCELLED'),
 ('ESCROW_LOCKED','EXPIRED'), ('ESCROW_LOCKED','DISPUTED'),
 ('PAYMENT_SUBMITTED','COMPLETED'), ('PAYMENT_SUBMITTED','DISPUTED'),
 ('PAYMENT_SUBMITTED','CANCELLED'),
 ('DISPUTED','RESOLVED_RELEASE'), ('DISPUTED','RESOLVED_REFUND');

CREATE OR REPLACE FUNCTION assert_trade_transition() RETURNS trigger AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM trade_transitions
                 WHERE from_status = OLD.status AND to_status = NEW.status)
  THEN RAISE EXCEPTION 'illegal trade transition % -> %', OLD.status, NEW.status; END IF;
  RETURN NEW;
END $$ LANGUAGE plpgsql;
CREATE TRIGGER trg_trade_fsm BEFORE UPDATE OF status ON trades
  FOR EACH ROW EXECUTE FUNCTION assert_trade_transition();
```

**Escrow lock procedure (service-level, serializable tx):** lock seller `user_available` balance row FOR UPDATE → verify `balance >= amount` → `postJournal(escrow_lock: available −amount / escrow +amount)` → decrement `offers.remaining` (guard `remaining >= amount`) → update trade status via FSM → insert trade_event → set `payment_deadline = now() + interval`. Any failure rolls back everything.

**Release (seller confirms):** verify actor is seller + 2FA/PIN if configured → status must be `PAYMENT_SUBMITTED` → `postJournal`: seller escrow −amount; buyer available +(amount−fee); treasury +fee → status `COMPLETED`. **Refund/expiry:** escrow −amount / seller available +amount. **Dispute:** status only; funds untouched; only `admin:<id>` actor may perform `RESOLVED_*`.

## 4.6 Payments proof, Disputes, Chat

```sql
CREATE TABLE trade_payments (
  id uuid PRIMARY KEY, trade_id uuid NOT NULL REFERENCES trades(id) UNIQUE,
  reference text NOT NULL, sender_name text NOT NULL, sender_number text NOT NULL,
  proof_files jsonb NOT NULL, submitted_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE disputes (
  id uuid PRIMARY KEY, trade_id uuid NOT NULL REFERENCES trades(id) UNIQUE,
  opened_by uuid NOT NULL, reason text NOT NULL,
  status dispute_status NOT NULL DEFAULT 'OPEN',
  resolution text CHECK (resolution IN ('RELEASE_TO_BUYER','REFUND_TO_SELLER')),
  resolved_by uuid REFERENCES admins(id), resolution_notes text, resolved_at timestamptz
);
CREATE TABLE dispute_evidence (
  id uuid PRIMARY KEY, dispute_id uuid NOT NULL REFERENCES disputes(id),
  submitted_by uuid NOT NULL, kind text NOT NULL, files jsonb, note text
);

CREATE TABLE trade_messages (
  id uuid PRIMARY KEY, trade_id uuid NOT NULL REFERENCES trades(id),
  sender_id uuid NOT NULL, body text, attachment_key text,
  created_at timestamptz NOT NULL DEFAULT now()
);  -- retained ≥ trade retention window for dispute export; no hard delete while trade disputed
```

## 4.7 Admin, Audit, Risk, Notify

```sql
CREATE TABLE admins (
  id uuid PRIMARY KEY, email citext UNIQUE NOT NULL, password_hash text NOT NULL,
  role admin_role NOT NULL, totp_secret_enc bytea NOT NULL,   -- 2FA mandatory
  active boolean NOT NULL DEFAULT true
);

CREATE TABLE audit_logs (        -- append-only (same RULE/REVOKE pattern as ledger)
  id uuid PRIMARY KEY, actor_type text NOT NULL, actor_id uuid,
  action text NOT NULL, target_type text, target_id uuid,
  ip inet, metadata jsonb, created_at timestamptz NOT NULL DEFAULT now(),
  prev_hash bytea, row_hash bytea          -- hash chain for tamper evidence
);

CREATE TABLE risk_events (
  id uuid PRIMARY KEY, user_id uuid, kind text NOT NULL, score int NOT NULL,
  flags jsonb, action_taken text, created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE notifications (
  id uuid PRIMARY KEY, user_id uuid NOT NULL, channel text NOT NULL,
  template text NOT NULL, payload jsonb NOT NULL,
  status text NOT NULL DEFAULT 'queued', attempts int NOT NULL DEFAULT 0,
  delivered_at timestamptz
);

CREATE TABLE settings (key text PRIMARY KEY, value jsonb NOT NULL,
                       updated_by uuid, updated_at timestamptz);
-- fee_bps per method, trade timeout minutes, withdrawal caps, kill switches, KYC tier limits
```

## 4.8 Isolation & locking policy (memorize)

| Operation | Isolation | Locking |
|---|---|---|
| postJournal (all money moves) | SERIALIZABLE (retry on 40001, max 3, jitter) | account_balances FOR UPDATE, sorted order |
| Trade open / escrow lock | SERIALIZABLE | seller balance row + offer row FOR UPDATE |
| Seller confirm / release | SERIALIZABLE | trade row FOR UPDATE first, then balances |
| Deposit credit | READ COMMITTED + UNIQUE(tx_hash,log_index) upsert | idempotent by constraint |
| Withdrawal request | SERIALIZABLE | balance FOR UPDATE (debit at request time into pending) |
| Reads/dashboards | READ COMMITTED | none |

Every money service method must be written to be **retried safely** (idempotency key) because serializable transactions will abort under contention — this is expected behavior, not an error.


---


<!-- ============================================================ -->
# 05 — Build Phases, Start/End Points & Audit Gates

> Build strictly in this order. Each phase has: **Start** (entry criteria), **Build** (what to make), **End / Definition of Done**, and an **AUDIT GATE** (must pass before next phase). Do not let Claude Code jump ahead. Each gate references sections in `08-security-checklist.md` and `09-testing-and-integration.md`.

## Phase 0 — Foundation (no business logic yet)
**Start:** empty repo.
**Build:**
- pnpm monorepo, `packages/shared`, `packages/config` (eslint/tsconfig/prettier), `CLAUDE.md`.
- `apps/api` Nest skeleton (fastify, config with zod env validation, pino, swagger dev-only, helmet, throttler).
- `apps/web` Next.js 15 skeleton (Tailwind, shadcn, next-intl en/fr, TanStack Query provider).
- `infra/docker-compose.yml`: postgres, redis, minio, clamav, tron-quickstart.
- CI: lint + typecheck + test + `npm audit`; husky pre-commit.
- ESLint override banning `any` in money folders (even though empty now).
**End/DoD:** `docker compose up` runs; `/health` returns green; CI passes on an empty test.
**AUDIT GATE 0:** secrets not in repo; `.env.example` only; strict tsconfig verified; branch protection on.

## Phase 1 — Ledger core (the foundation everything trusts)
**Start:** Phase 0 gate passed.
**Build:** `ledger` module exactly per `04-database-schema.md`: migrations for accounts/journal/entries/balances, append-only RULEs + REVOKE, balanced-journal trigger, `postJournal()` with serializable + sorted FOR UPDATE + idempotency, reconciliation job skeleton, `fees` module (pure functions).
**End/DoD:** can post balanced journals; double-spend and negative-balance attempts rejected by DB.
**AUDIT GATE 1 (heaviest):**
- Property tests (fast-check): random sequences of deposits/locks/releases/refunds → sum of all entries per journal always 0; user balances never negative; cache == recomputed sum. (§9 ledger tests)
- Concurrency test (Testcontainers): N parallel escrow locks on same seller balance → only up to available succeed, never oversell. (§8 concurrency)
- Fee math property tests: `fee = floor(amount * bps / 10000)`, `buyer_credit + fee == amount`, no rounding leak, all BIGINT. (§8 money math)
- 100% branch coverage on `ledger/` + `fees/`.
**Nothing proceeds until Gate 1 is green.**

## Phase 2 — Identity & auth
**Start:** Gate 1 passed.
**Build:** `auth` (register, email/phone OTP, login, argon2, JWT access+rotating refresh, revocation, PIN, TOTP 2FA), `users` (profile, sessions, devices), rate limiting on auth endpoints, account status/freeze.
**End/DoD:** full register→verify→login→refresh→logout; 2FA enforced where required.
**AUDIT GATE 2:** §8 auth checklist — token expiry/rotation/revocation proven by tests; brute-force lockouts; no user enumeration; PIN + password hashed (argon2id); IDOR tests on user endpoints.

## Phase 3 — Wallet (watch-only) + deposits + withdrawals
**Start:** Gate 2 passed. Seed generated offline by human; **xpub only** loaded into api config; signer deployed on Host B with hot key.
**Build:** `wallet` (derive TRC20 deposit addresses from xpub), `deposits` (BullMQ scanner via TronGrid: match address, verify canonical USDT contract, confirmation threshold, `UNIQUE(tx_hash,log_index)` idempotent credit → postJournal), `withdrawals` (request→debit to pending→risk→approval→signer handoff→broadcast→confirm), signer mTLS integration with independent policy re-checks + caps.
**End/DoD:** testnet deposit auto-credits after N confirmations; testnet withdrawal completes through approval + signer.
**AUDIT GATE 3 (crypto-critical):** §8 blockchain checklist — fake-token-contract deposit rejected; unconfirmed/dust not credited; reorg handling; withdrawal cannot exceed balance or caps; signer refuses non-APPROVED / over-cap / blacklisted; **no private key anywhere in api/worker/db/logs**; reconciliation (on-chain vs ledger) job green.

## Phase 4 — Offers + trades + escrow state machine
**Start:** Gate 3 passed.
**Build:** `offers` (CRUD, limits, remaining guard), `trades` + `escrow` (FSM per §4.5: open→lock→payment_submitted→complete/cancel/expire/dispute), payment-proof submission (`trade_payments`), trade timeout auto-cancel job, `short_ref` generation.
**End/DoD:** full happy-path trade completes; timeout refunds seller; illegal transitions rejected by DB trigger.
**AUDIT GATE 4:** §8 escrow checklist — no release while DISPUTED; concurrent "open trade" against same offer cannot oversell `remaining`; double-confirm idempotent (second confirm no-ops); expiry vs confirm race resolves to exactly one outcome; every transition wrote a `trade_event` in the same tx.

## Phase 5 — Disputes + chat
**Start:** Gate 4 passed.
**Build:** `disputes` (open, evidence upload, timeline, admin resolution → RESOLVED_RELEASE/REFUND via escrow service only), `chat` (Socket.IO per-trade room, message persistence, proof upload via sharp+file-type+ClamAV to MinIO, admin monitor namespace, dispute export).
**End/DoD:** dispute freezes escrow; admin resolution moves funds correctly; chat + uploads work with sanitization.
**AUDIT GATE 5:** §8 upload + chat checklist — SVG blocked, EXIF stripped, AV-scanned, size-limited, presigned short-TTL URLs, no IDOR on trade rooms/files; only COMPLIANCE/SUPPORT admins can resolve; resolution writes audit log.

## Phase 6 — Admin + RBAC + risk + notify
**Start:** Gate 5 passed.
**Build:** `admin` (RBAC guards per role matrix, dashboards APIs: users, trades, escrows, disputes, KYC queue, withdrawals approval, revenue/treasury, kill switches), `kyc` (manual review queue; Smile ID integration OR OCR-assist-only), `risk` (velocity, device, IP/GeoLite2, sanctions screening, duplicate detection), `notify` (email + in-app + delivery log).
**End/DoD:** admin can run the platform; kill switches work; KYC reviewed manually; risk flags surface; withdrawals require correct roles/approvals.
**AUDIT GATE 6:** §8 admin/RBAC checklist — every admin action audit-logged with hash chain; role escalation blocked; two-admin rule for large withdrawals enforced end-to-end; KYC never auto-approves; kill switch halts withdrawals + trades.

## Phase 7 — Hardening, E2E, launch prep
**Start:** Gate 6 passed.
**Build:** full Playwright E2E (register→KYC→deposit→offer→trade→dispute→withdraw), load/concurrency soak, backup+restore drill, monitoring dashboards + alerts, pen-test-style review, incident runbook, deviations log sign-off with client.
**End/DoD:** all gates green; staging soak clean; restore tested; client signs deviations log; mainnet with capped limits.
**AUDIT GATE 7 (launch):** full §8 checklist re-run; §9 integration matrix 100%; reconciliation running + alerting; caps in place (max trade, hot float, daily withdrawal); rollback plan documented.

## Phase 8+ (post-launch, deferred) 
BTC/ETH assets, Flutter apps, referral payouts, airtime/data module, dealer module, analytics depth, FCM push, self-hosted nodes, ML risk scoring (only once labeled fraud data exists). Each is its own mini-cycle with its own audit gate.

---

### Gate discipline (applies to all)
A gate is passed only when: CI green · required tests written **before** the code they cover on money paths · coverage thresholds met · the specific §8 checklist items ticked in a checklist file committed to `docs/audits/gate-N.md` with date + commit hash. If a gate fails, feature work stops until it's green. This is how you "monitor each and everything."


---


<!-- ============================================================ -->
# 06 — Backend Modules (NestJS) Specification

> One section per module. Each lists: responsibility, key endpoints, invariants/rules, who may call it, and events emitted. Endpoints are REST under `/api/v1`. All inputs validated with zod from `packages/shared`. All money amounts are BIGINT strings over the wire (JSON has no bigint) → parsed to `bigint` server-side, never `number`.

## ledger  (review priority #1)
**Responsibility:** the only writer of `journal_entries`, `ledger_entries`, `account_balances`. Exposes `postJournal()` and read helpers.
**No HTTP endpoints** (internal service only).
**Rules:** serializable tx; sorted `FOR UPDATE`; idempotency key unique; balanced legs; non-negative user balances; retry on serialization failure (max 3, jittered).
**Callers:** deposits, withdrawals, escrow, treasury, admin adjustments (adjustments require SUPER_ADMIN + audit + reason).
**Emits:** `ledger.posted`.

## fees  (review priority #1)
**Responsibility:** pure functions. `computeFee(amount, bps): bigint = amount * bps / 10000` floored; `split(amount, bps): {buyerCredit, fee}` with `buyerCredit + fee === amount`.
**Rules:** no I/O, no floats, property-tested exhaustively. bps from settings (30 QuataPay, 50 MoMo/Orange).

## auth
**Endpoints:** `POST /auth/register`, `/auth/verify-email`, `/auth/verify-phone`, `/auth/login`, `/auth/refresh`, `/auth/logout`, `/auth/2fa/setup`, `/auth/2fa/enable`, `/auth/2fa/verify`, `/auth/pin/set`, `/auth/forgot`, `/auth/reset`.
**Rules:** argon2id; access token 10 min; refresh rotating + hashed + revocable; generic errors (no user enumeration); throttle + lockout; TOTP required for withdrawals & admin; PIN 5-attempt lock.
**Emits:** `user.registered`, `user.login`, `user.login_failed`.

## users
**Endpoints:** `GET/PATCH /users/me`, `GET /users/me/sessions`, `DELETE /users/me/sessions/:id`, `GET /users/me/devices`, security-center reads.
**Rules:** IDOR-proof (always scope by authenticated user id, never trust path id for own resources); freeze/suspend blocks trading + withdrawal.

## kyc
**Endpoints:** `POST /kyc/submit` (tier, doc, files), `GET /kyc/status`; admin: `GET /admin/kyc/queue`, `POST /admin/kyc/:id/approve|reject|resubmit`.
**Rules:** **manual decision only** — no code path auto-approves. If Smile ID used, its result is a *signal* shown to the reviewer. Files encrypted at rest, retention date set on submit. Tier limits gate trade/withdraw sizes.
**Emits:** `kyc.submitted`, `kyc.reviewed`.

## wallet (watch-only)
**Endpoints:** `GET /wallet/balances`, `GET /wallet/:asset/deposit-address`.
**Rules:** derives addresses from **xpub** at `m/44'/195'/0'/0/N`; never holds private keys; balances are ledger-derived, not chain-derived (chain used only for deposit detection + reconciliation).

## deposits
**No public write endpoints.** BullMQ `deposits` queue scans TronGrid.
**Rules:** credit only when: address is ours, `token_contract == canonical USDT`, confirmations ≥ threshold, `(tx_hash,log_index)` not already processed. Dust below min ignored. Reorg → mark ORPHANED + reverse only if not yet spent (should not happen post-threshold). Credit via `postJournal(deposit_credit)`.
**Emits:** `deposit.credited`.

## withdrawals
**Endpoints:** `POST /withdrawals` (to_address, amount, 2FA, PIN), `GET /withdrawals`, admin `POST /admin/withdrawals/:id/approve|reject`.
**Flow:** validate KYC/2FA/PIN → debit to pending via postJournal → risk scoring → `PENDING_APPROVAL` (or auto below small threshold if policy allows) → admin approve (two admins if ≥ cap) → signer signs+broadcasts → poll confirm.
**Rules:** address validation + checksum; blacklist check; per-tx/day caps enforced in service **and** signer **and** DB CHECK; idempotency key.
**Emits:** `withdrawal.requested/approved/broadcast/confirmed/failed`.

## offers
**Endpoints:** `POST /offers`, `PATCH /offers/:id`, `POST /offers/:id/pause|activate`, `DELETE /offers/:id`, `GET /offers` (filters: side, asset, method, min/max, verified), `GET /offers/:id`.
**Rules:** `min_trade ≤ max_trade ≤ remaining`; SELL offers must have seller balance backing (soft check at create, hard check at trade open); price in XAF per whole USDT.

## trades + escrow  (review priority #2)
**Endpoints:** `POST /trades` (open from offer), `POST /trades/:id/pay` (submit proof), `POST /trades/:id/confirm` (seller), `POST /trades/:id/cancel`, `GET /trades`, `GET /trades/:id`.
**Rules:** FSM only (§4.5); open trade locks escrow atomically + decrements offer.remaining; confirm requires seller + status PAYMENT_SUBMITTED + optional 2FA/PIN; release splits amount−fee→buyer, fee→treasury; timeout job expires+refunds; DISPUTED freezes; only admin resolves disputed. Every transition writes `trade_events` in same tx. Idempotent confirm (double click = no-op).
**Emits:** `trade.opened/locked/payment_submitted/completed/expired/cancelled/disputed`.

## disputes
**Endpoints:** `POST /trades/:id/dispute`, `POST /disputes/:id/evidence`, `GET /disputes/:id`; admin `GET /admin/disputes`, `POST /admin/disputes/:id/resolve` (RELEASE_TO_BUYER | REFUND_TO_SELLER + notes).
**Rules:** resolution executes via escrow service (RESOLVED_RELEASE/REFUND transitions) — disputes module never touches ledger directly; only COMPLIANCE/SUPPORT admin; audit-logged.
**Emits:** `dispute.opened/resolved`.

## chat
**Gateway:** Socket.IO namespace `/trade/:id` (auth: only buyer, seller, monitoring admin). REST `GET /trades/:id/messages`, `POST /trades/:id/messages` (with attachment pipeline).
**Rules:** attachments → sharp re-encode + EXIF strip + file-type magic check (no SVG) + ClamAV → MinIO private + presigned short TTL; XSS-safe rendering; messages retained for dispute export; admin monitor read-only.

## risk
**Responsibility:** score events (login, trade open, withdrawal). Rules: velocity (Redis counters), device mismatch (FingerprintJS), IP/VPN (GeoLite2), duplicate account heuristics, sanctions screening (OFAC/OpenSanctions). Output score + flags → `risk_events`; high/critical → auto-freeze + escalate.
**Rules:** deterministic, config-driven thresholds; **no LLM**; explainable flags stored.
**Emits:** `risk.flagged`, `user.frozen`.

## notify
**Responsibility:** consume domain events → render (MJML/Handlebars) → send (nodemailer SMTP + in-app row + socket) → log `notification_deliveries`, BullMQ retries.
**Rules:** never include secrets/full addresses; user notification preferences respected.

## admin + treasury
**Endpoints (RBAC-guarded):** dashboards (users, trades, escrows, disputes, KYC, withdrawals), `POST /admin/kill-switch/{withdrawals|trades}` (toggle), `POST /admin/users/:id/{freeze|suspend|restore}`, treasury `GET /admin/revenue`, `GET /admin/treasury/balances`.
**Rules:** RBAC matrix (below); every action → `audit_logs` (hash-chained); large/critical actions need SUPER_ADMIN or dual approval; kill switches halt the relevant queues immediately.

### RBAC matrix (enforce via guard + tests)
| Action | SUPER | FINANCE | COMPLIANCE | SUPPORT | MOD | AUDITOR | ANALYST |
|---|---|---|---|---|---|---|---|
| Approve withdrawal | ✓ | ✓ | | | | | |
| 2nd-approve large wd | ✓ | ✓ | ✓ | | | | |
| Resolve dispute | ✓ | | ✓ | ✓ | | | |
| KYC approve/reject | ✓ | | ✓ | | | | |
| Freeze/suspend user | ✓ | | ✓ | ✓ | ✓ | | |
| Kill switch | ✓ | ✓ | | | | | |
| Ledger adjustment | ✓ | | | | | | |
| View dashboards | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Edit settings/fees | ✓ | ✓ | | | | | |
| View audit logs | ✓ | | ✓ | | | ✓ | |

## health
`GET /health` (liveness), `GET /health/ready` (pg, redis, minio, RPC reachable, chain-lag under threshold, reconciliation status, kill-switch state). Used by Nginx/monitoring.

---
### Cross-cutting rules for every module
- Guards: `JwtAuthGuard` default; `@Public()` opt-out; `RolesGuard` for admin.
- Every controller input parsed by zod; reject unknown fields (whitelist).
- Every money-moving handler: idempotency key required, wrapped in the ledger/escrow serializable path, safe to retry.
- Emit domain events via outbox table (same tx as state change) → dispatcher publishes; guarantees notify/risk/audit never miss an event.


---


<!-- ============================================================ -->
# 07 — Frontend Specification (Next.js 15)

> The client provided a 140-screen list (see `10-client-prompts-appendix.md`). This maps the Phase-1 subset we actually build, the layouts, and — critically — how the frontend and backend stay in lockstep through shared types so integration is verified at compile time.

## The FE/BE contract (how "test integration completely with types" is realized)

- All request/response shapes are zod schemas in `packages/shared/src/schemas`. Backend validates with them; frontend infers types from them (`z.infer`) and validates responses too.
- A generated typed API client (`packages/shared/src/client`) wraps every endpoint. Components never call `fetch` directly.
- If backend changes a shape, the shared schema changes, and **every frontend call site fails to compile** until fixed. That is the integration test at the type level. Runtime contract tests (§9) back it with real calls.
- Money is passed as strings (BIGINT-safe); a `Money` helper in shared converts to display using `decimal.js` (÷ 1e6 for USDT). Components never do raw math on amounts.

## Global layout & system

- **Shell:** top bar (logo, network/status, language toggle en/fr, theme toggle, notifications bell, avatar). Authenticated app uses bottom nav on mobile / sidebar on desktop: **Home · Markets · Trade · Wallet · Account**. Admin is a separate `/admin` shell.
- **Design:** fintech-clean, high-trust; dark + light via Tailwind; shadcn/ui components; consistent spacing scale; skeleton loaders; never show optimistic balances.
- **States everywhere:** loading / empty / error / success; all money right-aligned monospace; every destructive or money action has a confirm step (+ 2FA/PIN where required).
- **i18n:** all copy via next-intl keys; no hardcoded strings; XAF and USDT formatting helpers.

## Phase-1 screens (build these)

### Public / Auth
- Landing (value prop, trust signals), Login, Register, Email OTP, Phone OTP, Forgot/Reset, 2FA setup + verify.
- Layout: centered card, form via react-hook-form + zod resolver (same schema as backend).

### Home
- Portfolio value (from ledger balances), USDT balance card, KYC/verification status banner, reputation score, quick actions (Buy, Sell, Deposit, Withdraw), market snapshot, active offers preview, latest trades.

### Markets
- USDT price vs XAF (from configured rate feed), 24h change, lightweight-charts price view. (Single asset in Phase 1; layout ready for more.)

### Trade (the core)
- **Buy / Sell list:** filter bar (side, payment method, min/max, verified-only); offer cards (trader name, reputation, completion rate, limits, methods, price).
- **Offer detail:** trader profile, terms, limits; "Open trade" with amount entry → live fee + total via `fees` shapes.
- **Create/Edit offer:** side, amount, price XAF/USDT, min/max, payment methods, terms.
- **My offers / analytics (basic).**
- **Trade Room (most important screen):** status stepper (Opened→Locked→Payment Submitted→Completed), countdown timer, escrow status, counterpart details, payment instructions per method, **buyer:** submit proof (reference, sender name/number, screenshot upload with client-side type/size pre-check), **seller:** "Payment received / not received" (guarded by confirm + optional 2FA/PIN), live chat panel (Socket.IO), open-dispute entry.
- Trade success / cancelled / expired states; dispute submission + evidence upload + timeline view.

### Wallet
- Balances (available vs in-escrow shown separately — never conflate). Deposit (address + QR from watch-only derivation, canonical-contract warning copy). Deposit history. Withdraw (address, amount, fee preview, 2FA + PIN). Withdrawal review + status tracking. Withdrawal/transaction history. Internal transfer (QuataPay) — ledger-only.

### Account
- Profile, Verification center + KYC submit (document capture guidance, upload), KYC status, Security center (change password/PIN, manage 2FA, devices, sessions), notification preferences, language, transaction/trade/fee history, support center + tickets + FAQs, terms/policies, logout.

### Admin (`/admin`, RBAC-gated)
- Login + 2FA. Dashboard KPIs (users, trades, volume, revenue, disputes, risk flags). User list/detail/freeze. KYC review queue + detail (approve/reject — manual). Trade list/detail + active escrows. Dispute queue + evidence viewer + resolution center. Withdrawal approval queue (dual-approve UI for large). Wallet/treasury monitoring + reconciliation status. Revenue/fee reports. Risk alerts + suspicious accounts. Settings (fees, caps, timeouts). Kill switches (withdrawals/trades) with confirm. Audit log viewer (read-only). Announcement/maintenance.

## Deferred screens (stub or omit in Phase 1)
Airtime/data module, dealer application/dashboard, referral dashboard/earnings, AI support chat (use human tickets), full analytics suite, mobile Flutter apps, splash/onboarding animations (simple versions only).

## Frontend rules for Claude Code
- Never call `fetch` directly — use the typed client.
- Never do arithmetic on monetary strings — use the `Money` helper.
- Never store tokens in localStorage — httpOnly cookies for refresh; access token in memory.
- Every mutation uses TanStack Query with proper invalidation; no optimistic updates on balances/trades.
- Every form uses the shared zod schema as resolver; show field errors from the same schema the server enforces.
- Route guards: unauthenticated → login; unverified/KYC-gated actions → verification prompts; admin routes check role from server (never trust client role).
- Accessibility + responsive: mobile-first, keyboard-navigable, proper labels.


---


<!-- ============================================================ -->
# 08 — Security Checklist (Critical Checkpoints)

> This is the "must not fail" list. Each audit gate in `05-build-phases.md` ticks the relevant section here into `docs/audits/gate-N.md` with commit hash + date. Treat every box as a test that must exist, not just a claim.

## A. Money math & ledger integrity  (Gate 1)
- [ ] All amounts BIGINT smallest units end-to-end; `number`/float banned past display (ESLint + grep check in CI).
- [ ] Fee = `floor(amount * bps / 10000)`; `buyerCredit + fee === amount` exactly (property test, thousands of random cases).
- [ ] No rounding leak: sum of all splits over many trades loses/gains nothing vs inputs.
- [ ] Every journal balances to zero (DB trigger + property test).
- [ ] User balances can never go negative (DB CHECK + attempted-overdraw test).
- [ ] Cached balance always equals recomputed sum of entries (reconciliation test).
- [ ] Ledger is append-only: UPDATE/DELETE blocked by RULE and by REVOKE on app role (test tries both, expects failure).
- [ ] Every money operation has a unique idempotency key; replaying the same op does not double-apply (test).

## B. Concurrency & isolation  (Gates 1, 4)
- [ ] All money moves run SERIALIZABLE with retry on 40001 (max 3, jitter).
- [ ] `account_balances` locked `FOR UPDATE` in globally sorted order (no deadlock) — test with parallel cross-transfers.
- [ ] Parallel escrow locks on one seller balance never oversell available (Testcontainers, N concurrent).
- [ ] Parallel "open trade" on one offer never oversell `offers.remaining`.
- [ ] Double seller-confirm is idempotent (second is a no-op, funds move once).
- [ ] Expiry-job vs seller-confirm race yields exactly one terminal state (test both orderings).
- [ ] BullMQ jobs idempotent (re-delivery safe); deposit scanner safe to run overlapping.

## C. Escrow / trade state machine  (Gate 4)
- [ ] Transitions only via FSM; DB trigger rejects illegal transitions (test each illegal pair).
- [ ] No code path releases escrow while status = DISPUTED except admin `RESOLVED_*`.
- [ ] Every transition writes `trade_events` in the SAME transaction as the status change (test rollback leaves neither).
- [ ] Timeout auto-cancel refunds seller exactly once.
- [ ] Dispute resolution moves funds only through escrow service, never disputes module directly.

## D. Blockchain / wallet / keys  (Gate 3)
- [ ] API/worker/DB hold **no** private keys or mnemonics (grep + config review + secret scanner in CI).
- [ ] Deposit addresses derive from **xpub only**.
- [ ] Deposit credited only if `token_contract == canonical USDT contract` (fake-token test rejected).
- [ ] Confirmation threshold enforced; unconfirmed/dust not credited (test).
- [ ] `UNIQUE(tx_hash, log_index)` makes deposit crediting idempotent (replay test).
- [ ] Reorg/orphan handling: address monitored across reorg depth; orphaned tx not left credited (test on regtest/testnet).
- [ ] Withdrawal address validated + checksummed; blacklist/sanctions checked.
- [ ] Signer independently re-verifies status=APPROVED, amount ≤ per-tx cap, daily aggregate ≤ cap, destination not blacklisted — refuses otherwise (tests simulate a "compromised API" sending bad requests; signer must reject).
- [ ] Per-tx / per-hour / per-day caps enforced in service AND signer AND DB CHECK.
- [ ] Signer host: no inbound internet, WireGuard-only, mTLS, ufw default-deny (infra review).
- [ ] Hot float small; sweep to client-held cold (hardware wallet) above threshold.
- [ ] On-chain vs ledger reconciliation job runs, and pauses withdrawals on mismatch (test injects mismatch).

## E. AuthN / AuthZ  (Gate 2, 6)
- [ ] argon2id for passwords + PIN; per-secret salts.
- [ ] Access token ≤10 min; refresh rotating, hashed at rest, revocable; logout revokes (tests).
- [ ] No user enumeration (identical responses/timing for unknown vs wrong password).
- [ ] Brute-force lockout on login + PIN; throttling on all auth endpoints.
- [ ] TOTP 2FA required for withdrawals and all admin actions.
- [ ] IDOR: every resource access scoped to owner; test accessing another user's trade/wallet/withdrawal/message → 403/404 (never leak).
- [ ] RBAC matrix enforced by guard; test each role against each protected action (allow + deny cases).
- [ ] Large-withdrawal dual-approval enforced end-to-end (single admin cannot release).
- [ ] Ledger adjustments SUPER_ADMIN only + mandatory reason + audit.

## F. Input, uploads, injection  (Gates 5, all)
- [ ] Every endpoint validates input with zod, rejects unknown fields (whitelist).
- [ ] Parameterized queries only (Kysely) — no string-built SQL (review + test).
- [ ] File uploads: magic-byte check (file-type), SVG banned, size limits, sharp re-encode + EXIF strip, ClamAV scan before persist.
- [ ] Uploaded files in private MinIO buckets, served via short-TTL presigned URLs, never public, never in webroot.
- [ ] KYC files encrypted at rest per-file (sodium); access audit-logged; retention date enforced by a purge job.
- [ ] XSS: chat and any user text escaped on render; CSP via helmet.
- [ ] SSRF: no server-side fetch of user-supplied URLs; RPC/webhook endpoints allow-listed.
- [ ] Webhook/callback signatures verified (if any provider used).

## G. Infra, secrets, ops  (Gates 0, 3, 7)
- [ ] No secrets in repo/history (git-secrets/gitleaks in CI); `.env.example` only.
- [ ] Secrets from Infisical/SOPS; master keys never on app-host disk in plaintext.
- [ ] VPS hardened: ufw default-deny, fail2ban, unattended-upgrades, SSH keys only, no root login.
- [ ] Nginx: TLS (certbot), HSTS, sane timeouts, request size limits, rate limit at edge too.
- [ ] Containers: non-root users, minimal base images, no capabilities they don't need, internal services not published to host.
- [ ] Backups: pgBackRest + restic, encrypted, offsite; **restore drill tested** (not just backup taken).
- [ ] Audit logs append-only + hash-chained (prev_hash/row_hash), tamper test detects edits.
- [ ] Monitoring: chain-lag, reconciliation status, withdrawal volume anomaly, error rate, disk/mem alerts.
- [ ] Kill switches (withdrawals, trades) tested to actually halt the queues.

## H. Dependency & AI-code discipline  (all gates)
- [ ] Exact-pinned deps + lockfile; Dependabot + `npm audit` + Socket.dev in CI; block on high severity.
- [ ] No postinstall scripts from unaudited packages; review crypto-lib updates manually (supply-chain risk).
- [ ] Money-path code: tests written **before** implementation; property tests for math; concurrency tests for locks.
- [ ] Signer code: human-authored/reviewed line-by-line; Claude Code does not modify it unattended.
- [ ] Every AI-generated money-path PR reviewed against this checklist before merge; reviewer signs the gate doc.
- [ ] No `any`/unchecked casts in `ledger/ escrow/ wallet/ withdrawal/ fees/ signer/` (ESLint hard-fail).

## I. Privacy / legal  (Gate 6, 7)
- [ ] KYC/biometric handling documented; consent captured; retention + purge enforced (Cameroon Law 2024/017 alignment).
- [ ] No KYC-as-training-data pipeline in v1 (explicitly out of scope; documented in deviations log).
- [ ] Data-subject request path exists (export/delete within legal limits).
- [ ] Deviations log signed by client; developer's written risk advisory retained.

---
### Top 10 things that most commonly sink platforms like this (keep visible)
1. Storing balances as a mutable column instead of a ledger. 2. Floats for money. 3. Private keys in .env/DB. 4. Crediting deposits before confirmations / from fake token contracts. 5. Releasing escrow during a dispute via an overlooked path. 6. Race conditions overselling escrow/offers. 7. Trusting screenshot payment proof as automatic (it isn't — seller confirms in their own account; that's why the human-confirm step exists). 8. IDOR exposing others' trades/wallets. 9. No withdrawal caps/approval → single compromise drains hot wallet. 10. Backups never test-restored.


---


<!-- ============================================================ -->
# 09 — Testing, Integration & Monitoring

> How you verify backend + frontend work together completely, with types, and how you monitor everything. Tests are grouped by level; money paths require the top three levels before merge.

## Test pyramid for this project

| Level | Tool | Covers | Gate |
|---|---|---|---|
| Unit | Vitest | pure logic, guards, mappers | all |
| Property | fast-check | ledger math, fee splits, invariants | 1 |
| Integration (DB/queue) | Testcontainers (pg, redis, minio) | postJournal, escrow FSM, concurrency, deposit credit | 1,3,4 |
| Chain integration | TRON Quickstart / Shasta + regtest later | deposit detect, withdrawal sign+broadcast, reorg | 3 |
| Contract (FE↔BE) | shared zod schemas + supertest | request/response shapes match exactly | 2–6 |
| API (HTTP) | supertest | endpoints, auth, RBAC, IDOR | 2–6 |
| E2E | Playwright | full user journeys in the browser | 7 |
| Load/concurrency | k6 or artillery + custom parallel scripts | oversell/double-release under load | 1,4,7 |

## Money-path rule (non-negotiable)
For anything touching ledger/escrow/withdrawal/fees: **write the failing test first**, then implement. Minimum set before merge: unit + property (where math) + integration incl. a **concurrent** scenario. Coverage gate: 100% branch on `ledger/ escrow/ fees/`; ≥80% backend overall.

## Key test scenarios to implement (checklist)

### Ledger / fees (property-based)
- Random op sequences keep every journal balanced and all user balances ≥ 0.
- `buyerCredit + fee === amount` for all amounts and both bps; no leak over 10k trades.
- Idempotency: replaying a journal by key applies once.

### Concurrency (Testcontainers, real parallel connections)
- 50 concurrent escrow locks on a seller with balance for only 10 → exactly 10 succeed.
- Concurrent open-trade on an offer with `remaining=100`, ten 20-unit trades → exactly 5 succeed.
- Confirm vs expiry race → one terminal state, funds moved once.
- Parallel deposit scanner runs → each (tx_hash,log_index) credited once.

### Escrow FSM
- Every legal transition works; every illegal transition rejected by trigger.
- No release while DISPUTED (attempt via every entry point).
- Rollback atomicity: force failure mid-release → no partial ledger change, no event row.

### Blockchain (testnet/regtest)
- Deposit below confirmations not credited; at threshold credited once.
- Fake USDT contract deposit ignored.
- Reorg: orphaned deposit not left credited.
- Withdrawal: request→approve→signer→broadcast→confirm; signer rejects non-APPROVED / over-cap / blacklisted even when API asks.

### Auth / RBAC / IDOR
- Token rotation/revocation/expiry behave; logout kills refresh.
- Each role × each protected action (allow + deny).
- Cross-user access to trade/wallet/withdrawal/message → denied, no data leak.

### Uploads / chat
- SVG rejected; oversized rejected; EXIF stripped; ClamAV catches EICAR test file; presigned URL expires.

## Frontend↔Backend integration verification (the part you asked to be complete & typed)

1. **Type-level (compile time):** FE imports response types inferred from the same zod schemas the BE validates with. Any drift = TypeScript build failure in CI. This is continuous, automatic integration checking.
2. **Contract tests:** for each endpoint, a test sends a real request through supertest and parses the response with the shared schema (`schema.parse(res.body)` must not throw) — proves the server honors the contract the client relies on.
3. **Typed API client tests:** the generated client in `packages/shared` is exercised against the running API in integration tests; a breaking change fails here.
4. **E2E (Playwright):** real browser drives the real frontend against a real backend on testnet:
   - Register → verify → login → 2FA.
   - KYC submit → admin manual approve.
   - Deposit (testnet) → balance credited.
   - Create sell offer → second user opens trade → escrow locks → buyer submits proof → seller confirms → buyer credited, fee to treasury.
   - Dispute path → admin resolves → funds move correctly.
   - Withdraw → approval → signer → confirmed.
5. **Reconciliation as a live integration test in prod:** scheduled job compares on-chain balances, ledger sums, and cached balances; mismatch pages you and pauses withdrawals.

## CI pipeline (GitHub Actions)
Stages, fail-fast: `install (frozen lockfile)` → `lint + typecheck` → `unit + property` → `integration (Testcontainers)` → `contract/api` → `build` → `audit (npm audit + gitleaks + Socket.dev)`. E2E + chain integration run on staging deploy. No merge to main without green + gate doc updated when a gate is involved.

## Monitoring & observability (so you can watch everything)
- **Logs:** pino JSON → shipped; request IDs; never secrets/PII.
- **Metrics:** Prometheus + Grafana dashboards — trade volume, escrow locked total, withdrawal volume, hot wallet balance, chain-lag (blocks behind), reconciliation drift, error rates, queue depths, RPC failure rate.
- **Uptime:** Uptime Kuma on `/health/ready`.
- **Errors:** GlitchTip (OSS Sentry) for exceptions.
- **Alerts (page you):** reconciliation mismatch, hot wallet below refill / above cap, withdrawal volume spike, signer refusals, RPC provider down, deposit scanner stalled, disk/mem, repeated auth failures from one IP/user.
- **Financial dashboard:** treasury balance, fees earned (day/month/lifetime) from the ledger — your revenue view and an integrity check at once.

## Definition of "done" for a feature
Code + tests (right levels) + docs (module README updated) + shared schema updated + FE call sites compile + relevant §8 boxes ticked + CI green. Only then merge.


---


<!-- ============================================================ -->
# 10 — Client Prompts (Verbatim) & Deviations Log

> Nothing the client asked for is lost. This appendix preserves the original briefs so any requirement can be traced, and records every place our build intentionally differs, with the reason. Review this in scope discussions and get the client to sign the Deviations Log before launch.

---

## PART A — Client message (revenue-share offer), verbatim
> Rus while we are pushing towards our present projects and there are so many financial difficulties from your end I have one side profitable project for you. You design this project and we launch it online then you hold 30% of the revenue. This is our private business to support us first. Check the prompt below and tell me what you think! You can do it during some free time my business will cover its license so all you need to do is build it to standard. You can do it after we have finished with the present projects or you can proceed now depending on your availability. This is a great revenue business.

---

## PART B — Original spec "QUATATRADE.COM – NEXT GENERATION P2P CRYPTO EXCHANGE PLATFORM" (Doc 1 of 4), key requirements preserved
- Platform: QuataTrade, domain QuataTrade.com; P2P crypto marketplace with escrow, Africa/Cameroon launch; NOT a centralized exchange.
- Assets Phase 1: USDT, BTC, ETH. Payment methods: QuataPay Wallet, MTN Mobile Money, Orange Money.
- Platforms: responsive website, Android, iOS, admin/support/compliance dashboards.
- Business model: users deposit crypto into custodial wallets; seller offer locks crypto in escrow; buyer pays off-platform; buyer uploads proof (reference, sender number/name); seller confirms received/not; confirm → escrow releases to buyer; dispute → dispute center, funds locked, admin reviews.
- Fees: QuataPay 0.3%; MTN 0.5%; Orange 0.5%; gateway fee shared 50/50 if gateway used; auto-calculate trade value/fees/totals/escrow release. Store fees in treasury wallet; auditable revenue ledger.
- Wallet system: per-user BTC/ETH/USDT wallets; USDT networks TRC20 (priority)/ERC20/BEP20(future); deposit/withdraw/internal transfer/history/pending confirmations/explorer links.
- Custodial architecture: hot wallet small float, cold wallet 95%+, multi-sig withdrawals, approval workflows, hot-wallet refill monitoring.
- P2P marketplace: buy/sell, create/edit/pause/delete offer, expiry, limits, min/max, preferred methods, verified/merchant/top-trader/dealer badges, ratings/reviews/reputation.
- Order management, dispute center (evidence/screenshot/video upload, chat history, reference verification, admin resolution, timeline, resolution notes, security lock during dispute).
- Security: email/phone/KYC verification, transaction PIN, 2FA, device fingerprinting, login/withdrawal/new-device alerts, session management. KYC tiers 1–3.
- AI security layer & AI support: "use ONLY free/open-source AI tools" (Ollama, Llama 3, Mistral), fraud/risk/abuse detection, local AI support with escalation path. "No paid AI services required."
- Admin dashboard, RBAC (super/finance/compliance/support/moderator/auditor/analyst; no single admin controls funds; multi-admin approvals), analytics, notifications (email/SMS/push/in-app), market features (live prices/charts/stats), referral system, airtime & data module (MTN/Orange airtime & data, paid via QuataPay/crypto, "lightweight"), UI/UX (fintech, dark/light, responsive), multi-language (English, French, later Pidgin).
- Infrastructure: Docker, PostgreSQL, Redis, Node.js/NestJS, Flutter, Nginx, Linux VPS, API-first. Security requirements: E2E encryption, rate limiting, WAF, CSRF/XSS/SQLi protection, request signing, encryption at rest/in transit, audit logs, pen-test-ready.

## PART C — Doc 2 of 4 "TECHNICAL ARCHITECTURE & SYSTEM DESIGN", preserved
- API-first modular monolith (Phase 1), microservice-ready (Phase 2). Stack: Next.js/TS/Tailwind; Flutter; NestJS/TS; PostgreSQL; Redis; BullMQ; local storage→S3 later; Nginx; Ubuntu; Docker; JWT + refresh; REST + OpenAPI.
- DB core tables enumerated (users, wallets, wallet_addresses, transactions, offers, trades, escrows, payments, trade_messages, disputes, kyc_submissions, notifications, audit_logs, admin_actions, support_tickets, referrals, revenue_records).
- Blockchain wallet engine (address gen, deposit monitoring, confirmations, balance update, withdrawals, explorer links); deposit & withdrawal processing flows (KYC/PIN/2FA/device checks; risk review; hot wallet signs; broadcast; hash recorded).
- Escrow engine (creation, flow, timeout auto-cancel, dispute protection — escrow never releases during dispute, only resolution engine unlocks). Payment engine (QuataPay internal ledger; MTN/Orange external, no fiat custody). Fee engine (0.3/0.5/0.5, shared gateway, revenue ledger). Risk engine (scores for login/withdrawal/trade/account changes; VPN/device/volume/multi-account/fake-KYC/suspicious withdrawal; low/med/high/critical; critical auto-freeze). AI security engine (local models). KYC engine (tiers, OCR, face compare, duplicate detection). Admin/RBAC. Audit system (immutable, never delete). Analytics. API modules list. Security requirements. Backup strategy (daily/weekly/monthly, encrypted, DR plan).

## PART D — Doc 3 of 4 "COMPLETE UI/UX SCREEN SPECIFICATION", preserved
- 140 screens enumerated: pre-login (splash, 3 onboarding, welcome); auth (login, register, email/phone verify, 2FA setup, forgot/reset); main app with bottom nav (Home, Markets, Trade, Wallet, Account); home dashboard; markets overview + asset detail; trade (buy/sell, offer details, create/edit offer, my offers, offer analytics); trade execution (confirmation, **Trade Room**, upload proof, payment submitted, seller confirmation, success, cancellation); disputes (open, submit evidence, timeline, resolution); wallet (dashboard, deposit/address/history, withdraw/form/review/success/history, internal transfer); airtime & data; account (profile, verification center, submit/status KYC, security center, change password/PIN, manage 2FA, device/session management, notif prefs, language, referral dashboard/earnings, transaction/trade/fee history, support center/ticket/AI chat/ticket details, FAQs, terms, logout); verified dealer module (application, requirements, dashboard, analytics, reputation, settlement); notification center; admin dashboard (login/2FA/security challenge, overview KPIs, user management, KYC management, trade management incl. active escrows/force resolve, dispute management, wallet management incl. hot/cold status, finance module, support dashboard, compliance dashboard, AI security center, system settings incl. roles/permission matrix/audit logs); system states (maintenance, offline, force update, account suspended).

## PART E — Doc 4 (self-hosted upgrade) "Internal Services Architecture (No Third-Party API Dependency)", preserved
- Goal: remove external services; fully self-hosted microservices with secure internal APIs; each component independently deployable/replaceable.
- Services: **Quata Custody** (HD BIP39/BIP44 wallets, addresses, deposit/escrow wallets, signing, blockchain sync, confirmations, withdrawals, hot/cold, internal ledger; escrow engine inside it; "no external wallet providers"). **Quata Verify** (document capture + AI quality checks; OCR; face verification AI similarity score; liveness — blink/turn/smile/random movement, reject screens/prints/replay; AI decision engine 95–100 auto-approve / 80–94 human / <80 reject; log every decision). **Quata Shield** (blacklist, pattern analysis, velocity, device fingerprint, IP monitoring, suspicious login, high-risk country, multi-account, trade abuse, repeated cancellation, large-tx alerts; dynamic risk score). **Quata Notify** (SMTP, Firebase push, in-app, optional WhatsApp; queue/retry/templates/logs). **Quata Ledger** (escrow/platform balances, fees, settlement, audit; reconcile before trusting chain balance). **Quata Chat** (realtime, image + proof upload, encryption, typing/read receipts, admin monitor, dispute export; per-trade room). **Quata AI** (central engine for doc verification, face match, fraud, trade risk, behavior, support, future compliance).
- Blockchain layer initial: Bitcoin, Ethereum, BNB Smart Chain, TRON, Polygon; connect to nodes or trusted RPC; no WaaS; adapters for more chains.
- Escrow engine states (Created→Seller deposits→confirmation→Escrow locked→Buyer pays→"I've paid"→Seller confirms→Release→Completed; timeout returns to seller; dispute freezes until admin).
- Admin console for verification/wallet/escrow/trade/disputes/fraud/AI review/audit/notification/blockchain/system-health; nothing via third-party dashboards.
- AI training strategy: store every verified document securely; every fraud case/rejection/manual review becomes training data; continuous improvement.
- Provider-agnostic future upgrades as plug-ins; development principles (API-first, modular microservices, event-driven, E2E encryption, audit logging, horizontal scale, HA, security-first, independently deployable/replaceable).

---

## DEVIATIONS LOG (build differs from client prompt — with reasons)
Each item: what the client asked, what we do instead, why. Client signs before launch.

| # | Client asked | We build (Phase 1) | Reason |
|---|---|---|---|
| D1 | USDT + BTC + ETH at launch | **USDT-TRC20 only**; BTC/ETH Phase 3 | Solo-dev risk surface; each chain multiplies attack surface + ops |
| D2 | 5 chains (BTC/ETH/BSC/TRON/Polygon) self-hosted nodes, "no WaaS" | TRON via **free-tier RPC**, no self-run nodes | Self-hosting nodes costs more (hardware, sync, maintenance) than it saves; RPC free tier ≈ $0 |
| D3 | 7 separate microservices | **Modular monolith + one isolated signer**; modules keep clean boundaries for later extraction | Microservices are an anti-pattern at solo scale; achieves "replaceable components" goal without the ops cost |
| D4 | KYC auto-approve at 95–100% via in-house AI | **Manual review only**; Smile ID recommended as signal; DIY OCR = assist, never decides | Homegrown liveness/face-match is farmed by fraud rings; false auto-approvals = fraud + legal exposure |
| D5 | Store all KYC docs as AI training data | Retain per **legal retention schedule + consent**; **no training pipeline** in v1 | Cameroon Law 2024/017 (data/biometrics): purpose limitation, retention limits; breach liability |
| D6 | AI fraud/support via Ollama/Llama/Mistral | **Rules-based** risk engine; human support tickets | No labeled data pre-launch; LLMs wrong tool for money-fraud decisions |
| D7 | Custodial hot/cold with in-house signing | Same capability but **signer isolated on separate host**, xpub-only API, hard caps, client holds cold keys | Most exchange hacks are hot-key compromises; isolation + caps + client-held cold keys limit blast radius |
| D8 | Mobile apps (Flutter) at launch | **Responsive web first**; Flutter deferred | Scope; one platform to secure first |
| D9 | Airtime/data, dealer, referral payout, AI support, full analytics at launch | **Deferred/stubbed** | MVP focus; add post-revenue with own audit gates |
| D10 | SMS alerts | **Email + in-app** first; SMS/FCM later | Cost + provider setup; not launch-critical |
| D11 | Gateway checkout (QuataPay payment gateway) fee-split | **Off-platform payment only** in v1; no fiat custody/gateway | Avoids payment-processing/fiat-custody licensing and PCI scope |

### Legal/commercial guardrails to settle in writing BEFORE building (from prior research)
- Client owns the legal entity, any required licenses, treasury/cold keys, and the regulatory/legal risk. Developer is a contractor, not fund custodian.
- The 30% revenue-share can reclassify the developer as an operator/partner (higher liability). Prefer paid milestones or a clear contract that isolates liability + indemnifies the developer.
- Written record that the developer advised the client of the CEMAC/COBAC crypto restrictions and data-protection obligations.
- Walk-away triggers: client refuses written contract / refuses to hold keys & licenses / pressures for auto-KYC or removing caps / wants developer to custody funds personally.


---


<!-- ============================================================ -->
# 11 — Brand Identity & Design System

> The visual and verbal identity of QuataTrade. Goal: a brand that Gen Z loves at first glance, that older MoMo users instantly trust, that is easy on the eyes for hours of trading, and that no one confuses with MTN, Orange, or Binance. All values here become Tailwind tokens in `packages/config` — components never hardcode colors.

## 11.1 Brand positioning (one paragraph, memorize)

QuataTrade is the safest way in Central Africa to turn crypto into cash and cash into crypto — person to person, in your own payment app, with every trade locked in escrow until you're paid. It should feel like a modern fintech (clean, fast, alive), not like a casino (no neon chaos, no fake urgency) and not like a bank (no grey suits, no jargon). Personality in three words: **Protected. Direct. Fresh.**

## 11.2 Name & tagline

The name **QuataTrade** stays as-is (client asset). Wordmark casing: `QuataTrade` — capital Q and T, one word. Short form in UI: **Quata**. Never "QUATATRADE" in running text.

**Primary tagline (EN):** `Crypto to cash. Protected.`
**Primary tagline (FR):** `De la crypto au cash. Protégé.`
Why it wins: it says exactly what the product does (crypto ↔ MoMo/OM cash), leads with the escrow promise (the #1 trust objection in P2P), is four words, and translates cleanly. Use it in the hero, app store listing, and social bios.

Alternates (approved for campaigns, not for the logo lockup):
- `Locked till you're paid.` / `Verrouillé jusqu'au paiement.` — escrow explainer, Gen Z-direct; great for onboarding screen 2.
- `Trade with people. Not with luck.` / `Échangez avec des gens. Pas avec la chance.` — anti-scam angle for social.
- `Your rate. Your method. Your money.` / `Ton taux. Ton moyen. Ton argent.` — marketplace freedom angle (FR uses informal *ton* for youth campaigns only).

Banned copy: "get rich", "moon", "guaranteed profit", "invest" (regulatory + trust poison). We sell **safety and control**, never returns.

## 11.3 Color system

### Strategy (why these colors)
- **Own teal-mint.** 2026 tech palettes have moved to teal/neo-mint/soft-blue territory — it signals innovation + clarity, and it's the one strong color family *not taken* in this market: MTN owns yellow, Orange owns orange, Binance owns yellow/black, OPay/Wave lean green, Chipper leans blue/purple. Teal gives us blue's trust plus green's money-freshness with zero partner clash — and MTN yellow / Orange orange remain instantly recognizable *inside* our UI as payment-method chips.
- **One vibrant accent, everything else calm.** Gen Z engagement favors high-contrast bold accents; finance favors restraint. We spend our boldness in exactly one place (the mint accent + signature gradient) and keep surfaces quiet.
- **Green/red are reserved for meaning.** Buy/positive = green, Sell/negative = red — never used decoratively, always paired with an icon or label (color-blind safety).

### Core palette

| Token | Name | Hex | Use |
|---|---|---|---|
| `brand-900` | Deep Quata | `#0B3B36` | dark brand fills, footer, marketing depth |
| `brand-700` | Quata Teal | `#0E5F55` | **primary brand color (light mode)** — buttons, links, active nav |
| `brand-500` | Lagoon | `#159E85` | hover states, secondary emphasis |
| `accent-400` | Volt Mint | `#2FD4A7` | **the accent** — primary CTAs on dark, focus rings, highlights, escrow-locked glow |
| `accent-200` | Mist Mint | `#A9EFD9` | subtle tints, selected rows, badges bg |
| `ink-900` | Ink | `#101614` | text on light |
| `paper-50` | Paper | `#F6F9F8` | light-mode app background (never pure white pages) |

### Semantic colors (both modes; always icon + label alongside color)

| Token | Light | Dark | Meaning |
|---|---|---|---|
| `success / buy` | `#0E8A4D` | `#4ADE8C` | trade completed, buy side, price up |
| `danger / sell` | `#C93B3B` | `#F87171` | errors, sell side, price down, destructive |
| `warning` | `#B67B0F` | `#FBBF24` | timers running low, pending review |
| `info` | `#2563EB` | `#7DB2FF` | neutral notices |
| `escrow` | `brand-700` | `accent-400` | anything showing funds locked/protected — escrow gets its own semantic color so "protected" is visually learnable |

### Dark mode (the default theme — most trading happens at night)
No pure black, no pure white — pure black + white text causes glare/halation, especially for astigmatism; desaturated accents read better on dark.

| Token | Hex | Use |
|---|---|---|
| `bg` | `#0E1416` | app background (teal-tinted near-black, not #000) |
| `surface-1` | `#151C1E` | cards |
| `surface-2` | `#1C2528` | raised cards, modals, inputs |
| `surface-3` | `#243033` | hover, active list rows |
| `border` | `#2C3A3D` | 1px hairlines (≥3:1 vs bg for meaningful borders) |
| `text-primary` | `#E7EDEB` | soft white body text (never `#FFFFFF` for paragraphs) |
| `text-secondary` | `#9FB3AE` | labels, meta |
| `text-disabled` | `#5E706C` | disabled only — never for real content |

Light mode mirrors it: `paper-50` bg, white `#FFFFFF` cards, `ink-900` text, `#5C6B67` secondary, `#D8E2DF` borders.

### Accessibility rules (enforced, not aspirational)
- WCAG 2.1 AA: body text ≥ 4.5:1, large text/icons ≥ 3:1, focus indicators ≥ 3:1 and always visible (2px `accent-400` ring, offset 2px).
- Contrast is checked in CI: a small script validates every token pair used by components (axe + custom token matrix); a failing pair fails the build.
- Never encode meaning by color alone: buy/sell also get ↑/↓ icons and text; escrow state gets the lock icon; links in text are underlined.
- Respect `prefers-color-scheme` on first visit; user toggle persists; respect `prefers-reduced-motion` everywhere.

### Gradient (signature, marketing-only)
`Quata Flow`: mesh/linear from `#0E5F55` → `#159E85` → `#2FD4A7`, used on the landing hero, onboarding illustrations, OG images, and empty states. **Never behind body text, never inside the trade room or wallet** — money screens stay flat and calm.

## 11.4 Typography

All faces are free (Google Fonts) — zero licensing cost, self-hosted via `next/font` (no external requests, faster loads).

| Role | Face | Weights | Use |
|---|---|---|---|
| Display | **Space Grotesk** | 500/700 | wordmark, H1–H2, hero numbers, empty-state headlines. Geometric, slightly quirky — carries the Gen Z personality |
| Body/UI | **Inter** | 400/500/600 | everything else; excellent at small sizes, superb FR diacritics |
| Money & data | **IBM Plex Mono** | 400/500 | ALL amounts, rates, addresses, references, countdown timers |

Monospace-for-money is a deliberate trust device: amounts align in tables, look "machine-verified," and addresses become scannable. Rule: any XAF or USDT figure renders in Plex Mono with `tabular-nums`.

Type scale (rem): 12 / 14 (base UI) / 16 (body) / 18 / 22 / 28 / 36 / 48. Line height 1.5 body, 1.15 display. Sentence case everywhere — no ALL-CAPS labels except tiny 11px eyebrows with +0.06em tracking. Minimum text size 12px; amounts in trade room ≥ 18px.

## 11.5 Logo direction

Typography-led wordmark (the 2026 direction: the name *is* the logo) in Space Grotesk 700 with **one intentional signature**: the **Q's tail is drawn as a key** — the counter of the Q reads as a keyhole at small sizes. One quirk, everything else disciplined. 
- App icon / favicon: the Q-key alone in `accent-400` on `bg` dark tile, rounded-square.
- Clearspace = height of the Q on all sides; minimum wordmark width 96px; icon works at 16px.
- Mono versions: all-`ink-900` (light) and all-`text-primary` (dark). Never stretch, never add shadows/bevels, never place on the gradient without the solid-color safe version check.
- The lock/escrow glyph used in UI (trade room "Escrow locked" state) is derived from the same keyhole geometry — brand and product tell one story: *the key to your money*.

## 11.6 Iconography, imagery & illustration

- Icons: **lucide** (already in stack), 1.5px stroke, rounded joins, sized 16/20/24. Escrow/lock, shield-check, and the payment-method marks are the only custom glyphs.
- Payment methods always shown as recognizable chips: MTN MoMo (its yellow), Orange Money (its orange), QuataPay (our teal) — on neutral chip backgrounds so partner colors pop but never dominate the frame.
- Imagery: real, warm, Cameroon-first — market traders, students, small-business owners with phones; natural light; no stock-photo suits, no glowing Bitcoin renders, no hoodie-hacker clichés. Gen Z reads authenticity; polished-corporate repels.
- Illustration (onboarding/empty states): flat shapes + subtle grain texture on the Quata Flow gradient; characters with varied Central African skin tones and dress. Friendly, never childish.

## 11.7 Motion & micro-interactions

Motion is feedback, not decoration. Budget: 150–250ms, ease-out, transform/opacity only (GPU-cheap on low-end Android).
- Button press: 0.97 scale tap-down. Balance updates: 300ms count-up in Plex Mono. Trade status stepper: step fills with a 200ms sweep in the semantic color.
- **Signature moment (the one orchestrated animation):** when escrow locks, the keyhole glyph draws itself closed with a soft `accent-400` pulse ring — 600ms, once. When escrow releases, it opens. Users should *feel* the protection engage.
- Countdown timer turns `warning` at 25% remaining, pulses gently (opacity 1→0.75) under 2 minutes — urgency without panic.
- Skeleton loaders on every data surface (sub-3s perceived load is a hard UX expectation); no spinners over 400ms without a skeleton.
- All motion disabled under `prefers-reduced-motion` (state changes swap instantly, pulse rings become static color changes).

## 11.8 Component styling rules (Tailwind/shadcn theme)

- Radius: `--radius: 12px` cards/inputs, 10px buttons, 999px chips/badges. Soft but not bubbly.
- Elevation (dark): elevation = lighter surface (surface-1→3), not big shadows; light mode uses 1 subtle shadow level.
- Buttons: primary = `brand-700` (light) / `accent-400` with `ink-900` text (dark); destructive = danger + confirm step; every money-moving button shows amount ON the button ("Release 150.00 USDT"), disabled until form valid.
- Inputs: `surface-2` fill, 1px border, 2px accent focus ring; inline zod errors in `danger` with icon; amount inputs right-aligned Plex Mono with unit suffix.
- Trade room status colors: Opened `info` → Escrow locked `escrow` → Payment submitted `warning` → Completed `success` / Cancelled `text-secondary` / Disputed `danger`. The stepper + lock glyph make status legible in one glance.
- Badges: Verified (shield, `escrow` color), reputation stars, completion-rate pill — small, consistent, never gamified-noisy.
- Density: mobile-first, bottom nav, thumb-reach primary actions, 44px minimum touch targets, one primary action per screen.

### Tailwind 4 tokens (drop into `globals.css`)
```css
@theme {
  --color-brand-900:#0B3B36; --color-brand-700:#0E5F55; --color-brand-500:#159E85;
  --color-accent-400:#2FD4A7; --color-accent-200:#A9EFD9;
  --color-bg:#0E1416; --color-surface-1:#151C1E; --color-surface-2:#1C2528;
  --color-surface-3:#243033; --color-border:#2C3A3D;
  --color-text-1:#E7EDEB; --color-text-2:#9FB3AE; --color-text-3:#5E706C;
  --color-success:#4ADE8C; --color-danger:#F87171; --color-warning:#FBBF24; --color-info:#7DB2FF;
  --font-display:"Space Grotesk"; --font-sans:"Inter"; --font-mono:"IBM Plex Mono";
  --radius-card:12px; --radius-btn:10px;
}
```
(Light-mode values swap via `[data-theme="light"]` overrides; components only ever reference tokens.)

## 11.9 Voice & tone (EN + FR)

- Plain verbs, sentence case, second person. "Release 150 USDT to Marie" — the button says exactly what happens; the toast repeats the same verb ("Released").
- Errors say what happened and what to do next; they never apologize twice or blame the user. Empty states invite the next action ("No offers yet for Orange Money — create the first one").
- Numbers are always exact and unit-labeled (USDT vs XAF never ambiguous); fees shown before every confirm — transparency *is* the brand.
- French is a first-class citizen, not a translation afterthought: UI copy written for both from the start; formal *vous* in product UI, informal *tu/ton* allowed only in youth marketing campaigns; FR strings get design QA (they run ~20% longer — buttons must not truncate).
- Security messaging is calm and specific ("Confirm you received 98,500 XAF in YOUR MoMo account before releasing — a screenshot is not money"), never fear-mongering.

## 11.10 Do / Don't

| Do | Don't |
|---|---|
| One mint accent doing the work | Neon rainbow, glow-everything casino UI |
| Teal-tinted dark `#0E1416` | Pure black bg / pure white body text |
| Desaturated semantic colors on dark | Saturated light-mode colors reused on dark (they vibrate) |
| Icons + labels with every color meaning | Color-only buy/sell/status signals |
| Plex Mono, tabular, exact amounts | Rounded-off balances, decorative fonts for money |
| Partner colors inside neutral chips | Yellow/orange as OUR brand colors (MTN/Orange/Binance territory) |
| The keyhole signature, used sparingly | Padlocks, shields, and badges scattered on every element |
| Real Cameroonian imagery | Stock suits, rocket ships, laser-eye coins |
| Calm empty/error states with next steps | Fake countdowns, dark-pattern urgency |
| Quata Flow gradient on marketing surfaces | Gradients behind body text or in the trade room |

## 11.11 Design QA checklist (add to every UI PR — mirrors §08 discipline)
- [ ] Only tokens used (no raw hex in components).
- [ ] AA contrast verified for any new token pair (CI script green).
- [ ] Works in both themes + both languages (FR overflow checked).
- [ ] Focus visible on every interactive element; 44px targets; keyboard path works.
- [ ] Color meanings paired with icon/text; amounts in Plex Mono tabular.
- [ ] Reduced-motion behavior defined; skeletons for loading.
- [ ] Screenshot attached to PR (mobile 380px + desktop).


---
