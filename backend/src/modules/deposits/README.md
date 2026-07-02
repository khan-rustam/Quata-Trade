# deposits

Purpose: detect incoming USDT-TRC20 transfers to our watch-only addresses (scanner) and
credit them via the ledger once confirmation depth is reached (confirmation service).

Invariants:
- Credit only when: address is ours, token_contract EXACTLY equals canonical USDT,
  height − block_number ≥ DEPOSIT_CONFIRMATIONS, status still SEEN/CONFIRMING.
- Idempotent end-to-end: UNIQUE(tx_hash, log_index) upsert on record; journal
  idempotencyKey `deposit:<tx_hash>:<log_index>`; status flip CREDITED + outbox
  `deposit.credited` in the SAME transaction as postJournal.
- Dust (< DEPOSIT_MIN_AMOUNT) recorded as IGNORED_DUST, never credited.
- block_number null (unproven/orphan candidates) is never credited — skipped until resolved.
- RPC failures: log + skip; after 5 consecutive failures each service pauses 5 minutes.

Callers: NO HTTP surface. Cron providers run in the worker only (import DepositsModule
in worker.module). TronGrid access goes through the TRONGRID_CLIENT token (faked in tests).
