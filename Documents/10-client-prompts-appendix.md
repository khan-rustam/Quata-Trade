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

### Implementation deviations (build-time, 2026-07-02 — technical, need reviewer sign-off)

| # | Doc said | We build | Reason |
|---|---|---|---|
| D12 | Monorepo layout `apps/api`+`apps/worker`+`apps/web`+`packages/shared` (doc 03) | `backend/` (api+worker, two entry points) + `frontend/` + `shared/` pnpm workspace | Owner's chosen folder structure; identical module boundaries preserved; docs live in `Documents/` |
| D13 | `account_kind` has no chain-facing account; `account_balances CHECK (balance >= 0)` for all (doc 04 §4.2) | Added `external` contra account kind, exempt from the non-negativity CHECK (denormalized `kind` on account_balances) | Zero-sum journals + all-accounts-non-negative is mathematically impossible; every real double-entry ledger uses an external/world account |
| D14 | postJournal SERIALIZABLE + retry on 40001 max 3 (doc 04 §4.8) | READ COMMITTED + globally sorted `FOR UPDATE` pessimistic locks (retry kept for deadlock codes) | The doc's own Gate-1 test ("50 concurrent locks → exactly 10 succeed") is non-deterministic under SSI abort storms with only 3 retries; all balance access happens under row locks, which is linearizable for this pattern and passes the gate deterministically |
| D15 | `withdrawals` CHECK `big_needs_two` as written (doc 04 §4.4) | CHECK applies only once status reaches APPROVED+; also requires `second_approver <> approved_by` | The doc's CHECK would reject *inserting* any large withdrawal (no approver can exist at request time); intent preserved, hole (same admin twice) closed |
| D16 | `sodium-native` for crypto at rest (doc 02) | Node built-in `crypto` AES-256-GCM for TOTP-secret/KYC-key encryption | Same security class, zero native-build risk on Windows dev; can swap to sodium at hardening phase |
| D17 | FSM trigger fires on any status UPDATE (doc 04 §4.5) | Added `WHEN (OLD.status IS DISTINCT FROM NEW.status)` | Idempotent no-op writes must not raise; illegal transitions still rejected |
| D18 | `trade short_ref` example QT-XXXXX (5 chars, doc 04) | 5-char Crockford base32 (~33M space) kept, DB-unique; collision → request-level retry | Matches doc; noted for scale review at >1M trades |
| D19 | `auth_tokens`, lockout columns, `outbox` table not in doc 04 | Added (migrations 0001/0006) | Doc 06 endpoints (OTP verify, lockouts) and doc 03 outbox pattern require them |
| D20 | Refresh tokens for admins | Admin sessions = 10-min access JWT re-login, no refresh cookie in v1 | Smaller attack surface for the highest-privilege principals |
| D21 | zResolveDisputeRequest has {resolution, notes} | Added required `totpCode` (admin step-up 2FA) | Security review finding #5: dispute resolution moves escrow funds and must require the admin's TOTP like withdrawal approve/reject (§08 E) |
| D22 | audit_logs schema per doc 04 §4.7 | Added `seq` column (migration 0008); hash-chain ordered by seq not created_at | Security review finding #2: created_at = txn start time forks the chain under concurrent money-path writes |
| D23 | Coverage 100% branch on ledger/escrow/fees at every gate (doc 09) | Ratcheted CI floor (~84% branch) now; 100% is the launch gate, needs fault-injection tests | Serialization-retry + unique-violation race branches require fault injection; tracked in gate-1.md |
| D24 | No animation library named in the frontend stack (doc 02) | Standardized on `motion` (Framer Motion) as the SOLE animation library — scroll sequences use Framer `useScroll`/`useMotionValueEvent`; keyhole lock is SVG + motion. GSAP and Rive were evaluated then dropped (Rive needs designer-authored `.riv` assets; GSAP unnecessary once Framer covers scroll) | Client requested an animated, modern UI but has no designer (2026-07-02); one code-only framework keeps it simple and dependency-light. Budget: transform/opacity only, `prefers-reduced-motion` honored, motion confined to marketing + app-chrome — never money/trade-room screens (Documents/11 §11.7) |
| D25 | Profile fields (display name, avatar, bio, email-change) beyond doc 04 users schema | Migration 0010 adds `users.display_name` (opt-in public handle), `avatar_style`/`avatar_seed` (DiceBear), `bio`, and `pending_email`(+token/expiry); new `zUserProfile` fields + derived `reputationTier` (REPUTATION_TIERS) + `AVATAR_STYLES`; deterministic `reputationTier()` helper; public `GET /traders/:id` merchant-profile endpoint | Client requested per-user + admin profile pages (change avatar/name/email), public merchant profiles, and a reputation ladder (2026-07-02). `display_name` is OPT-IN so the privacy-masked counterparty name stays default; reputation tier is deterministic (no LLM, per risk rules); email-change delivery pends the SMTP pipeline fix |
| D27 | `MJML + Handlebars` email templates (doc 02) | Handlebars keeps the plain-text part; the branded **HTML** part is a hand-rolled, email-client-safe table layout (`backend/src/modules/notify/notify.layout.ts`) with inline brand tokens + a `prefers-color-scheme` dark block — no MJML dependency. Emails now send multipart (HTML + text fallback); every value is HTML-escaped over the existing whitelisted, secret-free context (`safeContext`). Also fixed two latent bugs: `kyc_reviewed` now surfaces the review `decision`, and the KYC/trade status line renders. | Emails were plain-text only (security audit `phase3d` §"text-only"), which D25 flagged as the pending "SMTP pipeline fix". MJML's value (Outlook/multi-column quirk abstraction) is unnecessary for ~15 single-column transactional emails; hand-rolled inline-styled tables are dependency-light, fully controllable, and preserve the security posture. Emails remain EN-only (FR variants still pending, per `notify.templates.ts`) |
| D26 | No country/market segmentation in doc 04 schema | Migration 0015 adds a `countries` reference table (26 African markets seeded, **only `CM` enabled**), FK-binds the pre-existing `users.country`, and denormalizes `country` onto `offers`/`trades`. Sign-up is gated to enabled markets + a phone dial-code check; offers browse + detail and `openTrade` are scoped to the caller's market (openTrade also re-checks `enabled`, so disabling a market freezes new trades); admin enable/disable toggle (TOTP + hash-chained audit, `manageCountries` RBAC = SUPER+FINANCE). **Before binding the users FK the migration normalizes any historical non-seeded country code to `CM`** (`UPDATE users SET country='CM' WHERE country NOT IN (SELECT code FROM countries)`) — the old sign-up schema accepted any alpha-2 code. | Client requirement (2026-07-04): country-scoped P2P markets with a phased, one-country-at-a-time rollout to ramp customer-support load; Cameroon first. The normalization keeps the migration deploy-safe on a populated DB (it silently reassigns any stray user to the launch market — sign-off needed if any such user exists; the current DB has none). Currency + payment-rail generalization is deferred (metadata only on `countries`) until a second market is switched on |

### 2026-07-07 client re-prompt "PRODUCTION BACKEND UPGRADE — enterprise custodial infrastructure"

The client re-sent Doc 4 / Part E ("Internal Services Architecture — No Third-Party API
Dependency") as a "production upgrade," re-emphasising a **self-run TRON full node** and the
**Trezor Safe 3 key ceremony**. Almost every module it names already exists (treasury, ledger,
fees w/ 1-USDT deposit fee, deposits, withdrawals, escrow, revenue, audit, notify). The three
build-affecting decisions taken with the client on 2026-07-07:

| # | Client asked (2026-07-07) | We build | Reason |
|---|---|---|---|
| D2-amend | Run our OWN TRON full node; "no production dependency on external APIs" | **Reaffirm D2** (TronGrid free-tier + fallback RPC for launch) **and add a blockchain-provider adapter seam** so a self-hosted node drops in later with no redesign. Actual node provisioning/sync stays a post-launch ops project (not a coding task). | Client wants own-node in future ("own server room"); the seam satisfies the "no redesign for future chains" goal cheaply while D2's cost/ops reasoning still holds pre-launch. Node ops = weeks of infra, out of a coding session's scope. |
| D28 | Buyer picks **internal OR external** release destination before creating the order; on release, **broadcast on-chain** to the buyer's external wallet; "never broadcast before escrow release"; wrong-destination protection | Escrow release stays **UNCHANGED** — the buyer is always credited to their internal `user_available` on COMPLETED (this IS the wrong-destination protection: funds are never lost, buyer can withdraw later). If the buyer chose an external destination at trade-open (constrained to one of their **whitelisted + cooldown-passed** withdrawal addresses), completion **auto-creates a payout through the EXISTING audited withdrawal pipeline** (risk score, caps, AML screening, admin approval, signer handoff, broadcast). No new broadcast/signer code; **no new escrow FSM transition**. "Never broadcast before release" is guaranteed — the payout is only created after `COMPLETED`/`RESOLVED_RELEASE`. | Reuses the entire audited withdrawal→signer path instead of inventing a second broadcast route inside escrow; keeps the Gate-4 FSM and the ledger release math untouched; the signer (human-written) is never touched. **OPEN DECISION requiring client sign-off before the money code is written:** the auto-payout cannot collect a fresh per-transaction TOTP/PIN at release time — see note below. |
| D29 | Admin configures **ONLY** production wallet **public** info (xpub); backend never requests seed/master/private keys; replace the dev wallet at launch after the Trezor Safe 3 key ceremony | New `wallet_configs` table storing **public xpub only** (append-only history, one active row per network). Admin endpoint (**SUPER_ADMIN only, TOTP step-up, audited**) activates a production xpub; the xpub is validated through the existing watch-only derivation (**rejects xprv/malformed keys**). `WalletService` derives deposit addresses from the DB-active xpub, **falling back to env `WALLET_XPUB`** for dev. Rotation is **guarded**: refused when deposit addresses derived from the current active xpub already exist, unless an explicit, audited `acknowledgeReset` flag is passed (prevents silently orphaning custody of existing addresses). **No seed or private key is ever accepted, requested, or stored.** | Implements the key-ceremony "configure production wallet / replace dev wallet" step as public-info-only, matching the xpub-only architecture (Documents/01, 08 §D). The rotation guard makes the one-time launch swap safe and auditable. |

**D28 DECISION (settled 2026-07-07): option (b) — credit inside, buyer withdraws externally.**
The client chose the manual-trigger model. Consequence: **no new money-path code is required** —
this capability already exists end-to-end. On COMPLETED the buyer is credited to their internal
`user_available` (escrow release, unchanged); the `trade_completed` notification fires; the buyer
withdraws to any external TRON wallet through the existing audited withdrawals pipeline (whitelist +
2FA + PIN + caps + dual-approval + signer). The only change made is a copy nudge in the
`trade_completed` template pointing users to external withdrawal (not money-path). Option (a)
(auto-payout authorized at trade-open) is **not** built; if the client later wants fully-automatic
external delivery, it becomes its own gated increment reusing the same withdrawal path.

**D28 original open decision (now resolved by the above):**
the auto-triggered escrow→external payout can't prompt the buyer for a fresh TOTP/PIN at the
moment of release. Two safe options — (a) **authorize at trade-open**: buyer supplies TOTP+PIN and
picks a whitelisted+cooldown destination when opening the trade, and completion treats that as the
authorization (full caps/screening/approval still apply); or (b) **manual trigger**: on completion
the buyer is credited internally and must start the withdrawal themselves (simplest/safest, but not
"automatic"). Recommend (a). This is a money-path security choice and per Behavioral Rule #1 it will
not be decided in code without sign-off.

### 2026-07-08 client re-prompt "Self-Hosted Blockchain Infrastructure Upgrade (Addendum)" + wallet-spec gap closure

A multi-agent audit (36 agents, adversarially verified) scored the earlier "Wallet
Infrastructure Upgrade" spec at ~60% coverage. This addendum re-demands a self-hosted TRON
full node, a Blockchain Provider abstraction, an HD wallet **provisioning** engine (auto-create
on KYC), a Cold Wallet Provider abstraction, admin-configurable hot-wallet + launch limits, and
enterprise monitoring. Decisions taken for the build:

| # | Client asked | We build | Reason |
|---|---|---|---|
| D30-node | Deploy & operate our OWN TRON full node; "no dependency on paid wallet providers" | **Reaffirm D2 for launch** (TronGrid free-tier + fallback) **and build the Blockchain Provider abstraction** (`BlockchainProvider` interface + `TronProvider` wrapping the RPC client, primary/secondary URL + failover config) so a self-hosted node drops in by changing config only — no business-logic change. Physically provisioning + syncing a ~2 TB java-tron node stays an **ops task**, not a coding deliverable. | Node ops = weeks of infra; the provider seam delivers the addendum's "no business logic depends on TRON / adding a node needs no redesign" goal in code today. |
| D30-provision | Auto-generate the deposit wallet the moment register+email+**phone**+KYC complete | Auto-provision the deposit address on **KYC approval** via a `WalletProvisioningService` fed by the `kyc.reviewed` outbox event (audited + `wallet.created` notification). **Phone-verify stays skipped** (client decision, no SMS provider) so the gate is register+email+KYC. | Closes the #1 audit gap (address was lazy/on-demand). Phone gate deferred per the earlier skip decision. |
| D30-cold | Cold Wallet Provider abstraction (Trezor Safe 3 = coming soon, disabled) | `ColdWalletProvider` interface + a **disabled** `TrezorSafe3Provider` stub + registry; wallet-config activation remains the deposit-xpub seam. Enabling later = provider config, no other code change. | Closes the audit's "no cold-wallet abstraction" gap; real hardware comms stay out until the device + key ceremony exist. |
| D30-limits | Admin-editable hot-wallet balances/reserve/limits + launch-protection ceilings | Add the missing keys to the settings whitelist (hot-wallet min/max/reserve/daily-op-limit/alert-threshold; max balance/user, max daily deposit/user, max platform custody, max pending-queue, max daily withdrawal volume, max withdrawals/day) with enforcement where a money path exists. | Closes audit gaps #6 + #11 (only 3 of 10 limits were admin-editable). |
| D30-gaps | (from audit) real holes to fix regardless of the spec | Audit-log deposits + internal transfers; notify withdrawal **approved/rejected/failed** and incoming internal transfers (events were emitted but dropped, so a rejected+refunded withdrawal never told the user). | These are genuine trust/observability gaps the audit surfaced, independent of the addendum. |

Note: money-path features here are built **sequentially** (not via parallel agents) because they
edit shared money-path files; each increment is typechecked + committed + pushed on its own.

### 2026-07-15 client prompt "Production Readiness Infrastructure" (Phase A + monitoring)

| ID | Doc says | We did | Why |
|---|---|---|---|
| D31-prom | Doc 02 lists Prometheus + Grafana as infra; no metrics client library named | Added `prom-client` (backend dependency) exposing `GET /metrics`: default process metrics + an HTTP-latency histogram (interceptor) + business gauges (withdrawals/trades/deposits by status, stuck broadcasts, users, alerts/hour) computed **read-only at scrape time**. Containerized Prometheus + Grafana + Uptime-Kuma + node-exporter under `infra/monitoring/`. | Client requested full monitoring (§3). `prom-client` is the standard pure-JS Prometheus client (no native build). Business gauges query the DB at scrape — **no money-path code is instrumented**, the ledger stays untouched. `/metrics` is root-path, served only on the 127.0.0.1-bound API (local to Prometheus). |
| D31-telegram | Notifications = email + in-app (doc 02); Telegram not named | Env-gated Telegram transport added to `AlertsService` (`TELEGRAM_BOT_TOKEN` + `TELEGRAM_CHAT_ID`) alongside the existing webhook / email / admin-Alerts-page channels. | Client requested Telegram ops alerts (§4). Dormant until creds are set; best-effort with a 5s timeout — never blocks the flow it observes. |
| D31-health | Doc 12 = `/health` + `/health/ready` | Added `/live`, `/ready`, `/status` (storage/wallet/disk/memory probes; signer + queue reported `worker_scoped` since they run only in the worker). Existing paths kept. | Client requested `/health` `/ready` `/live` `/status` (§12). New paths are root-level (excluded from the `api/v1` prefix) for conventional uptime/Prometheus probing. |
| D31-signer | "Implement a dedicated signer service on a separate VPS" (§1) | **Design + prepare only; NOT deployed** (client deferred the 2nd VPS). Signer stays human-written per `backend/SIGNER.md`; this repo holds only the client interface + mock. | Client instruction (2026-07-15): purchase the signer VPS last, after all other readiness tasks. Also aligns with the standing rule that Claude never generates signer key-handling code. |

Note: `sharp` + `clamscan` (upload EXIF-strip + AV, audit B28) and the full §9 country/IP-block +
persisted-velocity admin editors remain deferred — the former needs a native dep + the ClamAV daemon,
the latter is a self-contained admin feature scheduled as its own increment.

### Legal/commercial guardrails to settle in writing BEFORE building (from prior research)
- Client owns the legal entity, any required licenses, treasury/cold keys, and the regulatory/legal risk. Developer is a contractor, not fund custodian.
- The 30% revenue-share can reclassify the developer as an operator/partner (higher liability). Prefer paid milestones or a clear contract that isolates liability + indemnifies the developer.
- Written record that the developer advised the client of the CEMAC/COBAC crypto restrictions and data-protection obligations.
- Walk-away triggers: client refuses written contract / refuses to hold keys & licenses / pressures for auto-KYC or removing caps / wants developer to custody funds personally.

### 2026-07-20 deposit-audit remediation (MEDIUM batch)

| ID | Doc says | We did | Why |
|---|---|---|---|
| D32-hold | Migration 0018 promised "so the admin queue can surface both"; docs describe holds but name no release path | Added migration 0032 (`hold_resolution` RELEASED/REJECTED + reason/by/at), `HeldDepositsService`, `GET /admin/deposits/held`, `POST .../release`, `POST .../reject`, RBAC `reviewHeldDeposit` (SUPER + COMPLIANCE). RELEASE stamps the row so the credit path skips re-screening and the amount policy; REJECT keeps the flags set and moves no funds. | An `aml_hold` / `policy_hold` deposit was skipped by the confirmation job on every tick and **nothing anywhere could clear either flag** — held funds were on-chain, visible to the user, and permanently uncreditable with no operator path out. |
| D32-conf | Docs treat `DEPOSIT_CONFIRMATIONS` (env) and the admin `deposit_policy.confirmations` as one number | `SettingsService.depositConfirmations(envFloor)` = `max(admin value, env floor)`; both the credit gate and the deposit-address response use it. | They were two independent numbers: the gate enforced env while the UI advertised the admin setting, so raising it in the console changed nothing and users were told a threshold that was not enforced. Env is now a floor an admin cannot lower. |
| D32-stepup | Doc 06 requires TOTP step-up on "sensitive" admin actions without enumerating them | Extended step-up to freeze/suspend/restore, KYC approve/reject/resubmit, and both held-deposit decisions. | Each either cuts off a user's access to their own funds or raises their limits. A stolen admin session was previously sufficient for all of them. |
| D32-xpubfp | Not addressed in the docs | Audit metadata stores a SHA-256 fingerprint of the retired xpub instead of the key itself. | Audit rows are readable by SUPER/COMPLIANCE/AUDITOR — wider than `manageWalletConfig` (SUPER only). The xpub cannot spend but derives every user's deposit address. |

**OPEN — needs a client/architecture decision before launch (not silently assumed):**

- **xpub rotation leaves legacy addresses unspendable.** `deposit_addresses` carries
  `UNIQUE(user_id, asset)`, so an existing user keeps their address forever. After a rotation
  every already-issued address still derives from the **retired** key: deposits to it are
  credited by the platform but cannot be signed by the new seed. Rotation now raises a CRITICAL
  alert naming both fingerprints, and remains blocked unless an admin sets `acknowledgeReset` —
  but acknowledging does not make the funds spendable.
  Resolving it properly means dropping `UNIQUE(user_id, asset)`, stamping each address with its
  `wallet_config_id`, issuing fresh addresses from the active key, and keeping the retired
  addresses **watched** (never deactivated — deactivating would silently lose funds sent to them).
  That is a money-path schema redesign, so it is logged here rather than built unattended.
  **Interim operating rule: retain the retired key's spending seed indefinitely after any rotation.**
- **F2 (admin 2FA enforced at login)** deferred at the client's explicit instruction (2026-07-20):
  "we will add this in complete end proper". `ADMIN_2FA_REQUIRED` still gates step-up.

### 2026-07-20 UI completeness audit (48 findings) — remediation

| ID | Doc says | We did | Why |
|---|---|---|---|
| D33-feeschedule | Doc 11 treats the /fees page as marketing copy | New PUBLIC `GET /fees/schedule` returns the live deposit fee, withdrawal fee, per-rail trading bps, seller bps and minimum deposit. The fee table, the calculator and the escrow simulator all render it, with the seeded values as an offline fallback. | The page kept its numbers in the translation catalogue and advertised a **0 USDT withdrawal fee while `withdrawal_fee` was configured at 1 USDT and every withdrawal was charged it** — a consumer-facing misstatement about money, with nothing keeping the two in step. Read-only and limited to what a prospective user is entitled to know; no limits, ceilings or internal thresholds. |
| D33-quote | Not addressed | New `GET /withdrawals/quote` reusing the SAME settings lookup, promo waiver and `computeFee` call as `request()`. | The withdraw screen validated against `available` while the ledger debits `amount + fee`, so entering your full balance passed the client check and was rejected by the server — and the fee was never visible until the receipt, i.e. after the money moved. |
| D33-holds | Migration 0032 deliberately added no `deposit_status` value | `zDeposit` carries `onHold` + `holdResolution`; the badge, the row note, the receipt and the CSV all distinguish "Under review" and "Not credited"; REJECTED deposits leave the `pending` balance sum. | Holds are flags, so a compliance-parked deposit was indistinguishable from one still confirming, and a permanently REJECTED one also read "Confirming" — a pending state for money that is never arriving. |
| D33-stepup | Doc 06 requires step-up on "sensitive" admin actions | The four admin screens that gained server-side step-up now collect the code; `TotpActionDialog` emits `undefined` rather than `""`. | A server-side contract change had left freeze/suspend, KYC review and the hold decisions demanding a code with no field to enter it, and `""` fails zod's 6-digit rule — which broke the wallet key ceremony outright. |

**Still open after this pass:**

- **`pending` sums the GROSS deposit amount**, not `amount − fee`, so the figure a user sees
  overstates what will actually be credited. Pre-existing; not changed here because it is a
  money-display decision (show gross-in-flight or net-expected?) the client should make.
- ~~Which withdrawal fee the business intends~~ — **RESOLVED 2026-07-20: 1 USDT.** The seeded
  `withdrawal_fee` is `{"USDT_TRC20":"1000000"}` (1 USDT at 6 decimals), which is what
  `WithdrawalsService` already charges, so no config change was needed. The /fees page, the
  calculator and the simulator all render the live configured value, and the FAQ claiming
  "withdrawals pay only the network fee" was corrected by migration 0033. Changing it later is
  an admin settings edit; the published page follows automatically.
- `promo_campaigns` still has no admin editor (see the 2026-07-20 entry above).
