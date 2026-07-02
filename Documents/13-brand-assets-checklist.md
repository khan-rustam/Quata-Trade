# 13 — Brand Assets Checklist (what to generate & hand over)

> Everything the app needs as an image/asset, with exact pixel dimensions, formats, and where it
> goes. Design rules come from `11-brand-design-system.md` — read §11.5 (logo) and §11.3 (color)
> before generating anything. The app currently ships a **placeholder inline SVG keyhole**
> (`frontend/components/brand/keyhole.tsx`); these assets replace/augment it.

## Ground rules for whatever generates these (ChatGPT / Figma AI / a designer)

- **Vector first.** Deliver logos and icons as **SVG** (clean paths, no embedded rasters, no text
  — convert type to outlines). PNG exports are derived from the SVG.
- **Transparent background** on all logos/icons/favicons (PNG-32 with alpha). No white box.
- **The signature:** the Q's tail is drawn as a **key**; the Q's counter reads as a **keyhole** at
  small sizes. One quirk, everything else disciplined (Documents/11 §11.5).
- **Colors (hex):** accent `#2FD4A7` (Volt Mint), brand `#0E5F55` (Quata Teal), deep `#0B3B36`,
  ink `#101614`, paper `#F6F9F8`, dark bg `#0E1416`, soft-white text `#E7EDEB`. Never pure black/white.
- **Type in lockups:** wordmark is **Space Grotesk 700**, "QuataTrade" — capital Q and T, one word.
- **Safe area:** clearspace = height of the Q on all sides. Min wordmark width 96px; icon works at 16px.
- **Deliver a `/brand` folder** with source SVGs + the exported PNGs listed below.

---

## TIER 1 — Must have before launch (blocks nothing to build, but ships incomplete without these)

### A. Logo / wordmark (vector)
| Asset | Format | Size (artboard) | Use |
|---|---|---|---|
| Wordmark — full color | SVG | ~ 480×120 (any, vector) | Top bars, marketing, emails |
| Wordmark — mono dark theme (`#E7EDEB`) | SVG | same | On dark surfaces |
| Wordmark — mono light theme (`#101614`) | SVG | same | On light surfaces |
| Icon only — the Q-key/keyhole glyph, full color | SVG | 64×64 (vector) | App mark, avatars, compact bars |
| Icon only — mono dark / mono light | SVG | 64×64 | Monochrome contexts |

### B. Favicon & app icons (raster, from the icon SVG)
| File | Format | Size (px) | Placed at | Notes |
|---|---|---|---|---|
| `favicon.ico` | ICO (multi-res) | 16, 32, 48 packed | `frontend/app/favicon.ico` | Next serves it automatically |
| `icon.svg` | SVG | scalable | `frontend/app/icon.svg` | Modern browsers |
| `apple-icon.png` | PNG-32 | **180×180** | `frontend/app/apple-icon.png` | iOS home screen; **safe padding ~14%**, non-transparent tile OK (dark `#0E1416`) |
| `icon-192.png` | PNG-32 | **192×192** | `frontend/public/` | PWA / Android |
| `icon-512.png` | PNG-32 | **512×512** | `frontend/public/` | PWA / Android splash |
| `icon-192-maskable.png` | PNG-32 | **192×192** | `frontend/public/` | Android adaptive — glyph inside the **80% safe circle**, filled bg |
| `icon-512-maskable.png` | PNG-32 | **512×512** | `frontend/public/` | Same, larger |
| `safari-pinned-tab.svg` | SVG (single-color path) | scalable | `frontend/public/` | Monochrome silhouette |

> The favicon/app-icon glyph should be the **Q-key alone in `accent-400` on a `#0E1416` rounded
> square tile** (Documents/11 §11.5), rounded-square corner radius ≈ 22% for the maskable/apple tiles.

### C. Social / link preview
| File | Format | Size (px) | Use |
|---|---|---|---|
| `og-image.png` | PNG or JPEG | **1200×630** | Open Graph (link previews on WhatsApp, FB, LinkedIn) |
| `twitter-card.png` | PNG or JPEG | **1200×675** | X/Twitter large card (can reuse OG if 1200×630) |

> OG image: wordmark + tagline "Crypto to cash. Protected." on the **Quata Flow gradient**
> (`#0E5F55 → #159E85 → #2FD4A7` mesh). Keep text in the safe center (avoid outer 10%).

---

## TIER 2 — High value (marketing polish & empty states)

### D. Illustrations (flat shapes + subtle grain on the Quata Flow gradient — §11.6)
| Asset | Format | Size (px) | Use |
|---|---|---|---|
| Hero illustration | SVG or PNG (transparent) | ≥ 1600×1000 @1x, export @2x | Landing hero |
| Onboarding 1–3 | SVG/PNG | ~ 800×800 each | Onboarding carousel (deferred, but nice) |
| Empty-state: no offers | SVG/PNG | ~ 320×240 | Trade empty state |
| Empty-state: no deposits/history | SVG/PNG | ~ 320×240 | Wallet empty state |
| Empty-state: all caught up | SVG/PNG | ~ 320×240 | Notifications empty state |
| Success / escrow-locked moment | SVG (Lottie optional) | ~ 240×240 | Trade room "released"/"locked" |

> Characters: varied Central African skin tones and dress; friendly, never childish. Imagery is
> **real, warm, Cameroon-first** (market traders, students, small-business owners) — no stock suits,
> no glowing Bitcoin renders, no hoodie-hacker clichés.

### E. Photography (marketing site, optional in app)
| Asset | Format | Size | Use |
|---|---|---|---|
| Hero / lifestyle photos ×3–5 | WebP (+ JPEG fallback) | 1920px wide @1x, provide @2x | Landing, trust sections |

---

## TIER 3 — Partner & platform marks (source from providers, do NOT AI-generate the partner logos)

| Asset | Format | Size | Notes |
|---|---|---|---|
| MTN MoMo logo | SVG | vector | **Official MTN brand asset** — get from MTN brand kit; respect their guidelines/licensing |
| Orange Money logo | SVG | vector | **Official Orange brand asset** — from Orange brand kit |
| QuataPay mark | SVG | 48×48 | Ours — derive from brand (teal), simple wallet/coin glyph |

> In the UI these render as **chips**: the app already shows colored dots (MTN yellow `#FFCB05`,
> Orange `#FF7900`, QuataPay teal). Real logos are only needed for marketing pages / trust badges,
> not the in-app chips. Using partner logos in-product may require their written permission.

---

## What is ALREADY handled (don't generate)
- **Fonts** — Space Grotesk, Inter, IBM Plex Mono are free Google Fonts, self-hosted via `next/font`. No files needed.
- **UI icons** — `lucide-react` (already in the stack). Only the keyhole/lock, shield-check, and the
  payment marks are custom.
- **In-app payment chips** — rendered with brand-colored dots in code (no image needed).

## Handover format
Zip a `/brand` folder:
```
brand/
  logo/            wordmark-color.svg, wordmark-dark.svg, wordmark-light.svg,
                   icon-color.svg, icon-dark.svg, icon-light.svg
  favicon/         favicon.ico, icon.svg, apple-icon.png, icon-192.png, icon-512.png,
                   icon-192-maskable.png, icon-512-maskable.png, safari-pinned-tab.svg
  social/          og-image.png, twitter-card.png
  illustration/    hero.svg, empty-offers.svg, empty-wallet.svg, empty-notifications.svg, ...
  photo/           hero-1.webp, ...
```
Drop the favicon files into `frontend/app/` and `frontend/public/` per the table; I'll wire the
manifest + `<head>` links and swap the placeholder keyhole for the real icon SVG.
