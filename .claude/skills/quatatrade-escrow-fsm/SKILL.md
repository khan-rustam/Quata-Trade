---
name: quatatrade-escrow-fsm
description: Escrow state-machine rules for QuataTrade. Use BEFORE touching backend/src/modules/escrow, trades, offers, disputes, or any code that reads/writes trades.status, opens/cancels/expires/confirms trades, or resolves disputes. Triggers on trade lifecycle, escrow lock/release/refund, DISPUTED, trade_events.
---

# QuataTrade Escrow FSM Rules

Full spec: `Documents/04-database-schema.md` §4.5 and `Documents/08-security-checklist.md` §C.
Implementation: `backend/src/modules/escrow/escrow.service.ts` — the ONLY mutator of trade state.

## The state machine (authoritative — `trade_transitions` table backs it with a DB trigger)

```
OPENED → ESCROW_LOCKED | CANCELLED
ESCROW_LOCKED → PAYMENT_SUBMITTED | CANCELLED | EXPIRED | DISPUTED
PAYMENT_SUBMITTED → COMPLETED | DISPUTED | CANCELLED
DISPUTED → RESOLVED_RELEASE | RESOLVED_REFUND       (admin only)
```

## Iron rules

- Escrow is **ledger-level**: lock = `user_available → user_escrow` journal. No on-chain movement.
- Every transition happens inside ONE transaction that: locks the trade row `FOR UPDATE` FIRST,
  runs a guarded `UPDATE ... WHERE status = <from>`, inserts a `trade_events` row, and writes an
  `outbox` event — all or nothing. Use `EscrowService.transition()`; never hand-roll.
- Release splits exactly: escrow −amount / buyer +(amount−fee) / treasury +fee.
  Refund returns the FULL amount to the seller (no fee on refunds) and **restocks the offer**
  (lock order: trade → offer → balances).
- `DISPUTED` freezes funds absolutely. The ONLY path out is `EscrowService.resolveDispute()`
  with an `admin:<id>` actor. Confirm, cancel, and the expiry job must all no-op/reject on it.
- Confirm is **idempotent**: second confirm returns the completed trade, funds move once.
- The expiry job re-checks status + deadline under the row lock; races resolve to exactly one
  terminal state.
- Trade opening (TradesService.openTrade) is the single serialization point against offer
  oversell: offer row `FOR UPDATE` + guarded `remaining >= amount` decrement.

## NEVER do

- NEVER `UPDATE trades SET status = ...` anywhere outside `EscrowService.transition()`.
- NEVER release or refund escrow from the disputes/admin/chat modules directly — they call
  the escrow service.
- NEVER add a transition without: updating `trade_transitions` seed (migration), the service
  checks, tests for the new legal pair AND its illegal inverses, and a Deviations Log entry.
- NEVER trust payment proof as automatic — the seller's explicit confirm is the release trigger
  ("a screenshot is not money").

## Tests

Gate 4 suite: `backend/src/modules/escrow/escrow.integration.spec.ts` — extend it for every
change (oversell concurrency, double-confirm, dispute freeze, expiry race are the templates).
Gate record: `Documents/audits/gate-4.md`.
