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

## AI image-generation prompts (copy-paste ready)

> Paste the **STYLE PREAMBLE** first, then the per-asset prompt, into ChatGPT image / DALL·E /
> Midjourney / Figma AI. For flat vector illustrations, ask for **SVG output** or "flat vector,
> solid shapes" then trace to SVG. Logos are best done by a designer or by asking the AI for
> **"simple flat vector, SVG, on transparent background, minimal, geometric."** Always re-export
> to the exact sizes in the tables above.

**STYLE PREAMBLE (prepend to every prompt):**
> Brand: QuataTrade, a modern fintech for Central Africa. Palette: mint-teal `#2FD4A7`, deep teal
> `#0E5F55`, near-black teal-tinted background `#0E1416`, soft off-white `#E7EDEB`. Flat, clean,
> geometric, generous negative space, subtle grain texture, high trust, calm — NOT crypto-bro, no
> neon, no laser eyes, no glowing coins, no 3D render, no gradients behind text. Warm and
> Cameroon-first. Transparent background unless stated.

| Asset | Prompt (after the preamble) |
|---|---|
| **Logo / wordmark** | "A minimalist wordmark logo reading 'QuataTrade' in a geometric bold sans-serif (Space Grotesk style). The letter Q's tail is drawn as a small key, and the Q's inner counter reads as a keyhole. One color: mint-teal on transparent. Flat vector, SVG, no shadows, no 3D." |
| **App icon / keyhole glyph** | "A single app-icon glyph: a circular letter Q whose counter forms a keyhole and whose tail is a key. Mint-teal `#2FD4A7` on a rounded-square dark tile `#0E1416`, ~14% padding. Flat, geometric, iconic at 16px. SVG." |
| **Favicon (maskable)** | Same as app icon, but "centered inside the safe 80% circle, filled dark background to the edges (no transparency), rounded-square." |
| **OG / social image (1200×630)** | "A social share banner, 1200×630. Left: the QuataTrade wordmark (keyhole-Q) and the tagline 'Crypto to cash. Protected.' in clean type. Background: a soft teal→mint mesh gradient (`#0E5F55`→`#159E85`→`#2FD4A7`) with subtle grain. Right: a simple flat illustration of a phone showing a locked-padlock/escrow shield. Balanced, lots of breathing room, text in the safe center." |
| **Hero illustration** | "A wide flat vector illustration for a fintech landing hero: a Cameroonian person (varied skin tone, everyday dress, e.g. a young market vendor) smiling at a phone, with a floating simplified UI card showing a padlock/escrow badge and a coin↔cash exchange arrow. Mint-teal and deep-teal palette, subtle grain, warm, optimistic, plenty of empty space on one side for headline text. Flat shapes, no outlines-heavy, SVG." |
| **Onboarding 1 — escrow** | "Flat vector, 800×800: two hands exchanging a coin and cash notes with a glowing mint padlock/keyhole between them symbolising escrow protection. Central African context, warm, simple shapes, teal palette, grain." |
| **Onboarding 2 — pay your way** | "Flat vector, 800×800: a phone with three payment chips (mobile-money style, one yellow, one orange, one teal) and a happy user. Teal palette, minimal, grain." |
| **Onboarding 3 — dispute safety** | "Flat vector, 800×800: a friendly shield-check and a small chat bubble, conveying human dispute review and safety. Teal palette, calm, minimal." |
| **Empty state — no offers (320×240)** | "Flat vector, 320×240, transparent: a simple empty marketplace stall / open box with a small mint plus-sign, inviting the user to create the first offer. Minimal, teal, friendly, lots of negative space." |
| **Empty state — no wallet activity** | "Flat vector, 320×240, transparent: a minimal wallet outline with a subtle mint sparkle, calm and empty. Teal palette." |
| **Empty state — all caught up (notifications)** | "Flat vector, 320×240, transparent: a small bell with a check mark and a relaxed vibe, 'all caught up'. Teal, minimal." |
| **Success / escrow-locked moment (240×240)** | "Flat vector, 240×240, transparent: a keyhole glyph clicking shut with a soft mint pulse ring around it, conveying 'funds protected'. Minimal, iconic, animatable (also provide an 'open' variant for release)." |
| **Hero / lifestyle photography** | Photography brief (for a shoot or stock, NOT AI unless labelled): "Real, warm, natural-light photos of Cameroonian market traders, students and small-business owners using phones; authentic, candid, no corporate suits, no glowing screens-as-hero. 1920px wide, WebP." |

Tip for the keyhole-Q: the app already ships a working vector at
`frontend/components/brand/keyhole.tsx` — a designer can trace/refine that exact geometry so the
generated logo and the in-app glyph match perfectly.

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
