# signer (client side only)

Purpose: client contract for the ISOLATED Host B signer (Documents/03, backend/SIGNER.md)
plus the worker withdrawal pipeline. The REAL signer is human-authored and NOT in this repo.
Provides: `SIGNER_CLIENT` token → `MockSignerService` (SIGNER_MODE=mock, dev/testnet only,
throws if constructed in production) or `RemoteSignerService` (stub: validates mTLS config,
methods throw until the human-written transport lands).
Pipeline (`WithdrawalPipelineService`, worker @Cron 30s): APPROVED → SIGNING → BROADCAST →
CONFIRMED(+settle journal) / FAILED(+refund) — every step a guarded `WHERE status = expected`
UPDATE via WithdrawalsService; halted by the withdrawals kill switch.
Invariants: the signer re-verifies policy INDEPENDENTLY (status, per-tx cap, dual approval,
destination) — a compromised API cannot make it sign. Crash-stuck SIGNING rows are never
auto-refunded (may be on-chain); they require human reconciliation.
Callers: worker only (register `SignerModule` in worker.module); no HTTP endpoints.
