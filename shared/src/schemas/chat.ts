import { z } from "zod";
import { zUuid } from "./common.js";

export const zSendMessageRequest = z
  .object({
    body: z.string().trim().min(1).max(2000).optional(),
    /** MinIO object key from the trade-attachment upload endpoint */
    attachmentKey: z.string().max(512).optional(),
  })
  .strict()
  .refine((m) => m.body !== undefined || m.attachmentKey !== undefined, {
    message: "Message must have text or an attachment",
  });
export type SendMessageRequest = z.infer<typeof zSendMessageRequest>;

export const zTradeMessage = z.object({
  id: zUuid,
  tradeId: zUuid,
  senderId: zUuid,
  body: z.string().nullable(),
  /** short-TTL presigned URL, resolved server-side at read time */
  attachmentUrl: z.string().nullable(),
  createdAt: z.string(),
});
export type TradeMessage = z.infer<typeof zTradeMessage>;

export const zMessagesResponse = z.object({
  messages: z.array(zTradeMessage),
});

/** Socket.IO event names for the per-trade room. */
export const CHAT_EVENTS = {
  message: "trade:message",
  status: "trade:status",
  typing: "trade:typing",
} as const;
