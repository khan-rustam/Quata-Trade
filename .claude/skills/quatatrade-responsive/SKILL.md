---
name: quatatrade-responsive
description: Responsive layout & touch-target rules for QuataTrade. Use when building or reviewing ANY layout, page shell, nav, table, modal, form or grid, and whenever a change could affect small screens. Triggers on responsive, breakpoint, mobile, tablet, desktop, viewport, overflow, bottom nav, sidebar, touch target, sticky.
---

# QuataTrade Responsive Rules

Authority: `Documents/11-brand-design-system.md` §11.8 (density) +
`Documents/07-frontend-spec.md` (shell). Tailwind 4 default breakpoints; no custom
screens without a Deviations Log entry.

## Mobile-first, and it means it

This is a Cameroon/Central Africa product — the majority of trading happens on a phone.
**380px is the design floor**, not an edge case. Write the small-screen layout first,
then add `sm:`/`md:`/`lg:` to grow it. A `lg:`-first layout with mobile bolted on is the
single most common failure in this codebase's UI history.

## Shell behaviour

| Viewport | Authenticated shell | Notes |
|---|---|---|
| < `md` | **bottom nav** — Home · Markets · Trade · Wallet · Account | thumb reach; primary action bottom-right |
| ≥ `md` | **sidebar** | top bar keeps logo, network/status, lang, theme, bell, avatar |
| Admin | separate `/admin` shell, sidebar-first | tables are the primary surface |

Implementation: `frontend/components/layout/app-shell.tsx`. One primary action per
screen; keep it inside thumb reach on mobile.

## Non-negotiable numbers

- **44px minimum touch target** on every interactive element — including icon buttons,
  chips, table row actions and the theme/language toggles. Visual size may be smaller;
  the hit area may not.
- **Amounts in the trade room ≥ 18px.** Minimum text size anywhere is 12px.
- Test at **380 / 768 / 1280**. 380px is the pass/fail gate.

## The three things that actually break

1. **Tables.** Admin is table-heavy. A table must either collapse to stacked cards
   below `md`, or live in its own `overflow-x: auto` container. The page body must
   never scroll sideways — if `document.body` scrolls horizontally at 380px, it's a bug.
2. **French overflow.** FR strings run ~20% longer than EN. Buttons, chips, nav labels
   and table headers must be checked in FR at 380px. See `quatatrade-i18n`.
3. **Long unbroken strings.** Wallet addresses, tx hashes and references are 34–64
   characters of unbreakable text. They need truncation with a copy affordance, or
   `break-all` inside a bounded container — never allowed to widen the layout.

## Also check

- Modals/sheets: full-height sheet on mobile, centred dialog on desktop; content inside
  scrolls, the page behind does not. `hooks/use-modal-panel.ts` handles this.
- Sticky elements: a sticky header plus a sticky action bar must not eat a 380px×667px
  viewport. Budget the remaining content height.
- Safe areas: bottom nav respects `env(safe-area-inset-bottom)` on notched devices.
- Charts (`lightweight-charts`) must resize with their container, not a fixed pixel width.
- Keyboard-visible viewport on mobile: an amount input must stay visible above the
  on-screen keyboard when focused.

## NEVER do

- NEVER use a fixed pixel width on a container that holds user or i18n content.
- NEVER let the page body scroll horizontally at 380px — put the overflow on the
  wide child (table, chart, code block) instead.
- NEVER hide a money figure, fee line or confirm button behind horizontal scroll or
  a `truncate` that removes digits. Fees must be visible before every confirm.
- NEVER rely on hover to reveal an action that mobile users need — hover does not exist
  on touch. Row actions need a visible affordance.
- NEVER shrink a touch target below 44px to fit a layout; change the layout.
