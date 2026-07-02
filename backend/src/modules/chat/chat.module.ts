import { Module } from "@nestjs/common";
import { StorageModule } from "../../common/storage/storage.module";
import { ChatService } from "./chat.service";
import { ChatEmitterService } from "./chat.emitter";
import { ChatGateway } from "./chat.gateway";
import { ChatController } from "./chat.controller";

/**
 * chat — per-trade messaging: REST + socket.io gateway (namespace "/trades").
 * Exports ChatEmitterService so the outbox relay / escrow event consumers can
 * push CHAT_EVENTS.status into trade rooms without touching the gateway.
 */
@Module({
  imports: [StorageModule],
  controllers: [ChatController],
  providers: [ChatService, ChatEmitterService, ChatGateway],
  exports: [ChatService, ChatEmitterService],
})
export class ChatModule {}
