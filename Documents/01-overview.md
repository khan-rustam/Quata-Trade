# 01 — Project Overview & Context

> Load this file at the start of every Claude Code session.

## What QuataTrade is

A **P2P cryptocurrency marketplace with escrow protection** for Cameroon / Central Africa (English + French). Buyers and sellers trade crypto directly with each other; fiat payment happens **off-platform** via MTN Mobile Money, Orange Money, or the internal QuataPay wallet. QuataTrade locks the seller's crypto in escrow during the trade and releases it to the buyer when the seller confirms fiat receipt. Revenue = trading fee (0.3% QuataPay / 0.5% MoMo & Orange) collected in crypto into the platform treasury.

It is **not** a centralized order-book exchange. There is no order matching, no market/limit orders, no fiat custody.

## What we are building (Phase 1 scope — authoritative)

- **Asset:** USDT on TRON (TRC20) only. BTC and ETH are Phase 3+. BSC/Polygon deferred indefinitely.
- **Platform:** Responsive web app (Next.js) + admin dashboard. Flutter mobile apps deferred.
- **Payments:** MTN MoMo and Orange Money recorded as off-platform references (we never touch fiat). QuataPay internal wallet = internal ledger transfer.
- **Escrow:** custodial escrow via HD-wallet architecture with an **isolated signing service**; API app is watch-only (xpub).
- **KYC:** Tier structure per client spec, but verification decisions are **manual-review-first**. Commercial provider (Smile ID) is the recommended path; a DIY assist pipeline (OCR pre-fill) may exist but **never auto-approves**.
- **Risk:** deterministic rules engine (velocity, device, IP, duplicate detection). No LLM-based fraud detection in v1.
- **Disputes:** evidence upload + admin resolution center. Escrow frozen during dispute; only admin resolution releases.
- **Chat:** per-trade Socket.IO chat with proof-of-payment upload, admin monitoring, dispute export.
- **Notifications:** email (SMTP) + in-app; FCM push later.
- **Extras deferred:** airtime/data module, dealer module, referral system (stub tables only), AI support chat, analytics beyond basic KPIs.

## Decisions already made (do not re-litigate in code sessions)

| Decision | Choice | Why |
|---|---|---|
| Backend | NestJS 11 + TypeScript strict | Dev reads TS fluently (critical for reviewing AI code); JS has the reference blockchain libs |
| Architecture | Modular monolith + one separate signer service | 7 microservices is an anti-pattern for a solo dev; signer isolation is the only split that buys real security |
| DB | PostgreSQL 16, double-entry append-only ledger | Money integrity |
| Chain access | TronGrid free tier (+ fallback RPC), not self-run nodes | "Self-host everything" costs more than it saves; nodes are Phase 4 at the earliest |
| KYC | Manual-first, Smile ID recommended; DIY auto-approval **banned** | Homegrown liveness/face-match gets farmed by fraud rings; biometric data liability (Cameroon Law 2024/017) |
| AI fraud | Rules engine, not Ollama/LLMs | No labeled data exists pre-launch; LLMs are the wrong tool |
| Client's "no third parties" mandate | Accepted for notify/chat/ledger; **rejected for auto-KYC and unrestricted custody**; compromise architecture for custody | Documented in 10-appendix Deviations Log; developer advised client of risks in writing |

## Legal & safety guardrails baked into the build

These exist because of the CEMAC/COBAC regulatory position on crypto, Cameroon Law No. 2024/017 on personal data, and the developer's personal exposure. They are **product requirements**, not suggestions:

1. **Client holds the keys.** Treasury/cold wallet keys, signer host root access, and withdrawal-approval admin accounts belong to the client's entity. Developer never becomes sole key custodian in production.
2. **Withdrawal caps.** Hot wallet holds a small operational float; withdrawals above threshold require manual admin approval (multi-admin for large amounts).
3. **KYC data minimization.** Documents encrypted at rest per-file, access-audited, retention schedule enforced. The client's "keep everything as AI training data" instruction is implemented **only** as: retain per legal retention policy, with consent language, and no training pipeline in v1.
4. **Audit logs are append-only** and cover every admin action, every escrow transition, every withdrawal approval.
5. **Kill switches:** global withdrawal pause, trade pause, and per-user freeze — admin-triggerable, logged.
6. **Written deviation log** (`10-client-prompts-appendix.md`) records where and why the build differs from client prompts.

## Core trade flow (canonical — memorize)

```
Seller creates offer  →  balance check  →  crypto reserved (available → escrow_reserved)
Buyer opens trade     →  escrow LOCKED for trade amount, payment timer starts (e.g. 30 min)
Buyer pays seller off-platform (MoMo/Orange/QuataPay)
Buyer submits proof   →  status: PAYMENT_SUBMITTED (reference, sender name/number, screenshot)
Seller confirms       →  escrow RELEASES: amount−fee → buyer wallet, fee → treasury  →  COMPLETED
Seller denies / timer expires with no proof →  auto-cancel path → escrow returns to seller
Either party disputes →  DISPUTED: escrow frozen, admin resolution only
```

Golden invariants (tested property-based, enforced by DB constraints):
- Sum of all ledger entries per account/asset ≥ 0 at all times; escrow account balances exactly match open trades.
- For every completed trade: `buyer_credit + fee = escrow_locked_amount`. Exact BIGINT equality.
- No path releases escrow while `status = DISPUTED` except an `admin_resolution` transition.
- Every state transition row exists in `trade_events` before the trade row reflects it (same DB transaction).

## Success criteria for v1 launch

- Full trade lifecycle works end-to-end on TRON **Shasta/Nile testnet**, then mainnet with capped limits (e.g. max 200 USDT/trade, 1,000 USDT hot wallet float).
- Every audit gate in `05-build-phases.md` passed and recorded.
- Concurrency tests prove no double-lock/double-release under parallel load.
- Client sign-off on the deviations log.
