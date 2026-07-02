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
