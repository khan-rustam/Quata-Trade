import { describe, expect, it } from "vitest";
import {
  CHAT_ATTACHMENT_MAX_BYTES,
  canJoinTradeRoom,
  decodeBase64Strict,
  isAttachmentKeyForTrade,
  isChatWritable,
  sniffImageType,
  tradeRoom,
  validateChatAttachment,
} from "./chat.validators";

const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01]);
const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d]);
const WEBP = Buffer.concat([Buffer.from("RIFF"), Buffer.from([0x24, 0x00, 0x00, 0x00]), Buffer.from("WEBPVP8 ")]);
const PDF = Buffer.from("%PDF-1.7\n%something");
const SVG = Buffer.from(`<?xml version="1.0"?><svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>`);
const GIF = Buffer.from("GIF89a\x01\x00\x01\x00");

describe("decodeBase64Strict", () => {
  it("decodes valid base64 exactly", () => {
    const buf = decodeBase64Strict(JPEG.toString("base64"));
    expect(buf).not.toBeNull();
    expect(buf?.equals(JPEG)).toBe(true);
  });

  it("tolerates whitespace/newlines inside the payload", () => {
    const b64 = PNG.toString("base64");
    const noisy = `${b64.slice(0, 4)}\n ${b64.slice(4)}`;
    expect(decodeBase64Strict(noisy)?.equals(PNG)).toBe(true);
  });

  it("rejects empty, bad-length, bad-alphabet, and data-URL inputs", () => {
    expect(decodeBase64Strict("")).toBeNull();
    expect(decodeBase64Strict("abc")).toBeNull(); // length % 4 !== 0
    expect(decodeBase64Strict("ab!c")).toBeNull(); // outside alphabet
    expect(decodeBase64Strict("ab=c")).toBeNull(); // padding only at the end
    expect(decodeBase64Strict(`data:image/png;base64,${PNG.toString("base64")}`)).toBeNull();
  });
});

describe("sniffImageType (magic bytes — content decides, never headers)", () => {
  it("recognizes jpeg / png / webp", () => {
    expect(sniffImageType(JPEG)?.mime).toBe("image/jpeg");
    expect(sniffImageType(PNG)?.mime).toBe("image/png");
    expect(sniffImageType(WEBP)?.mime).toBe("image/webp");
  });

  it("rejects SVG, PDF, GIF, empty, and truncated signatures", () => {
    expect(sniffImageType(SVG)).toBeNull(); // SVG banned by whitelist design
    expect(sniffImageType(PDF)).toBeNull(); // no PDF in chat
    expect(sniffImageType(GIF)).toBeNull();
    expect(sniffImageType(Buffer.alloc(0))).toBeNull();
    expect(sniffImageType(PNG.subarray(0, 4))).toBeNull();
    expect(sniffImageType(Buffer.from("RIFFxxxxNOPE"))).toBeNull(); // RIFF but not WEBP
  });

  it("is not fooled by a fake extension-style payload (plain text)", () => {
    expect(sniffImageType(Buffer.from("totally-a.jpg"))).toBeNull();
  });
});

describe("validateChatAttachment", () => {
  it("accepts a valid image up to exactly the 3MB cap", () => {
    const atCap = Buffer.concat([JPEG, Buffer.alloc(CHAT_ATTACHMENT_MAX_BYTES - JPEG.length)]);
    const result = validateChatAttachment(atCap.toString("base64"));
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.file.mime).toBe("image/jpeg");
      expect(result.file.ext).toBe(".jpg");
      expect(result.file.buffer.length).toBe(CHAT_ATTACHMENT_MAX_BYTES);
    }
  });

  it("rejects one byte over the cap", () => {
    const overCap = Buffer.concat([JPEG, Buffer.alloc(CHAT_ATTACHMENT_MAX_BYTES - JPEG.length + 1)]);
    const result = validateChatAttachment(overCap.toString("base64"));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toContain("3MB");
  });

  it("rejects malformed base64, empty files, and non-whitelisted types", () => {
    expect(validateChatAttachment("!!not-base64!!").ok).toBe(false);
    expect(validateChatAttachment("====").ok).toBe(false);
    expect(validateChatAttachment(SVG.toString("base64")).ok).toBe(false);
    expect(validateChatAttachment(PDF.toString("base64")).ok).toBe(false);
  });
});

describe("isChatWritable", () => {
  it("allows live + disputed trades, read-only for terminal statuses", () => {
    expect(isChatWritable("OPENED")).toBe(true);
    expect(isChatWritable("ESCROW_LOCKED")).toBe(true);
    expect(isChatWritable("PAYMENT_SUBMITTED")).toBe(true);
    expect(isChatWritable("DISPUTED")).toBe(true);
    expect(isChatWritable("COMPLETED")).toBe(false);
    expect(isChatWritable("CANCELLED")).toBe(false);
    expect(isChatWritable("EXPIRED")).toBe(false);
    expect(isChatWritable("RESOLVED_RELEASE")).toBe(false);
    expect(isChatWritable("RESOLVED_REFUND")).toBe(false);
  });
});

describe("canJoinTradeRoom (room authorization)", () => {
  const parties = { buyerId: "buyer-1", sellerId: "seller-1" };

  it("admits buyer and seller", () => {
    expect(canJoinTradeRoom({ typ: "user", sub: "buyer-1" }, parties)).toBe(true);
    expect(canJoinTradeRoom({ typ: "user", sub: "seller-1" }, parties)).toBe(true);
  });

  it("denies any other user — including one holding a party-looking id as admin sub", () => {
    expect(canJoinTradeRoom({ typ: "user", sub: "stranger" }, parties)).toBe(false);
    expect(canJoinTradeRoom({ typ: "user", sub: "" }, parties)).toBe(false);
  });

  it("admits admins (read-only monitor)", () => {
    expect(canJoinTradeRoom({ typ: "admin", sub: "admin-1" }, parties)).toBe(true);
  });
});

describe("attachment key scoping + room naming", () => {
  it("accepts only keys under the trade's own prefix", () => {
    expect(isAttachmentKeyForTrade("trade-a/file.jpg", "trade-a")).toBe(true);
    expect(isAttachmentKeyForTrade("trade-b/file.jpg", "trade-a")).toBe(false);
    expect(isAttachmentKeyForTrade("trade-a/../trade-b/file.jpg", "trade-a")).toBe(false);
    expect(isAttachmentKeyForTrade("file.jpg", "trade-a")).toBe(false);
  });

  it("builds room names as trade:<id>", () => {
    expect(tradeRoom("abc")).toBe("trade:abc");
  });
});
