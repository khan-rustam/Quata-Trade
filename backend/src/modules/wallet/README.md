# wallet (watch-only)

Purpose: deposit-address derivation from the account xpub (m/44'/195'/0' → relative 0/N),
ledger-derived balances, own-deposit history, and QuataPay internal transfers.

Invariants:
- NO private key material ever enters this module — `derivation.ts` rejects xprv input.
- Balances come from the ledger, never from chain state.
- All money movement goes through `LedgerService.postJournal` (reason `internal_transfer`),
  idempotency key namespaced per sender.
- derivation_index is max+1 per asset under a pg advisory lock; UNIQUE constraints are the backstop.
- Recipient-lookup failures are generic (no user enumeration); transfers are PIN-gated via the
  `PIN_SERVICE` token (bind to auth's PinService in app.module; unbound → 503 fail-closed).

Callers: HTTP `/api/v1/wallet/*` (user JWT only). `WalletService` may be used by withdrawals/admin reads.
