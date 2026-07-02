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

### Legal/commercial guardrails to settle in writing BEFORE building (from prior research)
- Client owns the legal entity, any required licenses, treasury/cold keys, and the regulatory/legal risk. Developer is a contractor, not fund custodian.
- The 30% revenue-share can reclassify the developer as an operator/partner (higher liability). Prefer paid milestones or a clear contract that isolates liability + indemnifies the developer.
- Written record that the developer advised the client of the CEMAC/COBAC crypto restrictions and data-protection obligations.
- Walk-away triggers: client refuses written contract / refuses to hold keys & licenses / pressures for auto-KYC or removing caps / wants developer to custody funds personally.
