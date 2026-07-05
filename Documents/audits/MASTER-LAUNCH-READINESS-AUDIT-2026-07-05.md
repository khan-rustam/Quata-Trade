# QuataTrade — MASTER Launch-Readiness Audit & Completion Punch List

**Date:** 2026-07-05 (restructured into work-parts on request) · **Status:** the single source of truth for "what is left to reach 100% launch-ready."

This master consolidates and de-duplicates all prior work — Phase 1 (site audit), Phase 2 (market), Phase 3A–3H (architecture, backend, frontend, security, database, devops, code-quality, launch-readiness), plus a fresh integration-gap / keys / feature-completeness / media discovery pass — and is now organized by **who does the work**.

## How this document is organized

| Part | What it is | Who | When |
|---|---|---|---|
| **PART 1** | Items the **developer cannot complete alone** — need the **client/owner** (keys, signer, legal, values) or the **OPS team / server owner** (backups, monitoring, vault, host/nginx). | Client + OPS | In parallel |
| **PART 2** | **Developer code work — FIRST PRIORITY.** Every bug/issue + every partial item where the **backend is built but the frontend is missing / not integrated / not wired**. Goal: **code 100% fixed.** | Developer (me) | **NOW** |
| **PART 3** | **Build from scratch** — features/content with **no code yet** (blog, referral, feeds, etc.). | Developer (me) | After Part 2 |

**Work order:** finish **Part 2** → then **Part 3** → **Part 1** runs on the client/OPS side in parallel. Launch = all three converge, then flip the production keys (§P1-keys).

**Splitting note:** items that straddle a line are split — e.g. *French legal* = the `fr` localization **code seam** (Part 2) + the **lawyer-reviewed text & entity details** (Part 1); *AML blocklist* = the **admin console UI** (Part 2) + the **OFAC/OpenSanctions feed sync** (Part 3); *company/contact placeholders* = the **code seam** (Part 2) + the **real values** (Part 1).

### Part-2 live progress tracker
Legend: ⬜ todo · 🔷 in progress · ✅ done · 🧪 done+verified. (Updated as work proceeds.)

| Batch | Items | Status |
|---|---|---|
| 2.A Quick-win non-money fixes | ✅ OG metadataBase · ✅ social-link XSS · ✅ build-order · ✅ coverage-gate CI · ✅ placeholder banners/company seam · ✅ status page (live probe) · ✅ /health/ready (redis) · ✅ next headers/poweredBy+trustProxy+API-bind+cookie-Secure · ✅ ALERT hard-stop + dev-secret rejection · ⬜ deploy pre-migrate+rollback · ⬜ MCP pw migration · ⬜ fr legal seam | 🔷 **10/13 done + verified** |
| 2.B Frontend integration | ✅ trades history (`/account/trades`) · ✅ dispute evidence UI (trade-room panel + BE `disputeId` on trade detail + upload client method) · ✅ AML admin console (`/admin/screening`) · ✅ settings editor (`/admin/settings` — payment-window + deposit-policy editable; fees/caps read-only until 2.D) · optional trio deferred (see note) | ✅ **4/4 core DONE + verified** |
| 2.C Non-money bug + UX/a11y/perf/media | ✅ wallet-cache invalidation (withdraw/transfer/offer/trade-room) · ✅ 401 single-replay · ✅ offer-price float + content-server zod-parse · ✅ a11y set (skip-link+`<main>`, 7 page h1s, light contrast tokens, 27 `<Link><Button>` de-nested, footer 24px targets, chat `role=log` + danger-Alert `role=alert`, dialog focus-trap/restore, Segmented radiogroup, admin mobile drawer) · ✅ perf (recharts `next/dynamic`, terminal-trade poll stop, mono-font preload trim) · ✅ media (OG→1200×627, PWA 512+maskable, avatar offline fallback; logo already real) · ✅ hygiene (7 dead deps, 4 dead exports, formatRate float, BullMQ docstrings) · ✅ status-page i18n · ◻️ force-dynamic (blocked by cookie i18n — noted) · ◻️ deferred: helper-consolidation, shared ESLint, global error filter, noUncheckedIndexedAccess | ✅ **DONE + verified** |
| 2.D Money-path focused batch (tests-first) | ✅ **money-config editability slice DONE**: B27 dual-approval reconciliation (migration 0017 trigger) · fee_bps hardening (`MAX_FEE_BPS`, full-11-rail) · caps ordering + int8 bound · fee/cap admin editors · ledger-adjustment shared schema + client + SUPER-only UI · money-`Number()` ESLint broadening · 8/8 adversarial findings fixed. ◻️ **Remaining original-2.D (not this session):** openTrade idempotency (B11) · deposit exactly-once (B12) · session revocation (B10) · AML re-screen half of B27 · per-asset journal trigger (E1) · verifyChain streaming (DOS) · TOTP single-use + atomic PIN (2FA) · EXIF/AV/retention (B28) · crypto consolidation (CRY) | 🔷 **config slice done + verified; hardening items open** |

**Bonus fixes landed alongside 2.A:** added the missing `frontend` `typecheck` script + a `shared` `prepare` hook (3A build gaps); added 3 env-guard unit tests. All changes verified against the running app + `pnpm typecheck`/`lint`/backend unit tests (153/153 green).

---

## §0. Verdict (unchanged)

QuataTrade is **~85% built and the hard part is done right**: the ledger + escrow FSM are **correct by verified construction** — two independent audits found **no path to lose funds, imbalance the ledger, double-credit a deposit, or release escrow while DISPUTED**. It is **not launch-ready today**; the gaps are the signer (doesn't exist), a few missing frontends, the operational layer, the perimeter + admin auth, and legal/content — none of them the money core.

---

# PART 1 — CLIENT / OWNER / OPS DEPENDENCIES
*(You, the developer, cannot complete these. Hand to the client/owner and OPS team; they can run in parallel with Part 2.)*

## 1.1 — Client / Owner provides
| ID | Item | Effort | Note |
|---|---|---|---|
| B1 | **Production signer (Host B)** — human-written, isolated, mTLS-over-WireGuard. `RemoteSignerService` is a throwing stub; **no USDT can leave custody until this exists.** The single absolute payout blocker. | XL | Per `backend/SIGNER.md`; never AI-generated. |
| B2 | **Key ceremony + cold-key redundancy** — offline BIP39 seed → account **`WALLET_XPUB`** + hot-wallet address; define **SLIP-39 / multisig** cold-key backup (currently undefined = single-device total-loss risk). | L | Air-gapped; client holds keys. |
| B3 | **Legal entity + crypto licensing + lawyer review** — no company in the product; engage CEMAC/COSUMAF VASP accreditation; lawyer must review + sign off the legal text. | XL | Regulatory; existential. |
| B4 | **External penetration test** — required security gate (Gate 7). | L | Third-party vendor. |
| B3-values | **Company legal identity values** — legal name, RCCM, NIU, registered address, legal representative, license number — to fill the Imprint (dev seam is B17 in Part 2). | S | Client supplies text. |
| B16-text | **Lawyer-reviewed legal text (EN + FR)** — the actual Terms/Privacy/AML/Risk/etc. content (dev builds the `fr` seam in Part 2). | L | Counsel supplies text. |
| B18-values | **Company/contact real values** — support hours, phone/WhatsApp, address, social links, legal@ email — entered via the admin content panel (dev seam is B18 in Part 2). | XS | Client fills in admin. |
| KEYS | **Bucket-1 production credentials (flip-the-keys, do last):** `MASTER_ENCRYPTION_KEY`, `JWT_ACCESS_SECRET`, `WALLET_XPUB`, `WALLET_HOT_ADDRESS`, TronGrid mainnet URL + `TRONGRID_API_KEY` + `USDT_TRC20_CONTRACT`, MinIO prod creds + SSE/KMS, `SMTP_*` (Hostinger), `ALERT_WEBHOOK_URL`, signer mTLS cert paths. | — | Supplied at go-live once integrations are wired (all are built & wired). |
| DECIDE | **Bucket-2 external-service decisions** — whether to buy commercial KYC (Smile ID), MaxMind, FingerprintJS Pro, Sentry (each needs a *build* in Part 3 first, then a key). | — | Product/budget decision. |

## 1.2 — OPS / server / infra (needs server access or the OPS team)
*(The developer writes the config/code in Part 2; the OPS team provisions and deploys it on the production box.)*
| ID | Item | Effort | Note |
|---|---|---|---|
| B5 | **Offsite backups + one restore drill** — provision encrypted offsite storage (DB **and** MinIO) in a different region, key off-host, run + record a restore. Today: local-only, never restored, RPO ~24h → host loss = total ledger loss. | M | Storage + cron install + drill. |
| B6-infra | **Stand up monitoring** — Uptime probe (Uptime Kuma), error tracking (Sentry/GlitchTip), Prometheus/Grafana. (Dev wires `/health/ready` + the `ALERT_WEBHOOK_URL` boot guard in Part 2.) | M | Servers/services. |
| B7-infra | **Secrets vault** — provision Infisical/SOPS so `MASTER_ENCRYPTION_KEY` etc. are not plaintext on a shared box. | M | Infra; dev wires the loader. |
| B9-deploy | **nginx edge deploy** — deploy the version-controlled vhosts (HSTS/CSP/X-Frame, 127.0.0.1 upstreams) the dev checks into the repo in Part 2. | S | On the production box. |
| B26-host | **Host hardening** — ufw default-deny + fail2ban + unattended-upgrades + SSH-key-only on the shared CloudPanel VPS. | S | Server owner. |
| STORAGE | **MinIO prod + KMS** — provision production MinIO/S3 with SSE-S3 KMS so at-rest encryption works (env hard-stop requires it). | S | Infra. |

---

# PART 2 — DEVELOPER CODE WORK  ·  FIRST PRIORITY
*(Everything here I can do now. Order: 2.A quick wins → 2.B frontend integration → 2.C non-money bugs/UX → 2.D money-path batch, tests-first.)*

## 2.A — Quick-win fixes (non-money, cheap, high-ROI)
| ID | Item | Layer | Effort | Status |
|---|---|---|---|---|
| B19 | **OG/Twitter `metadataBase`** — set it so social previews stop resolving to `localhost:3000`. | FE | XS | ⬜ |
| B21 | **Stored XSS via `zSocialLinks`** — add `http(s)`-scheme validation (`z.url()` alone doesn't block `javascript:`) + normalize at the footer `href`. | shared/FE | XS | ⬜ |
| B22 | **Frontend build broken from clean checkout** — enforce shared-build-first / project references so `formatFiat` resolves. | FE/build | XS | ⬜ |
| B20 | **Wire `--coverage` into CI** + re-verify Gate 1 (the money-path gate is dead config). | CI | S | ⬜ |
| B18 | **Company/contact code seam** — remove the visible "To supply"/`[[…]]` placeholder banners on Contact/About; render real fields once the client fills them; hide empty gracefully. | FE | S | ⬜ |
| B25 | **Status page** — wire to `/health/ready` or honestly label "manually updated" + add i18n (currently hardcoded "operational", English-only). | FE | S | ⬜ |
| B23 | **`/health/ready` real probe** — check Redis/MinIO/RPC/chain-lag/reconciliation, return 503 on degrade. | BE | S | ⬜ |
| B24 | **deploy.sh** — add a pre-migrate DB snapshot + make a failed health check actually roll back (or fix the runbook claim). | INFRA | S | ⬜ |
| B26-code | **API bind `127.0.0.1`** (make host configurable) + **require `QT_MCP_DB_PASSWORD`** in migration `0007` for non-dev. | BE/DB | S | ⬜ |
| B9-code | **`next.config.ts` `headers()`** (HSTS/CSP/X-Frame fallback) + `poweredByHeader:false`; pin `trustProxy` to the nginx hop; set refresh cookie `Secure` on HTTPS not `NODE_ENV`. | BE/FE | S | ⬜ |
| B6-code | **`ALERT_WEBHOOK_URL` prod boot hard-stop** in `env.ts` (mirror `ADMIN_2FA_REQUIRED`); widen prod secret hard-stops to reject dev DB/MinIO/SMTP passwords. | BE | XS | ⬜ |
| B16-code | **French legal seam** — make `LEGAL_DOCS` locale-keyed and route `/legal/[slug]` through `qt_locale`; localize legal metadata. (Text itself is Part 1 B16-text.) | FE | M | ⬜ |

## 2.B — Frontend integration (backend built, frontend missing/not wired)
| ID | Item | Direction | Effort | Status |
|---|---|---|---|---|
| B13 | **User trades / order-history page** — build the page + nav link consuming `GET /trades` (`client.trades()`, currently 0 call sites). | BE✅/FE | M | ⬜ |
| B14 | **Dispute evidence UI** — wire `client.dispute()` + `submitEvidence()` + add the missing `POST /disputes/:id/upload` client method; let users view a dispute and submit evidence. **NEW FINDING (needs a small BE addition):** dispute endpoints are keyed by *dispute id*, but `zTrade` has no `disputeId` and there's no fetch-by-trade route — so after a reload the trade room can't reload the dispute. Add `disputeId` to `zTradeDetailResponse` (or a `GET /trades/:id/dispute`) + the mapper join, then wire the FE. | BE(small)+FE | M | ⬜ |
| B15 | **AML sanctions blocklist admin console** — build `/admin/screening` page + nav consuming `adminBlockedAddresses`/`adminBlockAddress`/`adminUnblockAddress` so compliance can populate the blocklist. | BE✅/FE | M | ⬜ |
| SET | **Admin settings editor** (fees/limits/caps) — wire `adminUpdateSetting` (only kill-switch is wired today) so operators tune economics without DB access. | BE✅/FE | M | ⬜ |
| RT | **Socket.IO client (optional)** — wire `socket.io-client` to the built `ChatGateway`, or accept polling and remove the dead dep. | BOTH | M | ⬜ |
| ATT | **Chat attachment upload** — add the `POST /trades/:id/attachments` client method + UI. | FE | S | ⬜ |
| LADJ | **Admin ledger-adjustment UI** — add client method + page for `POST /admin/ledger/adjustment` (incident tool). | FE | S | ⬜ |

## 2.C — Non-money bug fixes, UX, accessibility, performance, media
| Area | Items | Effort | Status |
|---|---|---|---|
| Correctness (FE) | Invalidate `qk.balances` after every money movement; make the 401 handler **replay** the original request after refresh; fix `createOffer` cache invalidation; parse `content-server` with zod instead of casting; type the 5 admin mutations (drop `zAnyRecord`). | M | ⬜ |
| Accessibility | Light-theme accent + `text-3` contrast; skip-link + `<main>` on the public shell; one `<h1>` per marketing page + fix Help slug headings; de-nest `<Link><Button>` (~20 sites); dialog focus-trap/restore on the money step-up; `aria-live` on chat + PIN/TOTP errors; footer target size ≥24px; admin mobile nav; segmented `radiogroup`. | L | ⬜ |
| Performance | Scope `force-dynamic` off marketing (static prerender); `next/dynamic` for recharts + below-fold; trim font preloads; stop terminal-trade polling; memoize the trade room. | L | ⬜ |
| Media | Replace the placeholder keyhole glyph with the real logo; make the logo theme-aware; wire (or remove) the ~11 dead illustration assets; resize/compress OG to 1200×630 <150KB; add PWA 512 + maskable icons + SVG favicon; self-host/proxy DiceBear avatars with a fallback. | M | ⬜ |
| Hygiene | Global exception filter (one error envelope); remove 5 unused deps + fix BullMQ docstrings; delete dead exports; consolidate the 4 money-display helpers; add ESLint to `shared/`; broaden the money-`Number()` ban; frontend `noUncheckedIndexedAccess`. | M | ⬜ |
| XAF naming | Fix the JS-float display path (`formatRate`) and the "XAF"-hardcoded labels now mislabeling live NGN/GHS markets (display-layer; the smallest-units bigint pipeline stays). | M | ⬜ |

## 2.D — Money-path focused batch (tests-first, reviewable line-by-line)
*Done last as a separate batch; each change is written tests-first and I re-verify the ledger/escrow/fees coverage gate. None of these ships without its test.*
| ID | Item | Effort | Status |
|---|---|---|---|
| B11 | **`openTrade` idempotency** — honor the mandated key (unique index + return existing on replay); add a duplicate-open regression test. | S | ⬜ |
| B12 | **Deposit exactly-once** — stable on-chain `log_index` + re-verify tx inclusion/confirmations at credit (reorg/orphan safety). | M | ⬜ |
| B10 | **Session revocation** — implement the `sid` denylist so freeze/logout cut live sessions; `refresh()` rejects non-active users; admin session revocation. | M | ⬜ |
| B27 | **Dual-approval backstop + AML re-screen** — ✅ **dual-approval DONE** (migration 0017: `big_needs_two` CHECK → trigger reading the live `dual_approval_threshold`, + `approved_by IS NOT NULL` fix, + `approve()` reads the threshold live in-txn); ◻️ AML re-screen at approval+sign still open. | S | 🔷 **dual-approval done** |
| E1 | **Per-asset balanced-journal trigger** — `GROUP BY asset HAVING SUM(amount)<>0` (dormant until asset #2; fix before any BTC/ETH). | S | ⬜ |
| DOS | **`verifyChain` streaming** + reconciliation-job try/catch + atomic kill-switch flip. | S | ⬜ |
| 2FA | **TOTP single-use** (persist last consumed step) + **atomic PIN counter** (`UPDATE … RETURNING`). | S | ⬜ |
| B28 | **EXIF strip + AV scan + PII retention** — add `sharp` re-encode (strip metadata), wire ClamAV scan-before-store, retention jobs for chat/dispute/orphan-KYC. | M | ⬜ |
| CRY | **Consolidate AES-GCM crypto** onto `common/crypto.ts`; delete the 2 duplicate copies + stale comments. | XS | ⬜ |

---

# PART 3 — BUILD FROM SCRATCH (no code yet)
*(After Part 2. Features/content with no backend or frontend today.)*
| Item | Layer | Priority | Effort | Note |
|---|---|---|---|---|
| **OFAC / OpenSanctions feed sync** | BE | P1 | M | Screening chokepoint exists; build the sanctions-import job (pairs with the B15 console). |
| **Live rate feed** (XAF/NGN) | BOTH | P2 | M | Replace the hardcoded indicative rate; optional charts. |
| **~30 help-center articles** | CONTENT | P2 | L | Behind the 8 category tiles; doubles as SEO. |
| **Proof-of-reserves attestation** | BOTH | P2 | L | Strong trust lever; monthly Merkle + published wallets. |
| **Bug-bounty page + `security.txt` + VDP** | CONTENT | P2 | S | Cheap credibility. |
| **Blog** | BOTH | P3 | M | Footer "soon" link; no route. |
| **Careers** | BOTH | P3 | S | Footer "soon" link; no route. |
| **Referral program** | BOTH | P3 | L | Not even the "stub tables" the spec claims. |
| **Dealer program** | BOTH | P3 | L | Deferred. |
| **Airtime/data module** | BOTH | P3 | XL | Deferred. |
| **FCM / push notifications** | BOTH | P3 | L | In-app + email only today. |
| **Flutter mobile apps** | EXTERNAL | P3 | XL | Web + admin only for Phase 1; accelerate to mo 9–12 (Phase 2). |
| **MaxMind GeoIP risk signal** | BE | P2 | M | Needs DB/key + rule code. |
| **FingerprintJS device intelligence** | BOTH | P2 | M | FE must generate the fingerprint; SDK + verify. |
| **Sentry / analytics** | BOTH | P1 | S | Ties to B6 monitoring. |
| **Commercial KYC / OCR (Smile ID)** | BOTH | P2 | XL | Manual review stays the required path; this is optional assist. |
| **`TRON_FALLBACK_RPC_URL` failover** | BE | P1 | S | Env declared but no failover code; chain SPOF. |

---

## Definition of "100% code-fixed" (Part 2 exit)
- [ ] Every 2.A / 2.B / 2.C / 2.D item ✅ and 🧪 (verified in the running app + test suite).
- [ ] `pnpm typecheck` + `pnpm lint` + `pnpm test` + `pnpm test:integration` green; `--coverage` runs in CI with the ledger/escrow/fees gate green.
- [ ] No user-visible placeholder (`[[…]]`, "To supply", "To write", fake "operational") on any page except where it depends on Part-1 client values (clearly marked).
- [ ] Every built backend endpoint has a frontend consumer or is intentionally admin/ops-only.
- [ ] A clean checkout builds; OG/meta contain no `localhost`.

Then **Part 3** (build-from-scratch), then **Part 1** converges (client/OPS), then flip the Bucket-1 keys and go live capped.

## Appendix — source index + progress log
Phase 1 `website-launch-audit-2026-07-04.md` · Phase 2 `../research/phase2-market-intelligence-2026-07-05.md` · Phase 3A–3H `phase3{a..h}-*-2026-07-05.md` · spec `../../PROJECT-OVERVIEW.md`. Integration-gap / keys / feature-completeness / media detail from the 2026-07-05 discovery pass (workflow `wf_7f23dbee-b2e`).
**Progress log:** _(updated as Part-2 batches complete)_
- 2026-07-05: report restructured into Parts 1/2/3; Part-2 work started.
- 2026-07-05 (batch 2.A): **11 fixes landed & verified** in the working tree (no commits) against the running app + `pnpm typecheck`/`lint` + 153/153 backend unit tests. Files: `layout.tsx` (B19 metadataBase), `shared/schemas/content.ts` + `public-footer.tsx` (B21 XSS), `shared/package.json` (B22 prepare hook) + `frontend/package.json` (added `typecheck`), `.github/workflows/ci.yml` + `backend/package.json` (B20 coverage gate), `about/contact/help` pages (B18 placeholders), `status/page.tsx` (B25 live probe), `health.controller.ts` (B23 redis), `main.ts` (B9 trustProxy+bind) + `next.config.ts` (B9 headers/poweredBy) + `auth.controller.ts` (B9 cookie Secure), `env.ts`+`env.spec.ts` (B6 hard-stops +3 tests), `0007_readonly_role.ts` (B26 MCP-pw guard).
- **2.A carryovers:** B24 (deploy.sh pre-migrate backup + health-gated rollback) — code-ready but **not editable-with-verification here** (prod ops script; review on the deploy host); B16-code (French legal `fr` seam) — deferred into a dedicated content/i18n pass (needs the Part-1 lawyer text anyway).
- 2026-07-05 (batch 2.B, partial): **2 of 4 integration pages built & verified.** ✅ **B13 trades history** — new `hooks/use-trade.ts:useTrades`, `app/(app)/account/trades/page.tsx`, account-menu link, `myTrades` i18n (en+fr). ✅ **B15 AML console** — new `hooks/use-screening.ts`, `app/admin/screening/page.tsx`, admin-nav entry (`kycReview`-gated to match backend), `adminScreening` i18n (en+fr). Both typecheck+lint clean, routes compile 200. B14 (dispute evidence) recorded as needing a small BE addition (dispute-by-trade); settings editor pending.
- **Session totals (working tree, no commits):** 3 new files + 23 modified; all 3 packages typecheck, backend+frontend lint clean, 153/153 backend unit tests, i18n en/fr parity intact, stack healthy.
- 2026-07-05 (batch 2.B COMPLETE — 4/4 core): **B14 dispute-evidence** — BE: `disputeId` added to `zTradeDetailResponse` + `mapTradeDetail` + controller lookup (spec updated, 17 trades tests green); shared: `uploadDisputeEvidence` client method; FE: `hooks/use-dispute.ts` + a full DISPUTED panel in the trade room (view reason/status/evidence timeline + submit evidence with file upload) + `tradeRoom` i18n. **Settings editor** — BE: `SettingsService.adminSnapshot()` + `GET /admin/settings` (editSettings-gated, `SettingsService` injected into admin controller); shared: `zAdminSettingsResponse` + `adminSettings()` client method; FE: fetch-wrapper + keyed `ConfigForm` (edits payment window + deposit policy via TOTP step-up; fees + withdrawal caps shown read-only) + `adminSettings` i18n.
- **Optional trio (deliberately deferred, documented):** socket.io client — polling is an accepted launch degrade (audit), non-blocking; chat attachments — payment-proof upload already exists, small add available later; **admin ledger-adjustment UI — money-path (manual double-entry corrections) → belongs in 2.D**, not built ad-hoc.
- **2.B session totals (working tree, no commits):** all 3 packages typecheck, backend+frontend lint clean, 153/153 backend unit tests, en/fr i18n parity, all endpoints auth-gated, stack healthy.
- 2026-07-05 (batch 2.C COMPLETE): non-money bug/UX/a11y/perf/media/hygiene sweep, all verified in the working tree (no commits).
  - **C-1 correctness:** shared API client now replays a request **once** after `onUnauthorized` (401) instead of surfacing the error; TanStack cache invalidation added after withdraw/transfer/create-offer and on trade-room refresh (balances went stale); create-offer price sent straight to bigint (dropped the `Number()/Math.round()` float hop); `content-server.ts` parses every response through the shared zod schema (`safeParse`→defaults) instead of `as T`.
  - **C-2 accessibility:** root-layout skip-link + `id="main-content"` on all four shells; one `<h1>` per marketing page via a `SectionHeading as` prop + Help FAQ slug de-slugged; light-theme contrast fixed by darkening `accent-400`/`accent-200` + `text-3` (both themes) and flipping the 4 solid accent-fill labels to `text-bg`; **27 `<Link><Button>` de-nested** via a new `buttonClassName()` helper (kills invalid `<a><button>`); footer links/contact ≥24px targets; chat list `role=log`/`aria-live`; `Alert` danger tone → `role=alert`; `Dialog` now traps focus + restores it on close + `aria-describedby`; `Segmented` is a proper radiogroup (roving tabindex + arrows); admin gains a mobile nav drawer (was `hidden md:flex` with no fallback).
  - **C-3 performance:** recharts moved behind `next/dynamic({ssr:false})` (out of the initial admin chunk); `useTrade`/`useMessages` stop polling once a trade is terminal; mono font `preload:false`. force-dynamic left in place — the cookie-based theme/locale in the root layout forces dynamic regardless, so static marketing needs an i18n refactor (out of this batch).
  - **C-4 media:** OG + Twitter images resized to the ~1200px social spec (1.5MB→~0.9MB) + metadata dims corrected; PWA manifest gained 192/512/**maskable-512** icons (was a generic "App" stub with no 512); Avatar falls back to a locally-drawn seeded initials disc if DiceBear is unreachable; brand mark already a real image.
  - **C-5 hygiene:** removed 7 verified-unused deps (backend `bullmq`, `passport`, `passport-jwt`, `@nestjs/passport`, `@fastify/static`; frontend `socket.io-client`, own `decimal.js`) + `pnpm install` re-synced the lockfile (−38 pkgs); deleted 4 dead exports (`msToDeadline`, `INDICATIVE_XAF_PER_USDT`, `isUnauthorized`, `subscribeAuth` + its dead listener set); `formatRate` grouped as a string (no `Number()` on money); BullMQ docstrings corrected to `@nestjs/schedule`. **Deferred (noted, not blocking):** money-display helper consolidation + `noUncheckedIndexedAccess` (large), shared-package ESLint setup, backend global exception filter (Nest default is already safe; a custom one would change the error envelope the FE parses — revisit deliberately), broaden money-`Number()` ESLint ban → **2.D** (money-path tooling).
  - **C-6:** status page fully localized (new `status` i18n namespace, `generateMetadata`).
  - **2.C verification:** frontend + backend build/typecheck + lint clean, shared 7/7, backend money-path gate 153/153, en/fr parity (1395 keys), all public/auth/admin routes 200.
- 2026-07-05 (batch 2.D — money-config editability slice, tests-first, working tree/no commits): the deferred fee/cap-editing + ledger-adjustment + Number-ban slice, driven by an understanding-workflow that surfaced **14 divergences (D1–D14)** and the user's 4 scope decisions. Adversarially reviewed (4 attackers → verify) → **8 confirmed findings, all fixed**.
  - **B27 dual-approval reconciliation (D1/D11):** migration `0017` drops the hardcoded `big_needs_two` CHECK (literal 500000000) and installs `trg_withdrawal_dual_approval`, a BEFORE INSERT/UPDATE trigger that reads the **live** `settings.dual_approval_threshold`, fires only on ENTRY to the approved/settling set (lowering the threshold can't strand in-flight withdrawals), and requires `approved_by IS NOT NULL AND second_approver IS NOT NULL AND second_approver <> approved_by` at/above the threshold. `approve()` now reads the threshold **live in-txn** (`SettingsService.withdrawalCapsIn`) so app + trigger never diverge across cached instances (adversarial finding #7). `down()` restores the CHECK as `NOT VALID` (finding #2). **Verified 9/9 branches against real Postgres** + reversible + a new integration regression test (raise→700M lets one admin approve in the new band).
  - **Fee hardening (D2/D3/D13):** `MAX_FEE_BPS = 9999` shared constant threaded through the write schema (`zFeeBpsValue`, full-11-rail snapshot from `PAYMENT_METHODS` — can't drop a rail), the read schema, and `computeFee` (a 100% fee would brick the trades `fee_amount < amount` CHECK). `fees.ts` stays **100% branch-covered**.
  - **Caps hardening (D4/D10 + adversarial #1, HIGH):** `zWithdrawalCapsValue` ordering invariant (`auto ≤ dual ≤ per_tx ≤ daily`, `per_tx > 0`) BigInt-compared, **bounded to ≤30 digits AND ≤ int8 max** — the review caught that my first cut used the *unbounded* `zAmount`, so an admin could PATCH a 31-digit cap that passed the write but threw on every read, bricking the whole withdrawal subsystem (and a >int8 threshold would overflow the trigger's `::bigint` cast). Read-side tightened to match.
  - **Ledger-adjustment (D7/D8/D14):** promoted `zLedgerAdjustmentRequest` to `shared/` (+ typed `adminLedgerAdjustment` client + 9 shared contract tests; fixed a latent throw-on-malformed-amount in the process). New SUPER-only `/admin/ledger-adjustment` page: exact-email lookup (review finding #5 — no silent `items[0]` wrong-target), balance preview, typed echo-confirm, TOTP, and an idempotency key **pinned to the intent** (finding #4 — no double-post on a Cancel→re-Review after a false-negative). Backend money path (`ledgerAdjustment`/`postJournal`) untouched.
  - **Money-`Number()` ESLint (D9 + findings #2/#6):** broadened to settings/admin folders + member-expression selectors, backend **and** frontend — including the snake_case cap fields the caps editor actually uses (the first cut missed them). Verified it catches planted violations.
  - **Comment cleanup (D5/D6):** removed the stale "display-only / phantom DB-CHECK backstop" comments across `settings.service`, shared `admin.ts`, `withdrawals.service`, migration 0006.
  - **2.D-slice verification:** shared 16/16 · backend build+lint clean · backend unit **167/167** · `fees.ts` 100% coverage · FE typecheck+lint clean · en/fr parity (1437 keys) · migration 0017 up/down reversible · all admin/public routes 200. **Integration + coverage gate is CI-only (no Docker locally)** — compensated with 9/9 direct-SQL trigger verification and updated integration specs.
- **Next (remaining original 2.D hardening — NOT this session):** B11 openTrade idempotency · B12 deposit exactly-once · B10 session revocation · B27 AML-re-screen half · E1 per-asset journal trigger · DOS verifyChain streaming/reconciliation · 2FA TOTP single-use + atomic PIN · B28 EXIF/AV/retention · CRY crypto consolidation. These stay ⬜ and are a separate batch.
