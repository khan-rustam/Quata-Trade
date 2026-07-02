# 07 — Frontend Specification (Next.js 15)

> The client provided a 140-screen list (see `10-client-prompts-appendix.md`). This maps the Phase-1 subset we actually build, the layouts, and — critically — how the frontend and backend stay in lockstep through shared types so integration is verified at compile time.

## The FE/BE contract (how "test integration completely with types" is realized)

- All request/response shapes are zod schemas in `packages/shared/src/schemas`. Backend validates with them; frontend infers types from them (`z.infer`) and validates responses too.
- A generated typed API client (`packages/shared/src/client`) wraps every endpoint. Components never call `fetch` directly.
- If backend changes a shape, the shared schema changes, and **every frontend call site fails to compile** until fixed. That is the integration test at the type level. Runtime contract tests (§9) back it with real calls.
- Money is passed as strings (BIGINT-safe); a `Money` helper in shared converts to display using `decimal.js` (÷ 1e6 for USDT). Components never do raw math on amounts.

## Global layout & system

- **Shell:** top bar (logo, network/status, language toggle en/fr, theme toggle, notifications bell, avatar). Authenticated app uses bottom nav on mobile / sidebar on desktop: **Home · Markets · Trade · Wallet · Account**. Admin is a separate `/admin` shell.
- **Design:** fintech-clean, high-trust; dark + light via Tailwind; shadcn/ui components; consistent spacing scale; skeleton loaders; never show optimistic balances.
- **States everywhere:** loading / empty / error / success; all money right-aligned monospace; every destructive or money action has a confirm step (+ 2FA/PIN where required).
- **i18n:** all copy via next-intl keys; no hardcoded strings; XAF and USDT formatting helpers.

## Phase-1 screens (build these)

### Public / Auth
- Landing (value prop, trust signals), Login, Register, Email OTP, Phone OTP, Forgot/Reset, 2FA setup + verify.
- Layout: centered card, form via react-hook-form + zod resolver (same schema as backend).

### Home
- Portfolio value (from ledger balances), USDT balance card, KYC/verification status banner, reputation score, quick actions (Buy, Sell, Deposit, Withdraw), market snapshot, active offers preview, latest trades.

### Markets
- USDT price vs XAF (from configured rate feed), 24h change, lightweight-charts price view. (Single asset in Phase 1; layout ready for more.)

### Trade (the core)
- **Buy / Sell list:** filter bar (side, payment method, min/max, verified-only); offer cards (trader name, reputation, completion rate, limits, methods, price).
- **Offer detail:** trader profile, terms, limits; "Open trade" with amount entry → live fee + total via `fees` shapes.
- **Create/Edit offer:** side, amount, price XAF/USDT, min/max, payment methods, terms.
- **My offers / analytics (basic).**
- **Trade Room (most important screen):** status stepper (Opened→Locked→Payment Submitted→Completed), countdown timer, escrow status, counterpart details, payment instructions per method, **buyer:** submit proof (reference, sender name/number, screenshot upload with client-side type/size pre-check), **seller:** "Payment received / not received" (guarded by confirm + optional 2FA/PIN), live chat panel (Socket.IO), open-dispute entry.
- Trade success / cancelled / expired states; dispute submission + evidence upload + timeline view.

### Wallet
- Balances (available vs in-escrow shown separately — never conflate). Deposit (address + QR from watch-only derivation, canonical-contract warning copy). Deposit history. Withdraw (address, amount, fee preview, 2FA + PIN). Withdrawal review + status tracking. Withdrawal/transaction history. Internal transfer (QuataPay) — ledger-only.

### Account
- Profile, Verification center + KYC submit (document capture guidance, upload), KYC status, Security center (change password/PIN, manage 2FA, devices, sessions), notification preferences, language, transaction/trade/fee history, support center + tickets + FAQs, terms/policies, logout.

### Admin (`/admin`, RBAC-gated)
- Login + 2FA. Dashboard KPIs (users, trades, volume, revenue, disputes, risk flags). User list/detail/freeze. KYC review queue + detail (approve/reject — manual). Trade list/detail + active escrows. Dispute queue + evidence viewer + resolution center. Withdrawal approval queue (dual-approve UI for large). Wallet/treasury monitoring + reconciliation status. Revenue/fee reports. Risk alerts + suspicious accounts. Settings (fees, caps, timeouts). Kill switches (withdrawals/trades) with confirm. Audit log viewer (read-only). Announcement/maintenance.

## Deferred screens (stub or omit in Phase 1)
Airtime/data module, dealer application/dashboard, referral dashboard/earnings, AI support chat (use human tickets), full analytics suite, mobile Flutter apps, splash/onboarding animations (simple versions only).

## Frontend rules for Claude Code
- Never call `fetch` directly — use the typed client.
- Never do arithmetic on monetary strings — use the `Money` helper.
- Never store tokens in localStorage — httpOnly cookies for refresh; access token in memory.
- Every mutation uses TanStack Query with proper invalidation; no optimistic updates on balances/trades.
- Every form uses the shared zod schema as resolver; show field errors from the same schema the server enforces.
- Route guards: unauthenticated → login; unverified/KYC-gated actions → verification prompts; admin routes check role from server (never trust client role).
- Accessibility + responsive: mobile-first, keyboard-navigable, proper labels.
