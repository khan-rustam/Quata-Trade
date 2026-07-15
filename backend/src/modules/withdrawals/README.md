# withdrawals

Purpose: request → risk score → (dual) approval → signer handoff → settle/refund (Documents/06).
Money model: debit at REQUEST time `user_available → platform_pending_sweep` (reason `withdrawal_debit`,
key = client idempotency key); on CONFIRMED settle `pending_sweep → external + treasury(fee)`
(reason `withdrawal_fee`, key `withdrawal:<id>:settle`); on REJECTED/FAILED refund (reason
`adjustment`, key `withdrawal:<id>:refund`). All movement ONLY via LedgerService.postJournal.
Invariants: TOTP + PIN + KYC tier ≥ 1 required; per-tx/daily/tier caps enforced here AND in the
signer AND by DB CHECK; `>= dual_approval_threshold` needs two DIFFERENT admins; every status
change is a guarded UPDATE (`WHERE status = expected`); every action audit-logged + outbox event.
Callers: users via HTTP (`POST/GET /withdrawals`); admin module calls `approve`/`reject`;
the signer module's pipeline calls `claimForSigning`/`markBroadcast`/`settleConfirmed`/`markFailed`.
NOTE: TOTP-secret encryption/decryption uses the single shared helper
`common/crypto.ts` (AES-256-GCM, `iv‖tag‖ciphertext`) — the former duplicate
`secret-crypto.ts` was removed to keep one source of truth for the layout.
