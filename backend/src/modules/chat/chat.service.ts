import { Inject, Injectable } from "@nestjs/common";
import type { Kysely, Selectable } from "kysely";
import { CHAT_EVENTS, type SendMessageRequest, type TradeStatus } from "@quatatrade/shared";
import { DB } from "../../db/database.module";
import type { Database, TradeMessagesTable } from "../../db/types";
import { newId } from "../../common/ids";
import { MinioService } from "../../common/storage/minio.service";
import { ChatAccessError, ChatReadOnlyError, InvalidAttachmentError } from "./chat.errors";
import { ChatEmitterService } from "./chat.emitter";
import {
  CHAT_PRESIGN_TTL_SECONDS,
  isAttachmentKeyForTrade,
  isChatWritable,
  validateChatAttachment,
  type TradeParties,
} from "./chat.validators";

/** Wire shape of one message (matches shared zTradeMessage). */
export interface TradeMessageView {
  id: string;
  tradeId: string;
  senderId: string;
  body: string | null;
  /** short-TTL presigned URL resolved at read time — object keys never leave the backend raw */
  attachmentUrl: string | null;
  createdAt: string;
}

export interface MessagesView {
  messages: TradeMessageView[];
}

export interface TradeChatContext extends TradeParties {
  status: TradeStatus;
}

/**
 * chat — per-trade messaging (Documents/06 "chat").
 * Party-scoped everywhere; attachments live in the private "chat" bucket and
 * are only ever served through short-TTL presigned URLs. Message rows are
 * retained for dispute export (see README) — no delete paths exist here.
 */
@Injectable()
export class ChatService {
  constructor(
    @Inject(DB) private readonly db: Kysely<Database>,
    private readonly minio: MinioService,
    private readonly emitter: ChatEmitterService,
  ) {}

  /** Parties + status lookup — also used by the gateway for room authorization. */
  async getTradeParties(tradeId: string): Promise<TradeChatContext | null> {
    const trade = await this.db
      .selectFrom("trades")
      .select(["buyer_id", "seller_id", "status"])
      .where("id", "=", tradeId)
      .executeTakeFirst();
    if (!trade) return null;
    return { buyerId: trade.buyer_id, sellerId: trade.seller_id, status: trade.status };
  }

  private async requireParty(tradeId: string, userId: string): Promise<TradeChatContext> {
    const trade = await this.getTradeParties(tradeId);
    if (!trade || (trade.buyerId !== userId && trade.sellerId !== userId)) {
      throw new ChatAccessError(); // 404 either way — never confirm a foreign trade exists
    }
    return trade;
  }

  async listMessages(tradeId: string, userId: string): Promise<MessagesView> {
    await this.requireParty(tradeId, userId);
    return { messages: await this.loadMessages(tradeId) };
  }

  /**
   * Read-only admin monitor (Documents/06 chat). No HTTP route here — the
   * admin module exposes it later behind @Roles; RolesGuard keeps admin
   * tokens off the user-scoped REST routes above.
   */
  async listMessagesForAdmin(tradeId: string): Promise<MessagesView> {
    const trade = await this.getTradeParties(tradeId);
    if (!trade) throw new ChatAccessError();
    return { messages: await this.loadMessages(tradeId) };
  }

  async sendMessage(tradeId: string, userId: string, dto: SendMessageRequest): Promise<TradeMessageView> {
    const trade = await this.requireParty(tradeId, userId);
    if (!isChatWritable(trade.status)) throw new ChatReadOnlyError(trade.status);
    if (dto.attachmentKey !== undefined && !isAttachmentKeyForTrade(dto.attachmentKey, tradeId)) {
      throw new InvalidAttachmentError("attachment does not belong to this trade");
    }

    const row = await this.db
      .insertInto("trade_messages")
      .values({
        id: newId(),
        trade_id: tradeId,
        sender_id: userId,
        body: dto.body ?? null,
        attachment_key: dto.attachmentKey ?? null,
      })
      .returningAll()
      .executeTakeFirstOrThrow();

    const view = await this.toView(row);
    this.emitter.emitToTrade(tradeId, CHAT_EVENTS.message, view); // best-effort mirror
    return view;
  }

  /**
   * Base64 upload → strict decode → 3MB cap → magic-byte whitelist
   * (jpeg/png/webp ONLY — no PDF, no SVG) → private "chat" bucket.
   * Key is `<tradeId>/<uuidv7><ext>` so message sends can enforce trade scoping.
   */
  async uploadAttachment(tradeId: string, userId: string, base64: string): Promise<{ key: string }> {
    const trade = await this.requireParty(tradeId, userId);
    if (!isChatWritable(trade.status)) throw new ChatReadOnlyError(trade.status);

    const result = validateChatAttachment(base64);
    if (!result.ok) throw new InvalidAttachmentError(result.reason);

    const key = `${tradeId}/${newId()}${result.file.ext}`;
    await this.minio.putObject("chat", key, result.file.buffer, result.file.mime);
    return { key };
  }

  private async loadMessages(tradeId: string): Promise<TradeMessageView[]> {
    const rows = await this.db
      .selectFrom("trade_messages")
      .selectAll()
      .where("trade_id", "=", tradeId)
      .orderBy("created_at", "asc")
      .execute();
    return Promise.all(rows.map((row) => this.toView(row)));
  }

  private async toView(row: Selectable<TradeMessagesTable>): Promise<TradeMessageView> {
    return {
      id: row.id,
      tradeId: row.trade_id,
      senderId: row.sender_id,
      body: row.body,
      attachmentUrl: row.attachment_key
        ? await this.minio.presignedGet("chat", row.attachment_key, CHAT_PRESIGN_TTL_SECONDS)
        : null,
      createdAt: row.created_at.toISOString(),
    };
  }
}
