import type { TradeStatus } from "@quatatrade/shared";

/**
 * Pure, dependency-free validators for the chat module — extracted so
 * chat.spec.ts can unit-test the magic-byte whitelist and room authorization
 * without booting Nest (Documents/08 §F: magic-byte check, SVG banned,
 * size limits; §E: IDOR — party scoping everywhere).
 */

/** Hard cap for chat attachments (binary size after base64 decode). */
export const CHAT_ATTACHMENT_MAX_BYTES = 3 * 1024 * 1024;

/** Presigned URLs for chat attachments are short-lived (Documents/08 §F). */
export const CHAT_PRESIGN_TTL_SECONDS = 120;

export interface SniffedImage {
  mime: "image/jpeg" | "image/png" | "image/webp";
  ext: ".jpg" | ".png" | ".webp";
}

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] as const;

/**
 * Magic-byte sniffing — the CONTENT decides the type, never a client header.
 * Whitelist: JPEG, PNG, WEBP. SVG (text/xml) can never match — banned by design.
 */
export function sniffImageType(buf: Buffer): SniffedImage | null {
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) {
    return { mime: "image/jpeg", ext: ".jpg" };
  }
  if (buf.length >= 8 && PNG_SIGNATURE.every((byte, i) => buf[i] === byte)) {
    return { mime: "image/png", ext: ".png" };
  }
  if (buf.length >= 12 && buf.toString("latin1", 0, 4) === "RIFF" && buf.toString("latin1", 8, 12) === "WEBP") {
    return { mime: "image/webp", ext: ".webp" };
  }
  return null;
}

/**
 * Strict base64 decode: whitespace tolerated, everything else rejected
 * (padding only at the end, length multiple of 4, no data: URL prefixes).
 */
export function decodeBase64Strict(input: string): Buffer | null {
  const compact = input.replace(/\s+/g, "");
  if (compact.length === 0 || compact.length % 4 !== 0) return null;
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(compact)) return null;
  return Buffer.from(compact, "base64");
}

export interface ValidatedAttachment {
  buffer: Buffer;
  mime: string;
  ext: string;
}

export type AttachmentValidation = { ok: true; file: ValidatedAttachment } | { ok: false; reason: string };

/** Full pipeline for a chat attachment: base64 → size cap → magic-byte whitelist. */
export function validateChatAttachment(base64: string): AttachmentValidation {
  const buffer = decodeBase64Strict(base64);
  if (!buffer) return { ok: false, reason: "malformed base64 payload" };
  if (buffer.length === 0) return { ok: false, reason: "empty file" };
  if (buffer.length > CHAT_ATTACHMENT_MAX_BYTES) return { ok: false, reason: "file exceeds the 3MB limit" };
  const sniffed = sniffImageType(buffer);
  if (!sniffed) return { ok: false, reason: "unsupported file type (jpeg, png, webp only)" };
  return { ok: true, file: { buffer, mime: sniffed.mime, ext: sniffed.ext } };
}

/** Chat stays writable while the trade is live or frozen in dispute; read-only after. */
export const CHAT_WRITABLE_STATUSES: readonly TradeStatus[] = [
  "OPENED",
  "ESCROW_LOCKED",
  "PAYMENT_SUBMITTED",
  "DISPUTED",
];

export function isChatWritable(status: TradeStatus): boolean {
  return CHAT_WRITABLE_STATUSES.includes(status);
}

export interface RoomPrincipal {
  typ: "user" | "admin";
  sub: string;
}

export interface TradeParties {
  buyerId: string;
  sellerId: string;
}

/**
 * Room authorization: only the trade's buyer/seller may join; admin tokens
 * join read-only for monitoring (Documents/06 chat: admin monitor read-only).
 */
export function canJoinTradeRoom(principal: RoomPrincipal, parties: TradeParties): boolean {
  if (principal.typ === "admin") return true;
  return principal.sub === parties.buyerId || principal.sub === parties.sellerId;
}

/** Socket.IO room name for a trade. */
export function tradeRoom(tradeId: string): string {
  return `trade:${tradeId}`;
}

/**
 * An attachment key sent with a message must have been uploaded for THIS trade
 * (keys are `<tradeId>/<uuid><ext>`) — blocks cross-trade object references.
 */
export function isAttachmentKeyForTrade(key: string, tradeId: string): boolean {
  return key.startsWith(`${tradeId}/`) && !key.includes("..");
}
