# Phase 3C — Frontend Deep Audit (React 19 / Next.js 16 App Router)

**Date:** 2026-07-05 · **Method:** parallel staff-frontend readers over the data layer, components/accessibility (WCAG 2.2 AA), performance/bundle (with a real production build), and forms/i18n/money-display; scored synthesis. All findings cite real paths/lines. Routing/rendering is covered here from Phase 1 (metadata/OG/canonical/hreflang/h1/force-dynamic) and 3A (client-component sprawl, error isolation, env validation) — one reader agent for that area returned a stub and its scope is folded in below.
**Verdict:** **GATE NOT PASSED — conditional, with a defined must-fix list.** A well-architected frontend with a genuinely disciplined contract core, held back from fintech-shippable state by a broken build, a cluster of money-adjacent correctness bugs, and a light-theme/accessibility layer that does not meet the stated WCAG 2.2 AA target. This is a fix-list, not a rewrite.

## Scores (calibrated against a production fintech frontend — money and trust on the line)

| Dimension | Score | One-line |
|---|---|---|
| **UI quality** | **60/100** | Real design-system craft; unfinished light theme + primitive-level defects |
| **Correctness** | **58/100** | Disciplined contract core undercut by money-adjacent cache/refresh bugs |
| **Accessibility** | **45/100** | Foundations exist but AA target not met — 3 blocking failures |
| **Performance** | **42/100** | Measured: ~704 KB gzip JS, zero static prerender, zero code splitting |

Severity tally: **12 High · 21 Medium · 18 Low · 3 Info.**

## What is strong and must be preserved

The FE/BE contract core is the best part of the codebase: one typed client that **zod-parses every response**, an in-memory access token with a **de-duplicated httpOnly refresh**, a separate admin client, and a **"no optimistic money mutations" policy that is actually upheld** (the single `setQueryData` is on a non-money path and writes the server response). **Money display is disciplined end-to-end** — amounts stay in bigint smallest-units through the shared Money helpers, and trade-path fiat totals come from the server, not client `amount×price` math. `en.json`/`fr.json` have exact key parity (1287 keys, 0 missing either way). The `Field` wrapper gives forms correct `label`/`aria-invalid`/`aria-describedby` wiring; motion honors `prefers-reduced-motion`; there's a global `:focus-visible` ring and `min-h-11` targets.

## HIGH findings (12) — the must-fix cluster

**Release blocker**
- **C-H1 · Production build is broken from a clean checkout.** `amount.tsx` imports `formatFiat` from `@quatatrade/shared`, but the committed `shared/dist` only exported `formatXAF` until rebuilt — a fresh `next build` fails hard (`Export formatFiat doesn't exist`). Nothing ships until `shared` is rebuilt first. **Directly corroborates 3A's "shared not built on install / stale dist" finding** — this is that latent bug already biting. Fix: enforce shared-build-first in CI (root `build` does this; other entrypoints don't) or consume shared via TS project references.

**Money-adjacent correctness**
- **C-H2 · Wallet balances cache is never invalidated after any money movement.** `qk.balances` appears exactly once (its query def) and is never invalidated — after withdrawal/transfer/escrow-release/cancel, the code invalidates only address/trade queries. Within the 30s stale window the user sees the **old balance**, may believe locked funds are available, and attempt a second withdrawal. Root cause: all wallet/escrow mutations run **inline in pages**, not through hooks (the 3A/Phase-1 "hooks-layer bypass" finding, quantified). Fix: route through hooks that invalidate `qk.balances`.
- **C-H3 · The 401 handler refreshes the token but never replays the request.** `request()` awaits `onUnauthorized()` (which refreshes) then falls through and throws on the original 401. With `mutations.retry:0` and money mutations being raw inline calls, **the first post-token-expiry withdrawal/transfer/confirm hard-fails** with a confusing error (safe — a fresh idempotency key is minted on retry — but a timing-dependent failure on exactly the money paths that must be reliable). Fix: replay once after a successful refresh.
- **C-H4 · Offer price is routed through a JS float on the money-write path.** `trade/new` and `account/offers` build the wire value as `BigInt(Math.round(Number(price))).toString()` — a **direct violation of the "never `number` for money past the display layer" non-negotiable rule** in a money-path folder. Lossless today only because prices are integer XAF; a ≥2^53 price (high-inflation multi-country, or a pasted number — the field has no maxLength) silently loses precision. Fix: `BigInt(price).toString()` after digit validation, gated on `zCreateOfferRequest`.
- **C-H5 · The five highest-stakes admin mutations validate responses with `zAnyRecord` passthrough** (approve/reject withdrawal, review KYC, resolve dispute, update setting). The "same schema both sides" guarantee is voided exactly where a malformed/drifted response is most dangerous. (Also: `content-server.ts` casts public content with `as T` instead of parsing, voiding the contract on SEO-facing SSR pages.)

**Accessibility (blocking)**
- **C-H6 · Light-theme brand accent token (`--color-accent-400`) is never overridden** → every active/emphasis state (nav, trade stepper, marketing eyebrows, icons) renders at **~1.7–1.9:1** — a whole-theme WCAG 1.4.3 failure in a theme users can toggle into. The neighboring `--color-escrow` token *is* correctly re-mapped for light, proving the pattern was known. Fix: override accent to a darker teal (e.g. `#0e5f55`) clearing 4.5:1.
- **C-H7 · Nested interactive controls (`<Link><Button>` → `<a><button>`) in ~20+ sites**, plus a `role=button` span inside a `<button>`, and **no skip link + no `<main>` on the public shell**. Systemic WCAG 4.1.2/1.3.1/2.4.1 operable/robust failures. Fix: render Button `asChild` as an anchor; add skip link + `<main>`.

**Performance**
- **C-H8 · Root-layout `force-dynamic` disables static generation for ALL 50+ routes** (build output confirms every route is `ƒ Dynamic`), so marketing/SEO pages render no-store on every hit and nothing is CDN-cacheable. (Phase 1 + 3A finding, now build-confirmed.)
- **C-H9 · Zero code splitting anywhere** (`next/dynamic`/`React.lazy`/`import()` = 0 matches), so **C-H10 · recharts (105 KB gzip, the single largest chunk) loads synchronously on the admin dashboard** despite already being SSR-guarded — a zero-behavior-change `next/dynamic` fix removes 105 KB.
- **C-H11 · The entire authed app + admin surface is `'use client'`** (43/64 app files), forfeiting RSC and forcing a client `bootstrap→/me→data` waterfall behind a blank spinner on every navigation.

## Measured performance facts (from a real production build)

Total client JS **2.3 MB raw / ~704 KB gzip** (framework ~224, shared+zod ~120, motion ~120, recharts 364/105) — none CDN-cacheable. Fonts: **20 woff2 files / ~420 KB** across 3 families / 7 weights, all preloaded globally (larger than Phase 1's 172 KB estimate — Phase 1 undercounted). Full i18n catalog (~60 KB) serialized to the client on every page. **Correction to Phase 1:** `socket.io-client` ships **0 bytes** (tree-shaken — never imported), so its cost is lockfile bloat, not payload; realtime is TanStack polling throughout. Trade-room polling **never stops on terminal trades** (~27 req/min/idle-tab forever); the 511-line trade-room God component re-renders wholesale every 4–5s with zero memoization (4 `useMemo`/3 `useCallback`/0 `React.memo` in the whole app).

## Accessibility detail (WCAG 2.2 AA not met)

Beyond C-H6/C-H7: **many contrast failures** — `text-3` fails 4.5:1 in *both* themes (placeholders, hints, timestamps, breadcrumbs, chat `text-[10px]`), danger button label 3.64:1 in light, warning/success alert text under 4.5:1 in light. **Dialog has no focus trap, no focus restoration, background not inert** (the money step-up PIN/TOTP flow). **Error text uses `role=note` (not live)** — failed PIN/TOTP is silent to AT (4.1.3). **Chat message list has no `aria-live`/`role=log`** — polled counterparty messages announced silently. Segmented control misuses `tablist`/`tab` without panels/roving focus; account menu uses `role=menu` without menu keyboard semantics; document-upload remove control is a keyboard-inoperable span; admin sidebar has no mobile nav; missing `aria-current` on breadcrumbs; KYC review images use empty alt.

## i18n gaps (Cameroon is French-first)

**Legal documents are English-only and not locale-aware** (the binding terms a user accepts render English even for `qt_locale=fr` — an i18n *and* potential consumer-law gap; corroborates Phase 1 C6). **Form validation errors are English-only** (zod messages hardcoded English, shown raw in FR forms). Suspended/maintenance pages, several shared primitives (status badges, "Close"/"Dismiss"/"Copy"/"Loading" aria-labels), and the public offer-preview card are hardcoded English (WCAG 3.1.2 Language of Parts).

## Required before the gate closes (blocking)

1. Fix the shared build so a clean checkout builds (C-H1).
2. Route wallet/escrow mutations through hooks; invalidate `qk.balances` after every movement; fix `createOffer` invalidation (C-H2).
3. Make the 401 path replay the original request after refresh (C-H3).
4. Remove the JS-float on the offer-price write path (C-H4).
5. Replace `zAnyRecord` on the five admin money/compliance mutations with real schemas; zod-parse `content-server` (C-H5).
6. Override `--color-accent-400/200` for light theme; fix skip-link+`<main>`, nested interactive controls, and dialog focus management (C-H6/C-H7).

## Recommended before launch (non-blocking)

Scope `force-dynamic` off marketing routes + add static prerender/CDN path; code-split recharts and the admin surface; stop terminal-trade polling + memoize the trade room; fix the medium contrast tokens; French legal content + localized form errors + suspended/maintenance i18n; add an explicit `currencyCode` to the Offer contract (cross-market display is currently mislabeled with the viewer's currency).

*Full structured findings: workflow `wf_c52787c5-50b` journal. Cross-references: Phase 1 site audit (a11y/SEO/perf overlap), 3A (hooks-bypass, shared-build, force-dynamic), 3G (money-float rule), 3H (readiness).*
