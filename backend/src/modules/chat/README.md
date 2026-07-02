# chat

Per-trade messaging: REST (`GET/POST /trades/:id/messages`, `POST /trades/:id/attachments`)
plus a socket.io gateway on namespace `/trades` with one room per trade (`trade:<id>`).

**Invariants**
- Party-scoped everywhere: only the trade's buyer/seller read or write; strangers get 404 (no IDOR leak). Admins are read-only monitors (`listMessagesForAdmin`, room join with `typ=admin`) — no admin REST route here (admin module owns that).
- Writes allowed only while status ∈ OPENED / ESCROW_LOCKED / PAYMENT_SUBMITTED / DISPUTED; read-only after.
- Attachments: base64 → strict decode → 3MB cap → magic-byte whitelist (jpeg/png/webp; **no SVG, no PDF**) → private `chat` bucket, key `<tradeId>/<uuidv7><ext>`; served only via short-TTL (120s) presigned URLs. Message sends re-verify the key prefix (no cross-trade references).
- Retention: `trade_messages` are never deleted here — retained ≥ trade retention window for dispute export; no hard delete while the trade is disputed (Documents/04 §4.6).
- Sockets: handshake JWT in `auth.token`, verified before any room join; emits are best-effort mirrors — DB rows are the source of truth.

**Who may call:** ChatController (users), ChatGateway (users/admins), disputes/admin modules read via `ChatService`; anyone may push room events via `ChatEmitterService.emitToTrade` (e.g. outbox relay for `CHAT_EVENTS.status`).
