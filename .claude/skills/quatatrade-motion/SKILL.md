---
name: quatatrade-motion
description: Animation & micro-interaction rules for QuataTrade. Use when adding, changing or reviewing ANY animation, transition, transform, loading state, skeleton, countdown, stepper or the escrow keyhole moment. Triggers on motion, animate, framer, transition, keyframes, prefers-reduced-motion, skeleton, spinner, pulse, count-up.
---

# QuataTrade Motion Rules

Authority: `Documents/11-brand-design-system.md` §11.7. Primitives live in
`frontend/app/globals.css`; the library is **`motion`** (imported as `motion/react`) —
NOT `framer-motion`. Shared helpers: `frontend/components/motion/`.

## The budget

- **150–250ms, ease-out, `transform`/`opacity` only.** This is a low-end-Android market;
  animating layout, colour, `width`/`height`, `top`/`left`, filters or shadows is banned
  on interactive surfaces. Exception: the escrow signature moment (600–700ms, once).
- Motion is **feedback, not decoration**. If it does not tell the user something changed,
  it does not ship.

## The catalogue (use these, don't invent new ones)

| Moment | Spec | Where |
|---|---|---|
| Button press | 0.97 scale tap-down | `components/ui/button.tsx` |
| Dialog/sheet open | `qt-animate-dialog` — 200ms, 8px rise + 0.98 scale | globals.css |
| Generic fade-in | `qt-animate-fade` — 180ms | globals.css |
| Balance update | 300ms count-up, Plex Mono | `components/motion/animated-number.tsx` |
| Status stepper | 200ms sweep fill in the semantic colour | `components/trade/` |
| Scroll reveal | `components/motion/reveal.tsx` | marketing only |
| **Escrow locks (signature)** | keyhole draws closed + `accent-400` pulse ring, 600ms, **once** | `components/brand/animated-keyhole.tsx` |
| Escrow releases | the same keyhole opens | same component |
| Countdown | turns `warning` at 25% left; opacity 1→0.75 pulse under 2 min | trade room |

## Reduced motion is not optional

`globals.css` has a global `prefers-reduced-motion` block that clamps durations to
0.01ms and iteration counts to 1. That is a floor, not a solution:

- Every `motion/react` component must call `useReducedMotion()` and render the
  **end state** immediately — not a clamped animation. `animated-keyhole.tsx` is the
  reference implementation: `initial` flips to the locked values when `reduce` is true.
- Looping/ambient animations (`qt-rail-*`, aurora) must park at a resting frame, never
  freeze mid-motion or at `opacity: 0` where content becomes invisible.
- State changes swap instantly; pulse rings become a static colour change.

## Loading states

Skeletons on **every** data surface — sub-3s perceived load is a hard requirement.
No spinner may be shown for longer than 400ms without a skeleton behind it. Never
animate a money figure from a placeholder value: skeleton until the real amount lands,
then count up from the real number. A number animating from 0 to a balance reads as
a balance that was briefly wrong.

## NEVER do

- NEVER animate a money amount into place from a fake/incremental value, and never
  animate an amount that has not been confirmed by the server.
- NEVER use the `Quata Flow` gradient or any ambient/looping motion inside the trade
  room or wallet — money screens stay flat and calm (§11.10).
- NEVER add `framer-motion`; the dependency is `motion`. Two motion libraries is a
  Deviations Log entry, not a convenience.
- NEVER use motion to manufacture urgency — no fake countdowns, no pulsing CTAs.
  The countdown pulse is "urgency without panic" and only under 2 minutes.
- NEVER ship an animation without defining its reduced-motion behaviour.
- NEVER define a keyframe in `globals.css` without using it — dead animation classes
  imply coverage that does not exist. Wire it or delete it.
