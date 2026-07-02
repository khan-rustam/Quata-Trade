# AUDIT GATE 4 — Offers, Trades, Escrow State Machine

**Date:** 2026-07-02 · **Commit:** bc5437c · **Status: CORE PASSED (HTTP layer + disputes module pending; re-run full gate after Phase 5)**

Test evidence: `backend/src/modules/escrow/escrow.integration.spec.ts` (13 scenarios, real PG16).

## §8.C Escrow / trade state machine
- [x] Transitions only via FSM; DB trigger rejects illegal transitions (raw-SQL bypass test)
- [x] No release while DISPUTED: confirm/cancel/expiry all rejected; only `resolveDispute` moves funds
- [x] Every transition writes `trade_events` in the SAME transaction (happy path + failed-op leaves none)
- [x] Timeout auto-cancel refunds seller exactly once (double-expire returns false)
- [x] Dispute resolution moves funds only through EscrowService (RELEASE and REFUND both verified)

## §8.B Concurrency (trade-level)
- [x] Ten parallel 20-USDT opens vs 100-USDT offer → **exactly 5** succeed; remaining=0; EXHAUSTED
- [x] Double seller-confirm idempotent (sequential + concurrent double-click)
- [x] Payment-submit vs expiry race → exactly one terminal outcome, funds exactly once
- [x] Buyer-only cancel; refund + offer restock verified
- [x] KYC tier limits gate trade size (tier 0 blocked); kill switch halts opening

## Golden invariants (Documents/01)
- [x] `buyer_credit + fee = escrow_locked_amount` exact BIGINT equality (fee → treasury verified)
- [x] Escrow balances match open trades (implicit in balance assertions across all scenarios)
