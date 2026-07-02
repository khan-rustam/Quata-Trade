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
