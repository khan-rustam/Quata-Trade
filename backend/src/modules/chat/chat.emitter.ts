import { Injectable } from "@nestjs/common";
import { tradeRoom } from "./chat.validators";

/**
 * Minimal structural view of a socket.io Server/Namespace — keeps the emitter
 * decoupled from the gateway (no circular DI) and trivially mockable in tests.
 */
export interface TradeRoomTarget {
  to(room: string): { emit(event: string, payload: unknown): boolean };
}

/**
 * The one door for pushing realtime events into a trade room. ChatService uses
 * it for new messages; the outbox relay / escrow event consumers may call
 * emitToTrade(tradeId, CHAT_EVENTS.status, ...) on trade status changes later.
 * Emits are best-effort: REST + DB are the source of truth, sockets are a mirror.
 */
@Injectable()
export class ChatEmitterService {
  private target: TradeRoomTarget | null = null;

  /** Called once by ChatGateway.afterInit with the "/trades" namespace. */
  bind(target: TradeRoomTarget): void {
    this.target = target;
  }

  emitToTrade(tradeId: string, event: string, payload: unknown): void {
    this.target?.to(tradeRoom(tradeId)).emit(event, payload);
  }
}
