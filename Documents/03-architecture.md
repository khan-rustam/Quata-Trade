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
