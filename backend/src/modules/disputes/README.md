# disputes

User endpoints: `POST /trades/:id/dispute`, `POST /disputes/:id/evidence`, `GET /disputes/:id`,
`POST /disputes/:id/upload`. Admin side (`queue`, `resolve`) is service-only — the admin module
wraps `DisputesAdminService` behind `@Roles("SUPER_ADMIN","COMPLIANCE_ADMIN","SUPPORT_ADMIN")`.

**Invariants**
- This module NEVER writes ledger tables or `trades.status`. Freezing goes through `EscrowService.markDisputed` (one money tx: trade lock → disputes insert → FSM → outbox `dispute.opened` → audit); money moves ONLY through `EscrowService.resolveDispute`.
- One dispute per trade, ever (UNIQUE trade_id → 409). Only buyer/seller may open/read/submit; strangers get 404.
- Dispute status stepping (OPEN → AWAITING_EVIDENCE → UNDER_REVIEW) touches the disputes table only; RESOLVED is written idempotently after escrow resolution (guarded update — crash between the two steps heals on retry; outbox `dispute.resolved` + audit exactly once).
- Evidence uploads: base64 → magic-byte whitelist (jpeg/png/webp/pdf, no SVG), 5MB cap, private `disputes` bucket, key `<disputeId>/<uuidv7><ext>`; served only via short-TTL presigned URLs.

**Retention / export:** dispute evidence and the trade's chat (`trade_messages`) are the export
record for a case — messages are retained ≥ the trade retention window and MUST NOT be hard-deleted
while a trade is disputed or a resolved dispute is inside the retention window (Documents/04 §4.6).
