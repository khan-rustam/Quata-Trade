import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  Get,
  NotFoundException,
  Param,
  Post,
} from "@nestjs/common";
import { z } from "zod";
import { zSendMessageRequest, zUuid, type SendMessageRequest } from "@quatatrade/shared";
import { ZodPipe } from "../../common/zod.pipe";
import { CurrentUserId } from "../../common/auth/decorators";
import { ChatService, type MessagesView, type TradeMessageView } from "./chat.service";
import { ChatAccessError, ChatReadOnlyError, InvalidAttachmentError } from "./chat.errors";

/**
 * Local upload schema — @quatatrade/shared is frozen and ships no upload
 * schema; strict + length-capped (3MB binary ≈ 4MB base64 chars).
 */
const zChatUploadRequest = z
  .object({
    /** raw base64 (no data: URL prefix) */
    file: z.string().min(4).max(4_300_000),
  })
  .strict();
type ChatUploadRequest = z.infer<typeof zChatUploadRequest>;

@Controller()
export class ChatController {
  constructor(private readonly chat: ChatService) {}

  @Get("trades/:id/messages")
  async listMessages(
    @CurrentUserId() userId: string,
    @Param("id", new ZodPipe(zUuid)) tradeId: string,
  ): Promise<MessagesView> {
    return this.mapErrors(() => this.chat.listMessages(tradeId, userId));
  }

  @Post("trades/:id/messages")
  async sendMessage(
    @CurrentUserId() userId: string,
    @Param("id", new ZodPipe(zUuid)) tradeId: string,
    @Body(new ZodPipe(zSendMessageRequest)) dto: SendMessageRequest,
  ): Promise<TradeMessageView> {
    return this.mapErrors(() => this.chat.sendMessage(tradeId, userId, dto));
  }

  @Post("trades/:id/attachments")
  async uploadAttachment(
    @CurrentUserId() userId: string,
    @Param("id", new ZodPipe(zUuid)) tradeId: string,
    @Body(new ZodPipe(zChatUploadRequest)) dto: ChatUploadRequest,
  ): Promise<{ key: string }> {
    return this.mapErrors(() => this.chat.uploadAttachment(tradeId, userId, dto.file));
  }

  /** Domain errors → HTTP; anything else bubbles to the global filter. */
  private async mapErrors<T>(fn: () => Promise<T>): Promise<T> {
    try {
      return await fn();
    } catch (err) {
      if (err instanceof ChatAccessError) throw new NotFoundException("trade not found");
      if (err instanceof ChatReadOnlyError) throw new ConflictException(err.message);
      if (err instanceof InvalidAttachmentError) throw new BadRequestException(err.message);
      throw err;
    }
  }
}
