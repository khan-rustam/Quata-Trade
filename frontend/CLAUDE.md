# frontend/ — Standing Rules for Claude Code

Repo-wide rules live in `../CLAUDE.md` and always apply. This file adds the
frontend-only rules. Authority: `Documents/07-frontend-spec.md` (§"Frontend rules
for Claude Code") and `Documents/11-brand-design-system.md`. The docs decide.

Consult `.claude/skills/quatatrade-brand` before any UI work, plus
`quatatrade-motion`, `quatatrade-responsive` and `quatatrade-i18n` for their areas.

## Stack

Next.js 16 App Router · React 19 · Tailwind 4 (CSS-first `@theme` in `app/globals.css`)
· `motion` (not framer-motion) · next-intl · TanStack Query v5 · react-hook-form + zod
· lightweight-charts · lucide-react. Package manager is **pnpm** — this package is a
workspace member; never run `npm install` here.

## Route groups

| Path | Shell | Notes |
|---|---|---|
| `app/(public)` | marketing | landing, markets, help, legal, security, status |
| `app/(auth)` | centered card | login, register, verify-email, forgot/reset |
| `app/(app)` | bottom nav (mobile) / sidebar (desktop) | home, markets, trade, wallet, account |
| `app/admin` | separate admin shell | RBAC-gated; role comes from the server |

## Hard rules

- **Never call `fetch` directly.** Use the typed client from `@quatatrade/shared`;
  it parses responses with the same zod schema the backend validates against.
- **Never do arithmetic on monetary strings.** Amounts arrive as BIGINT-safe decimal
  strings; convert for display only via the `Money` helper in `shared/src/money.ts`.
- **Never show optimistic balances or trade state.** No optimistic updates on money
  data — TanStack Query mutation + invalidation only.
- **Never store tokens in localStorage.** Refresh token is an httpOnly cookie; the
  access token stays in memory.
- **Never hardcode a hex colour.** Use the `@theme` tokens in `app/globals.css`. This
  includes SVG `fill`/`stroke`/`stopColor` — pass `var(--color-*)`, because a literal
  mint (`#2fd4a7`) fails WCAG on light-mode surfaces where the token resolves to
  `#0c7a62` instead.
- **Never hardcode a user-facing string.** Every string is a next-intl key with an
  `en` and an `fr` value. FR runs ~20% longer — check for truncation.
- **Never trust a client-side role.** Admin route guards verify against the server.
- Every form uses the shared zod schema as its resolver so field errors match what
  the server enforces.
- Every money-moving button names the exact action and amount ("Release 150.00 USDT"),
  is disabled until the form is valid, and has a confirm step (+2FA/PIN where required).

## Before claiming a UI task is done

Run `pnpm --filter frontend lint` and `pnpm -r typecheck`, then walk the
§11.11 design-QA checklist: tokens only · AA contrast · both themes · both languages ·
visible focus and a working keyboard path · 44px touch targets · amounts in Plex Mono
with `tabular-nums` · reduced-motion behaviour defined · skeletons on data surfaces ·
screenshots at 380px and desktop.
