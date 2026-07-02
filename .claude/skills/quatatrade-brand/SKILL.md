---
name: quatatrade-brand
description: Brand & design-system rules for QuataTrade. Use for ANY UI work in frontend/ — components, pages, styling, colors, typography, motion, copy, empty states, dark/light themes. Triggers on Tailwind tokens, shadcn, design, landing page, trade room UI, wallet UI.
---

# QuataTrade Brand Rules

Authority: `Documents/11-brand-design-system.md` — this skill is the summary; Part 11 decides.

## Identity

- Wordmark `QuataTrade` (short form: Quata). Tagline EN: **"Crypto to cash. Protected."**
  FR: **"De la crypto au cash. Protégé."**
- Personality: **Protected. Direct. Fresh.** Fintech-clean, not casino, not bank.
- Banned copy: "get rich", "moon", "guaranteed profit", "invest". We sell safety and control.

## Tokens (already the law — components NEVER hardcode hex)

Drop-in `@theme` block is in Part 11 §11.8. Key tokens:
- Brand: `brand-900 #0B3B36`, `brand-700 #0E5F55` (primary light), `brand-500 #159E85`,
  accent `accent-400 #2FD4A7` (THE accent — CTAs on dark, focus rings, escrow glow), `accent-200 #A9EFD9`.
- Dark (default theme): bg `#0E1416`, surfaces `#151C1E/#1C2528/#243033`, border `#2C3A3D`,
  text `#E7EDEB/#9FB3AE/#5E706C`. No pure black, no pure white body text.
- Semantic (always icon + label, never color alone): success/buy `#4ADE8C` dark,
  danger/sell `#F87171` dark, warning `#FBBF24`, info `#7DB2FF`, escrow = brand/accent (the lock color).
- Radius: 12px cards, 10px buttons, 999px chips. Dark elevation = lighter surface, not shadows.

## Typography

- Display: **Space Grotesk** 500/700 (H1–H2, hero numbers). Body/UI: **Inter** 400/500/600.
- **ALL amounts, rates, addresses, refs, timers: IBM Plex Mono with `tabular-nums`.**
  Amounts in the trade room ≥18px. Self-host via `next/font`. Sentence case everywhere.

## Motion

150–250ms, ease-out, transform/opacity only. Signature moment: keyhole lock draws closed on
escrow lock (600ms, once). Countdown turns `warning` at 25%, gentle pulse under 2 min.
Everything respects `prefers-reduced-motion`. Skeletons on every data surface.

## Hard rules for money screens

- Never optimistic balances; never rounded-off amounts; fees shown before every confirm.
- Money buttons state the exact action: "Release 150.00 USDT" — disabled until valid, confirm
  step (+2FA/PIN where required).
- Gradient (`Quata Flow`) is marketing-only — NEVER in trade room/wallet, never behind body text.
- Payment methods as chips in partner colors (MTN yellow, Orange orange) on neutral backgrounds.
- i18n: every string via next-intl (en + fr), FR runs ~20% longer — check truncation.
- WCAG 2.1 AA: body ≥4.5:1, focus ring 2px `accent-400` visible everywhere, 44px touch targets.

## PR design QA (attach to every UI PR)

Tokens only · AA contrast · both themes + both languages · visible focus/keyboard path ·
icons+labels with color meanings · Plex Mono tabular amounts · reduced-motion defined ·
skeletons · screenshot mobile 380px + desktop.
