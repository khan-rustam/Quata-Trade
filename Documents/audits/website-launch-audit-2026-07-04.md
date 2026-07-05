# QuataTrade Public Website — Launch Audit (Phase 1)

**Audit date:** 2026-07-04 · **Auditor:** independent launch audit (engineering, UX, product, SEO, accessibility, performance, security, fintech/P2P, compliance, CRO)
**Scope:** every publicly accessible page of https://quatatrade.com (17 listed + `/legal/refunds`, `/login`, `/register` discovered live), audited against `PROJECT-OVERVIEW.md` and the `Documents/` spec.
**Method:** live crawl (raw HTML, headers, sitemap/robots), scripted real-browser passes (Chromium — desktop 1440px, mobile 390px and 320px, dark + light themes, EN + FR locales, keyboard navigation), asset-level performance measurement (brotli/uncompressed weights, TTFB × 11 runs, cache/revalidation behavior), and full-text legal review of all nine legal documents.

---

## 1. Executive Summary

**Overall launch readiness: 58 / 100 — DO NOT LAUNCH to real users yet.** The website is a genuinely well-designed, well-engineered marketing site wearing an unfinished trust layer. The design system is coherent and professional, the escrow story is told better than most competitors tell theirs, mobile rendering is flawless down to 320px, and the French translation of the marketing UI is complete. But the site currently **shows its own scaffolding to the public**: literal `[[placeholder]]` tokens on the Contact page, "To supply:" boxes on About and the Imprint, a "To write:" note on Help, and an amber **"Draft — pending legal review… must not ship to production"** banner on all ten legal pages. Social sharing is broken sitewide (`og:image` points to `http://localhost:3800`), there is no HSTS on the main domain, no structured data, no `<h1>` on 7 of 8 marketing pages, and the company has no stated legal identity anywhere on the site.

None of the visual/UX work is wasted — the foundation is strong. The gap between "looks launched" and "is launchable" is almost entirely: **(a) unfilled operator/legal content, (b) production-config mistakes, (c) SEO/accessibility structural fixes, (d) French legal localization.** Items (b) and (c) are hours of engineering. Items (a) and (d) are business/legal decisions the code is literally waiting for — every placeholder is a well-marked slot.

The verdict matches the repo's own launch-readiness report: excellent testnet-demo quality; not yet permitted or safe to take real customers.

### Scorecard

| Dimension | Score | One-line reason |
|---|---|---|
| UI | **85%** (8.5/10) | Coherent token-driven design system, both themes, polished cards/motion; minor: generic logo mark, empty band on homepage |
| UX | **74%** (7.4/10) | Clear IA, breadcrumbs, strong flows; Help has categories but no articles; status page is static; language toggle easy to miss |
| Homepage 10-second test | **82%** | What/who/how-escrow/local-methods all land in the hero; trust erodes only when placeholders are found deeper |
| Copywriting | **72%** | Plain-language, honest, on-brand; raw slugs as headings on Help, internal notes leaking, "no hidden fees" absolutism |
| Trust signals | **35%** | No legal identity, no team, no social proof, no external presence, drafts visible — the weakest area after Legal |
| International readiness | **45%** | FR marketing UI ✓, FR metadata ✗, FR legal ✗, no hreflang; fine for CM-only by design, not yet for Ghana/Nigeria |
| SEO | **40%** | Titles/descriptions exist; broken OG images, no canonicals, no schema, no h1s, no hreflang, title duplication |
| Accessibility (WCAG 2.2 AA) | **62%** | Focus visible, contrast strong, zero overflow, lang switches; missing `<main>`/skip link/h1s, 17px footer targets |
| Performance | **60%** | Superb caching/splitting/compression; ~1.03 MB uncompressed JS to hydrate + no-store HTML + 172 KB fonts = INP/LCP risk on Cameroon devices |
| Responsiveness | **88%** | No horizontal overflow at 320/390/1440, clean stacking, sensible mobile hero |
| Security messaging | **80%** | Security page is honest and specific (escrow, 2FA, cold storage, isolated signing, audit trail) — rare and good |
| Security headers (web) | **45%** | API exemplary; web origin missing HSTS + CSP, leaks `x-powered-by` |
| Legal | **15%** | All 10 docs are self-declared drafts; imprint empty; liability/governing-law/DPO/SLAs unfilled; English-only |
| Conversion | **70%** | Strong hero CTAs and fee transparency; no social proof, no live rates, no risk-reversal moment before signup |
| **Overall launch readiness** | **58%** | Blocked by trust/legal/config criticals, not by design or engineering quality |

---

## 2. Critical Issues — MUST fix before launch

**C1. Placeholder and internal-note content is publicly visible.**
- Contact page renders literal `[[support hours, e.g. Mon–Sat 8am–8pm WAT]]`, `Typical first response: [[response time]].` and `[[legal@quatatrade.com]]`.
- About renders a dashed box: *"To supply: company mission, founding story, team or leadership details…"*.
- Help renders *"To write: ~30 short articles across these categories for launch…"*.
- Imprint is seven consecutive "To supply:" rows (company name, RCCM, NIU, address, representative, contact, license).
- Status page renders the implementation note *"This page can be connected to a live monitoring service (e.g. Uptime Kuma)…"*.
- **Why it matters:** a money platform asking users to deposit funds while its Contact page shows template tokens reads as abandoned or fraudulent. This single class of issue can undo everything the design earns.
- **User impact:** immediate distrust at the exact moment (contact/legal pages) users go to verify legitimacy. **Business impact:** lost signups; screenshot fodder; regulator-visible sloppiness.
- **Fix:** supply the real values (support hours, legal@ mailbox, office address) or remove the slots entirely until known; gate any "To supply/To write" render behind a non-production flag so drafts can never ship. **Priority: Critical.**

**C2. Social sharing is broken sitewide — `og:image`/`twitter:image` point to `http://localhost:3800/assets/og-image.png`.**
Every page shares this value; the URL is unreachable from the internet, so WhatsApp/Facebook/X previews show no image (and `og:url` is absent, canonical absent — crawlers pick arbitrary URLs). WhatsApp is *the* sharing channel in Cameroon; a broken preview is a direct growth leak. Root cause is metadata `metadataBase` not picking up `NEXT_PUBLIC_SITE_URL` in production. Note the source images themselves are ~1.44 MB PNGs — fix the URL **and** compress to <200 KB at 1200×630. **Priority: Critical.**

**C3. All ten legal documents are drafts that self-declare "must not ship to production."**
Confirmed live on every `/legal/*` page: amber banner, "Version 0.1 (draft)", mint placeholders. Substantive gaps: Terms §8 liability/warranty/indemnity is an empty placeholder; Terms §9 governing law/venue unfilled (`[[city]] / [[rules]]`); Privacy lacks DPO, confirmed retention schedule, processor list, supervisory-authority route (all required under the cited Law 2024/017); AML lacks tier limits, compliance officer, reporting obligations; no dispute SLA anywhere; no external escalation body; the 500 USDT dual-approval control appears nowhere. **Fix:** lawyer-review and fill (the slots are well-designed for exactly this), remove banner, version the text, then translate to French. **Priority: Critical — hard launch blocker.**

**C4. No company identity anywhere on the site.**
Footer says only "© 2026 QuataTrade. Cameroon." — no entity name, RCCM/NIU, address, or representative on Imprint, Contact ("Douala, Cameroon" with no street address), or Terms ("operated by `legal company name`"). For a custodial crypto platform this is both a legal defect and the #1 trust question a cautious user asks. **Priority: Critical (depends on client supplying entity details — flag as external dependency).**

**C5. No HSTS and no CSP on `quatatrade.com` and `cdn.quatatrade.com`.**
Only `api.quatatrade.com` sends `strict-transport-security` and a CSP. The user-facing origin — where login/register forms live — can be SSL-stripped on first visit and has no CSP against injected scripts. Also leaking `x-powered-by: Next.js` and sending the deprecated `x-xss-protection`. **Fix at the nginx edge:** add `Strict-Transport-Security: max-age=31536000; includeSubDomains` to apex/www/cdn (then consider preload), add a CSP (even report-only initially), strip `x-powered-by`. Hours of work. **Priority: Critical (cheap, high-severity).**

**C6. French is missing where it is binding, and metadata never translates.**
The marketing UI translates beautifully (`lang="fr"` is set, "De la crypto au cash. Protégé."), but: `<title>`/descriptions stay English in FR mode; **all legal pages remain English under the FR locale**; there is no hreflang. Cameroon is majority-Francophone, and the site's own legal banner says it must not ship until "reviewed and localized (EN + FR)". **Fix:** FR legal content (repo already has the seam planned in `lib/legal-content.ts`), localized `generateMetadata`, hreflang alternates. **Priority: Critical for the legal pages, High for metadata.**

---

## 3. High-Priority Issues — fix during launch window

**H1. Heading structure is broken for SEO and screen readers.** Only the homepage and legal pages have an `<h1>`; About/How-it-works/Fees/Security/Help/Contact/Status open with an `<h2>`. The Help FAQ group headings render raw i18n keys (`getting-started`, `trading`, `payments`…) as visible uppercase text — a live copy bug. Fix: promote each page's hero heading to `h1`, map slugs to labels ("Getting started"). *(SEO + a11y, ~half a day.)*

**H2. Zero structured data and no canonicals.** No JSON-LD anywhere, no `<link rel="canonical">`, per-page OG title/description identical to the homepage's. Add: `Organization` (once identity exists) + `WebSite` on `/`, `FAQPage` on `/help`, `BreadcrumbList` on subpages; canonical per page; per-page OG; fix title template duplication ("About — QuataTrade · QuataTrade" → "About · QuataTrade"). *(This is most of the SEO score gap.)*

**H3. The Status page is hardcoded "All systems operational."** Six components all show a static "Operational" badge regardless of reality. During any real incident this page will lie, which is worse than not having one. Either wire it to the health endpoints/Uptime Kuma before launch or label it "manually updated" with a timestamp. *(Trust-critical for a money platform.)*

**H4. JavaScript hydration cost threatens Core Web Vitals on the launch market's devices.** Measured: 311 KB brotli / **1.03 MB uncompressed JS** (largest chunk 222 KB raw), HTML is 144 KB of which **69% is inline RSC flight payload**, served `no-store` (zero HTML caching — every visit pays 0.6–0.85 s origin TTFB + full render; Cameroon adds RTT). Fonts: 5 preloaded woff2 totaling **172 KB** (one 85 KB). Estimated CWV on mid-range Android: CLS pass, LCP borderline-fail on 3G, **INP/TBT at real risk**. Fixes in order of leverage: make public pages statically cacheable (the cookie-driven `force-dynamic` root layout is the root cause — scope dynamic rendering to the app shell, or move theme/locale to client-side application on public routes), trim the 222 KB chunk, cut font preloads to the 2–3 weights actually used above the fold, self-host the DiceBear avatars (63 KB of preloaded third-party SVG on the critical path). *(Performance engineer, 1–3 days.)*

**H5. WCAG 2.2 structural failures.** No `<main>` landmark on any page (violates 1.3.1/2.4.1), no skip-to-content link, footer links measure 17 px tall on mobile (below the 24 px minimum of 2.5.8; increase line-height/padding), duplicated "Log in" tab stop in the header (an `<a>` and a `<button>` back-to-back). Focus outlines, contrast (15.7:1 headings), and `lang` switching are already good — these fixes complete the picture. *(Front-end, ~1 day.)*

**H6. Help Center has categories but no articles.** Eight polished category cards lead nowhere; the FAQ below covers a starting set. The internal note says ~30 articles are planned. For a P2P platform, "how do I not get scammed" content *is* the product's trust surface. Write at minimum: first trade walkthrough (buy + sell), payment-proof rules, dispute guide, KYC document guide, withdrawal/2FA setup. *(Content, can land during launch week.)*

**H7. `/legal/refunds` is live but orphaned.** It's in the sitemap and renders (draft, like the others) but the footer Legal column doesn't link it. Either link it or noindex/remove until ready. Also add `og:url`, and consider whether `/login`/`/register` belong in the sitemap (harmless, but they're utility pages).

---

## 4. Medium-Priority Improvements

**M1. Language discoverability.** The toggle is a small "EN" glyph in the header; a Francophone first-time visitor may never notice the site speaks French. Consider an `Accept-Language`-based first-visit default (or a one-time prompt), and render the toggle as "EN | FR".
**M2. Trust signals below the identity layer.** No social/WhatsApp/Telegram presence, no testimonials, no volume stats, no press, no team page. In African P2P (Yellow Card, Busha, Binance P2P playbooks), a WhatsApp support channel and visible local presence materially move conversion. Add as soon as channels exist; do not fabricate stats.
**M3. Fees page: add an XAF-denominated worked example** (users think in XAF, the example is USDT-only), and a one-line note that network fees on withdrawal are shown before confirmation (it exists as a bullet — consider surfacing the typical TRC-20 fee).
**M4. Cookie policy names no cookies.** List `qt_locale`, `qt_theme`, and the refresh-token cookie by name/purpose/lifetime; confirm "no analytics" stays true at launch (currently true — zero third-party scripts measured).
**M5. Contact form UX.** Support email + anti-phishing warning are good; add expected response time (once defined), and consider WhatsApp (dominant support channel in the market). The `[[…]]` tokens are covered in C1.
**M6. Image pipeline.** Next optimizer serves webp but not avif; optimized-image cache is 4 h `must-revalidate` (default) — fine, but enable avif and consider longer TTLs; `icon.png`/`apple-icon.png` are 36–39 KB (compressible to ~10 KB).
**M7. Homepage layout polish.** An empty dark band (~90 px) sits between the "Safety in every trade" cards and the final CTA section; the animated "How a trade stays safe" stepper card shows only step 3 statically in some paints — verify the animation cycles from step 1 on load.
**M8. Default theme vs OS preference.** Dark is forced as default regardless of `prefers-color-scheme: light`. Respect the OS on first visit (server snapshot can read the cookie only after first toggle; use the media query as initial hint).
**M9. Breadcrumbs exist visually — add `BreadcrumbList` schema and `aria-label="Breadcrumb"` nav semantics** (currently a plain div per the landmark scan).
**M10. `www` → apex 301 works; also ensure the 301 preserves paths and add it to HSTS scope when C5 lands.**

---

## 5. Nice-to-Have Improvements

- **N1.** Signature motion moment: the brand spec's "keyhole closes on escrow lock" animation on the hero card would differentiate; current lock card is static.
- **N2.** Live indicative XAF/USDT rate on the homepage/markets teaser once the rate service ships ("Markets — soon" is honest but a live number sells liquidity).
- **N3.** Status history/incident log (last 90 days) once monitoring is wired.
- **N4.** `security.txt` (RFC 9116) + a responsible-disclosure note on /security — cheap credibility with the security community.
- **N5.** Font subsetting (latin subset already via next/font; audit whether both display weights are needed at first paint).
- **N6.** Preconnect hints for `api.quatatrade.com` on login/register.
- **N7.** PWA polish: manifest exists; add maskable icons and theme-color per scheme.
- **N8.** Print stylesheet for legal pages (users print/PDF terms in low-trust markets).

---

## 6. Page-by-Page Audit

For each page: verdict, then notable findings. Common to **all** pages: shared header/footer (consistent), breadcrumbs on subpages, dark/light both clean, FR translates marketing strings, no console errors, no horizontal overflow at 320/390/1440, no `<main>`, no skip link, no canonical/schema, broken OG image, TTFB 0.6–0.85 s.

| # | Page | Verdict | Key findings |
|---|---|---|---|
| 1 | **/** Homepage | **Strong (8.5/10)** — best page on the site | Hero passes the 10-second test: what (P2P USDT), where (Cameroon), how (escrow lock visual + 3 steps), pay-with chips (MTN MoMo/Orange/QuataPay), dual CTA ("Start trading" / "How it works"), trust ticks. Illustrative offer cards with African names, XAF rates, completion stats — clearly labeled *"Illustrative examples — real offers appear once you sign in"* (honest; consider live data at launch). Only page with an `<h1>`. Empty band before final CTA (M7). 3,294 px tall — good length. |
| 2 | **/about** | **Weak (5/10)** | Good headline ("Crypto to cash, built for Central Africa") and honest positioning; then a public *"To supply: company mission, founding story, team…"* box (C1) and brand-internal value names (Protected/Direct/Fresh) doing the work a story should. No h1. Thinnest marketing page; competitors' About pages carry licenses, team, registration. |
| 3 | **/how-it-works** | **Good (8/10)** | Buyer flow (4 numbered steps) + seller flow + "why escrow matters" — clear, jargon-free, matches the spec's canonical trade flow exactly (lock → pay off-platform → proof → confirm → release − fee). No h1; add FAQPage/HowTo schema candidate. |
| 4 | **/fees** | **Very good (8.5/10)** | Table (QuataPay 0.30%, MTN MoMo 0.50%, Orange 0.50%) matches shared constants exactly; worked example (100 → 99.50 USDT); four no-fee bullets incl. cancelled-trade and network-fee honesty. "No hidden charges, ever" is an absolutist claim legal should bless (Terms repeats it). Add XAF example (M3). No h1. |
| 5 | **/security** | **Very good (8.5/10)** | Six cards that map 1:1 to real architecture (escrow, 2FA+PIN, cold storage, isolated signing, verified identities, tamper-evident audit) — accurate to the spec, plain-language, no security theater. This page out-communicates most competitors. Add: responsible-disclosure contact, and (when true) pen-test/audit statements. No h1. |
| 6 | **/help** | **Fair (6/10)** | 8 category cards (good IA) but no articles behind them; public *"To write:"* note (C1); FAQ group headings render raw slugs (H1 fix); FAQ content itself is solid. FAQPage schema missing. No h1. |
| 7 | **/contact** | **Broken trust (4/10)** | Good: support email card, anti-phishing warning ("staff will never ask for your password/PIN/2FA"), dispute-vs-support routing, working form (name/email/subject/message). Fatal: `[[support hours…]]`, `[[response time]]`, `[[legal@quatatrade.com]]` rendered literally (C1); office = "Douala, Cameroon" with no address (C4). |
| 8 | **/status** | **Fair (5.5/10)** | Clean six-component layout (Website & API, Trading & escrow, Deposits, Withdrawals, Payments, Notifications) — but every badge is hardcoded "Operational" (H3) and an internal Uptime-Kuma note is public (C1). No incident history. |
| 9 | **/legal/terms** | **Draft (3/10)** | Well-structured 10 sections; fee numbers consistent; 18+ eligibility; termination rights. Unfilled: operator identity, license status, §8 liability (whole section), §9 governing law/venue (`[[city]]/[[rules]]`). Draft banner. English-only even in FR mode. |
| 10 | **/legal/privacy** | **Draft (3.5/10)** | Cites Law 2024/017; argon2id and "no KYC as AI training data / no automated approval" statements are excellent. Missing: controller identity, DPO, confirmed retention (5y default flagged unconfirmed), processor list, cross-border safeguards, rights procedure. |
| 11 | **/legal/aml** | **Draft (3/10)** | Tier structure + sanctions screening + deterministic monitoring described; missing tier limits, compliance officer, reporting obligations, retention. 500-USDT dual-approval control absent (gap vs product). Shortest-but-one page (~200 words). |
| 12 | **/legal/risk** | **Draft-but-decent (5/10)** | Volatility, irreversibility ("a screenshot is not proof of payment" — good line), not-a-bank. Missing: explicit "not deposit-insured", CEMAC/COBAC regulatory notice (§6 placeholder — nowhere on the site do "CEMAC"/"COBAC" appear). |
| 13 | **/legal/trade-rules** | **Draft-but-decent (5/10)** | Full escrow lifecycle matching the real FSM; 30-min window; proof requirements; auto-cancel; freeze-on-dispute. Missing: dispute SLA (72 h placeholder), fraud-consequences section. |
| 14 | **/legal/prohibited-use** | **Nearly complete (6.5/10)** | Only legal page with no "To supply" markers. Covers sanctions evasion, fraud/ML, multi-accounts, third-party payments, dispute/escrow abuse; discloses kill switches. Needs the draft banner removed post-review only. |
| 15 | **/legal/cookies** | **Nearly complete (5.5/10)** | Honest (essential-only, no ad/tracking cookies — verified true: zero third-party scripts). Doesn't name `qt_locale`/`qt_theme`/refresh cookie (M4). ~59 words — thin but arguably appropriately so. |
| 16 | **/legal/imprint** | **Empty (1/10)** | Seven "To supply:" rows; zero real data. The single most damaging page on the site today (C4). |
| 17 | **/legal/complaints** | **Draft (3/10)** | Dispute-vs-support routing present; no SLA, no escalation body/regulator, contact line is a placeholder. |
| — | **/legal/refunds** (undocumented) | Draft, orphaned | Live + in sitemap, not linked in footer (H7). |
| — | **/login, /register** | Not deep-audited (app shell) | Both 200, linked from header CTAs, in sitemap; register is the conversion target of every CTA. Recommend a dedicated follow-up audit of the auth + KYC funnel (out of scope here). |
| — | **404** | Correct | Unknown paths return HTTP 404 with a branded not-found page. |

---

## 7. Category Reviews

### 7.1 UI — 8.5/10
Token-driven consistency (brand teals `#0E5F55→#2FD4A7`, dedicated escrow color, Space Grotesk/Inter/IBM Plex Mono with tabular numerals for money), correct dark **and** light themes with server-side cookie read (no flash), consistent card/badge/button system, breadcrumbs, hover and focus states present, subtle non-blocking animation honoring `prefers-reduced-motion`. Deductions: the logo mark (gradient Q with candlestick bars) reads more generic-crypto than the spec'd "Q-as-key/keyhole" concept and renders small detail muddily at 24 px; one empty band on the homepage; the stepper card's static "Step 3 of 3" paint; grayed "soon" items (Markets/Blog/Careers) are honest but three of them in one footer reads unfinished.

### 7.2 UX — 7.4/10
IA is flat and learnable (5 top-nav items + footer taxonomy), click depth ≤2 to any content, dispute-vs-support routing is thoughtful, and both buying and selling flows are explained separately (rare — most competitors explain only buying). Weaknesses: Help categories dead-end (H6); status page static (H3); language toggle discoverability (M1); no in-page anchors/TOC on long legal pages; no search on Help. First-time-visitor comprehension is genuinely excellent until the trust layer (Contact/About/Imprint) is reached.

### 7.3 Homepage 10-second test — PASS (with one gap)
Within one viewport a first-time visitor learns: it's P2P USDT↔cash for Cameroon, with MTN MoMo/Orange/QuataPay, protected by escrow ("every trade locked in escrow until you're paid"), with verified traders and human dispute review, and 150.00 USDT sits visually "protected in escrow". Local payment methods are unmistakable. **Missing messaging:** who is behind it (no identity), whether it's live/regulated, and any social proof (user counts, testimonials, volume). "Why should I trust it" is answered mechanically (escrow) but not institutionally (who are you?).

### 7.4 Copywriting — 7.2/10
Tone is confident, plain, and matches the brand's "Protected. Direct. Fresh." voice; banned-copy rules (no "get rich"/"moon") are respected; French marketing copy is idiomatic ("séquestre" is the correct legal term). Issues: raw slug headings on Help (H1); internal notes public (C1); absolutist claims ("No hidden charges, ever", tagline "Protected." unqualified — Risk page correctly limits escrow to the crypto leg; add one qualifying line near the tagline's first use); "Crypto to cash, built for Central Africa" vs Cameroon-only gating may confuse Gabonese/Chadian visitors who then can't register (say "starting with Cameroon"); minor: "QuataPay" internal wallet is used before it's ever defined for a new visitor — one parenthetical would fix it.

### 7.5 Trust — 3.5/10
Present: fee transparency, honest security page, anti-phishing warning, dispute process, essential-only cookies, no dark patterns. Absent: legal identity (C4), support hours/SLA, team/founding story, regulatory posture (no CEMAC/COBAC mention anywhere), external presence (zero external links on the entire site — no WhatsApp/Telegram/X/LinkedIn), testimonials/stats, security attestations. **Additional signals to add:** imprint completion, "Registered in Cameroon — RCCM …" footer line, WhatsApp business channel, launch announcement/press, uptime history, responsible-disclosure page, and (later) proof-of-reserves or third-party audit statements — the strongest trust lever available to a custodial platform.

### 7.6 International launch readiness — 4.5/10
Deliberately Cameroon-first (spec: 26 markets seeded, CM enabled) — the site correctly avoids over-promising. For the stated future (Ghana, Nigeria, international): FR body ✓ / FR metadata ✗ / FR legal ✗ / hreflang ✗; currency display is XAF-hardcoded in homepage examples (the app itself is currency-aware per market — the marketing site isn't yet); no country selector or "available in" block; timezone reference "WAT" appears only inside a placeholder. English copy is idiomatically international; the design is globally credible. Verdict: ready to *say* "Cameroon only", not yet ready to *be* multi-country on the public site — acceptable for Phase 1 provided C6 (French) is fixed, since French is a **domestic** need, not an international one.

### 7.7 SEO — 4/10
Working: unique titles/descriptions per page, robots.txt correctly disallowing app routes, complete sitemap, proper 404s, 301s for www/http, brotli, mobile-friendly, `lang` attribute switching. Broken/missing: OG images → localhost (C2); no canonicals; no JSON-LD of any kind; identical sitewide og:title/description; no hreflang; no h1 on 7/8 pages (H1); title duplication ("X — QuataTrade · QuataTrade"); zero external links (no entity signals); no keyword-targeted landing pages ("Buy USDT in Cameroon", "USDT to XAF") — the queries the business must own; thin About; `x-powered-by` fingerprint. Anchor text is generally descriptive (no "click here" found).

### 7.8 Accessibility (WCAG 2.2 AA) — 6.2/10
Passing (measured): focus visible on all 10 first tab stops with logical order; heading contrast 15.7:1; secondary text ≈7:1; no keyboard traps in the header; all `<img>` have alt attributes (2 decorative empty-alt per page — correct pattern); `lang` correct in both locales; no motion without reduced-motion fallback; forms have visible labels + required markers. Violations: **no `<main>` landmark (1.3.1, 2.4.1)** and no skip link (2.4.1) on every page; **no h1** on 7 pages + slug headings (2.4.6); **footer/mobile links 17 px tall** (2.5.8 target size minimum, 24 px); duplicated adjacent "Log in" link+button (2.4.4 clarity); breadcrumb nav not labeled as such. Not yet verified (recommend manual pass): screen-reader announcement of the theme/language toggles, dialog focus management in the app shell, and the contact form's error announcements.

### 7.9 Performance — 6/10
Measured strengths: brotli everywhere (HTML 144 KB → 26 KB), HTTP/2 + h3 advertised, one CSS file (9 KB br), immutable 1-year caching + working 304s on all static assets, excellent code-splitting (zero page-specific chunk bloat; subpages share the homepage's chunks), no analytics/third-party scripts, CLS-safe images, no hero raster. Measured risks: **1.03 MB uncompressed JS** (222 KB single largest chunk) to parse/hydrate on low-end Android; HTML `no-store` (dynamic SSR for cookies) so every navigation pays 0.6–0.85 s TTFB with no CDN/browser reuse — from Cameroon, add real RTT; **69% of the HTML is inline RSC payload**; **5 preloaded fonts = 172 KB**; 3 preloaded third-party DiceBear SVGs (63 KB) on the critical path; og-image 1.44 MB (C2). CWV forecast: CLS pass / LCP borderline (fails 3G) / **INP-TBT the main risk**. See H4 for the fix order — the single highest-leverage change is making public pages cacheable.

### 7.10 Responsiveness — 8.8/10
Zero horizontal overflow at 320, 390, 1440 (measured `scrollWidth` deltas = 0); mobile hero stacks correctly with full-width CTAs; tables (fees) fit mobile; hamburger menu present; typography scales (60 px → ~44 px H1); touch targets in header/nav adequate — only footer link rows are under-height (H5). Not tested on physical devices/ultra-wide (>1920) — recommend a quick manual pass; nothing in the layout system suggests risk.

### 7.11 Security messaging — 8/10
Users are told, accurately: escrow mechanics (3 places, consistent), 2FA + separate transaction PIN, cold storage with capped hot float, isolated signing ("a compromised website cannot drain funds" — bold, accurate, and differentiating), manual human KYC, deterministic risk checks, append-only hash-chained audit, anti-phishing warning, "screenshot is not proof". Gaps: no guidance moment on *what escrow does NOT protect* (the fiat leg — buried in Risk); no dedicated fraud-prevention guide (H6); no vulnerability-disclosure channel (N4); 2FA is described but not whether it's required (it's required for withdrawals — say so, it's a selling point).

### 7.12 Legal — 1.5/10 (as shipped today)
Covered fully in C3/C6 and §6 rows 9–17. Summary: structure and product-accuracy are excellent (fees, window, KYC, escrow all match the real system — no internal contradictions found); substance (identity, liability, jurisdiction, SLAs, regulator, retention, officer names) is systematically absent and self-flagged; consumer-protection language (cooling-off, deposit-insurance disclaimer, external escalation) missing; English-only. The drafting quality means a lawyer can complete these quickly — but nothing here is enforceable today, and the banner says so publicly.

### 7.13 Conversion — 7/10
Strong: single unambiguous primary CTA ("Get started"/"Start trading") repeated at hero, mid-page, and final section; secondary CTA routes to education ("How it works"); fee transparency pre-signup; illustrative offers preview the marketplace; low cognitive load. Friction/leaks: no social proof anywhere (the single biggest conversion gap); no live rates or liquidity signal ("Markets — soon"); no risk-reversal microcopy at the CTA ("Free account · No deposit required · KYC in minutes"); registration motivation relies entirely on safety messaging; broken WhatsApp share previews (C2) leak referral traffic; no capture path for not-ready visitors (no newsletter/community link). Recommendations in §12.

---

## 8. Missing Pages (content roadmap)

Priority-ordered for this market:
1. **Buy USDT in Cameroon / Sell USDT in Cameroon** (SEO landing pages; the money queries) — High
2. **P2P trading guide for beginners** (FR+EN) — High
3. **Fraud prevention / staying safe when trading P2P** — High (also a compliance asset)
4. **Help articles behind the 8 categories (~30 planned)** — High (H6)
5. **Why QuataTrade / Why escrow** (comparison-style explainer) — Medium
6. **Press/announcements page** — Medium (even one launch post)
7. **Status history / incidents** — Medium (with H3)
8. **Trust Center** (aggregating security/legal/compliance once real) — Medium
9. **Transparency report + proof-of-reserves** — Later, high trust value
10. **Roadmap, Community guidelines, API docs, Release notes** — Later (API docs only when a public API exists)
Footer already promises Blog/Careers ("soon") — ship the blog with 3–5 of the guides above rather than as a separate empty section.

## 9. Missing Trust Signals (consolidated)

Legal entity + RCCM/NIU in footer & imprint (C4) · support hours/SLA (C1) · WhatsApp/Telegram support channel · social profiles (even placeholders-free: only create what will be maintained) · testimonials or launch-partner logos · live platform stats when honest (trades completed, escrow released) · regulatory posture statement (CEMAC/COBAC position, per lawyer) · security attestations (pen-test summary, when done) · team/leadership on About · external press mentions · uptime history · responsible-disclosure page.

## 10. SEO Improvement Plan (sequenced)

1. **Day 1:** set `metadataBase` from `NEXT_PUBLIC_SITE_URL` (fix OG URLs), compress og-image/twitter-card to <200 KB, add `og:url`, per-page OG title/description, canonical on every page, fix title template duplication, remove `x-powered-by`.
2. **Week 1:** add h1s (H1), fix Help slugs, add JSON-LD (`WebSite` + `Organization` when identity exists, `FAQPage` on /help, `BreadcrumbList` sitewide), hreflang en/fr pairs (requires FR metadata), link or de-index `/legal/refunds`.
3. **Week 2–4:** ship the two "Buy/Sell USDT Cameroon" landing pages + 3 guides (FR+EN), expand About with real entity/story, internal-link them from home/help; submit sitemap in Search Console, monitor coverage.
4. **Ongoing:** blog cadence (1–2/mo), earn local backlinks (fintech press, community), watch CWV field data once traffic exists.

## 11. Accessibility Improvement Plan

1. Add `<main id="main">` on every layout + "Skip to content" link (first tab stop).
2. Promote hero headings to `<h1>`; fix Help slug headings; ensure one h1 per page.
3. Footer/mobile link target size ≥24 px (padding/line-height).
4. De-duplicate the header "Log in" link/button pair.
5. `aria-label="Breadcrumb"` + `aria-current="page"` on breadcrumbs; label the language/theme toggles with full names ("Language: English").
6. Manual screen-reader pass (VoiceOver + TalkBack) over homepage, contact form (error announcements), and the auth pages; then automated axe run in CI to hold the line.
7. Re-verify secondary-text contrast in **light** theme (dark theme measured ≥7:1; light theme not measured — the muted `#5E706C`-class tokens are the likely edge).

## 12. Performance Improvement Plan

1. **Make public pages cacheable** — the root `force-dynamic` (cookie-read for theme/locale) makes every marketing/legal page an SSR hit with `no-store`. Options: move public routes to their own layout with static rendering + client-side theme/locale application, or edge-cache HTML keyed on the two cookies. Expected: TTFB 0.7 s → <0.1 s cached; biggest single LCP win.
2. **Cut hydration cost:** analyze the 222 KB (raw) chunk (`next build --analyze`), lazy-load below-fold sections (offer cards, footer columns), keep marketing pages as close to server-only as possible (69% flight payload says much is client-rendered that needn't be).
3. **Fonts:** preload only above-the-fold weights (likely Space Grotesk 700 + Inter 400/500); drop the 85 KB face from preload; `font-display: swap` already via next/font.
4. **Self-host avatar SVGs** (remove DiceBear from critical path + third-party dependency + privacy win).
5. **Enable AVIF** in the image optimizer; compress `icon.png`/`apple-icon.png`; fix og-image size (with C2).
6. After 1–5, run Lighthouse mobile (throttled) + WebPageTest from a West-Africa node; target LCP <2.5 s on 4G, TBT <300 ms.

## 13. Conversion Optimization Recommendations

1. Fix C1/C2/C4 first — trust leaks dominate any CRO tweak (why: users verify before funding; impact: signup completion).
2. Add risk-reversal microcopy under primary CTAs: "Free account · No deposit needed to browse offers" (why: reduces perceived commitment; low effort).
3. Social proof block once honest data exists (completed trades, escrow released, avg. release time — the platform already computes these).
4. WhatsApp contact + share-optimized OG previews (C2) — WhatsApp is the referral engine in this market.
5. Register-page continuity: carry the escrow promise onto /register (the audit stopped at the door; ensure the first screen repeats "protected by escrow" and shows the 3-step KYC expectation).
6. FR auto-detection (M1) — a Francophone bouncing off an English hero is a silent conversion loss.
7. Later: exit-intent → "How escrow protects you" explainer; A/B the hero sub-headline (escrow-led vs. fee-led).

## 14. International Launch Recommendations

1. Fix French completely (C6): legal FR, metadata FR, hreflang — required for Cameroon itself.
2. Say "Starting with Cameroon — more markets soon" where "Central Africa" is implied, until CM-adjacent markets open.
3. When Ghana/Nigeria approach: per-market landing pages (payment rails + currency + phone prefix are already data-driven server-side), currency-aware marketing examples (NGN/GHS), local legal pages per market (the L1–L16 set will not transfer), local support channels, and a country selector in the footer.
4. Keep the no-third-party-scripts stance — it's a genuine differentiator for low-data users across the region.
5. Consider `.cm` ccTLD redirect ownership defensively; keep `.com` canonical.

---

## 15. Final Launch Readiness Scores

| Area | Score | Reasoning (condensed) |
|---|---|---|
| UI | **85%** | Professional, consistent, both themes, minor polish items (M7, logo) |
| UX | **74%** | Clear IA/flows; help content missing, status static, FR discoverability |
| SEO | **40%** | Solid titles/robots/sitemap undermined by broken OG, no canonicals/schema/h1s/hreflang |
| Accessibility | **62%** | Strong contrast/focus/responsive foundations; structural landmarks/headings/targets to fix (all cheap) |
| Trust | **35%** | Mechanics communicated well; identity, presence, and proof absent; placeholders visible |
| Security communication | **80%** | Accurate, specific, differentiating; add disclosure channel + "what escrow doesn't cover" |
| Branding | **80%** | Faithful token/type/voice execution; logo mark weakest element; strong African-market fit without clichés |
| Performance | **60%** | Excellent delivery hygiene; hydration weight + uncached SSR HTML on the target market's devices |
| Responsiveness | **88%** | Overflow-free 320→1440, correct stacking, one target-size defect |
| Legal | **15%** | Complete skeleton, zero enforceability: drafts, empty imprint, EN-only, self-flagged "must not ship" |
| Conversion | **70%** | Strong CTAs + transparency; no social proof, broken share previews |
| International readiness | **45%** | CM-first by design (fine); FR gaps are domestic-critical; multi-country site work not started (correctly) |
| **OVERALL LAUNCH READINESS** | **58%** | **No-go today.** Go for a *public-marketing/testnet* launch after C1/C2/C5 + H1–H3 (≈1 engineer-week + content). Go for *real-money* launch only after C3/C4/C6 (legal/identity/French — external dependencies) and the platform-side blockers already tracked in `Documents/launch-readiness/` (signer, pen-test, monitoring). |

### The one-week engineering punch list (everything code-fixable, ordered)
1. `metadataBase`/OG fix + compressed share images (C2) — 2 h
2. HSTS + CSP + header hygiene at nginx (C5) — 2 h
3. Gate all `To supply/To write/[[…]]` renders behind non-prod flag; supply known values (C1) — 0.5 d
4. `<main>` + skip link + h1s + Help slugs + footer target size + duplicate Log-in (H1/H5) — 1 d
5. Canonicals + per-page OG + JSON-LD + title template (H2) — 1 d
6. Status page: wire to health endpoint or mark manual (H3) — 0.5 d
7. Public-route static rendering / HTML caching + font-preload trim + self-hosted avatars (H4) — 1–2 d
Everything else (legal completion, French legal, identity, help articles) is content/legal work the codebase is already structured to receive.

---

*Audit artifacts: screenshots (desktop/mobile/light/FR) and measured data are in the session scratchpad; measurement methodology in §preamble. This report should be re-run after the punch list lands and again before the real-money go/no-go.*
