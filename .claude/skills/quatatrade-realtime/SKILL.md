---
name: quatatrade-realtime
description: Socket.IO / realtime rules for QuataTrade — trade rooms, chat, admin monitoring, live notifications. Use when touching backend/src/modules/chat, any gateway, socket event, room join, or frontend realtime subscription. Triggers on socket, socket.io, websocket, gateway, room, namespace, emit, subscribe, realtime, live, chat, presence, typing.
---

# QuataTrade Realtime Rules

Authority: `Documents/02-tech-stack.md` (WebSockets) + `Documents/07-frontend-spec.md`
(Trade Room) + `Documents/08-security-checklist.md` §E/§F.
Implementation: `backend/src/modules/chat/`; Redis is the socket adapter so rooms work
across processes.

## Authorization is per-room, per-event, every time

A socket connection being authenticated says **who** the user is. It says nothing about
what they may see. Therefore:

- **Authorize on `join`**, against the resource: only the buyer, the seller, and admins
  may join `trade:<id>`. Re-check on join every time — a socket that joined a trade
  legitimately must not keep receiving events after the user loses access.
- **Authorize on every inbound event too**, not just on join. Room membership is not a
  permission; a client can emit any event name with any payload.
- The admin monitor namespace is separate and RBAC-gated. Never widen a user-facing room
  to carry admin-only fields and rely on the client to hide them.
- Never trust a `userId`, `role`, `tradeId` or amount that arrives in a socket payload.
  Derive identity from the session, and re-read the resource from the DB.

This is the same IDOR surface as HTTP, with less scrutiny — cross-user room access must
have a test that asserts denial and asserts nothing leaks.

## What may cross the wire

- Chat messages, presence/typing, trade status transitions, countdown ticks,
  notification pushes.
- Amounts follow the same wire rule as HTTP: BIGINT-safe **decimal strings**, never
  numbers, and the frontend never does arithmetic on them.
- Payment proof arrives as an upload through the HTTP path (`quatatrade-uploads`), then
  the socket announces it. Never stream file bytes over the socket.
- **Never emit** a secret, token, full address of a key, KYC field, or another user's
  PII. Counterparty payloads are whitelisted to what the trade screen needs.

## Trust boundary with the state machine

A socket event is a **notification that state changed**, never the thing that changes it.
Status transitions happen only through `EscrowService` inside a DB transaction
(`quatatrade-escrow-fsm`); the gateway emits *after* commit. A client must never be able
to drive a trade transition by emitting an event, and the UI must never treat an inbound
socket event as authoritative for a balance — refetch through TanStack Query.

## Reliability

- Sockets are lossy. Every realtime surface needs a non-realtime source of truth:
  reconnect must resync from the API, not assume the client missed nothing.
- No optimistic rendering of money or trade state from a socket event.
- Chat text is escaped on render (XSS — §08 §F); CSP via helmet. User text is never
  inserted as HTML.
- Rate-limit inbound events per socket and per user, same as HTTP auth endpoints —
  a chat flood is a cheap DoS and a spam vector.
- Clean up listeners on unmount in the frontend; a leaked listener double-handles events
  after navigation.

## NEVER do

- NEVER authorize a room join from client-supplied identity or role.
- NEVER emit an event to a room without checking every recipient is entitled to the
  payload — broadcast is not a permission model.
- NEVER let a socket event mutate trade/escrow status, balances, or the ledger.
- NEVER send tokens, keys, mnemonics, KYC fields, or full PII over a socket.
- NEVER treat a socket message as proof of payment or as authority for a balance.
- NEVER skip the reconnect resync path — "it works on a stable connection" is not a
  standard this market can hold.
