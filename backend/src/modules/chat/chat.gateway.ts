import { JwtService } from "@nestjs/jwt";
import {
  ConnectedSocket,
  MessageBody,
  SubscribeMessage,
  WebSocketGateway,
  type OnGatewayConnection,
  type OnGatewayInit,
} from "@nestjs/websockets";
import type { DefaultEventsMap, Namespace, Socket } from "socket.io";
import { z } from "zod";
import { zUuid } from "@quatatrade/shared";
import type { AccessTokenPayload } from "../../common/auth/jwt.types";
import { ChatEmitterService } from "./chat.emitter";
import { ChatService } from "./chat.service";
import { canJoinTradeRoom, tradeRoom } from "./chat.validators";

interface ChatSocketData {
  auth?: AccessTokenPayload;
}

type ChatSocket = Socket<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap, ChatSocketData>;
type ChatNamespace = Namespace<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap, ChatSocketData>;

const zJoinPayload = z.object({ tradeId: zUuid }).strict();

/**
 * Realtime chat gateway — socket.io namespace "/trades", one room per trade
 * ("trade:<id>"). Handshake carries the SAME short-lived JWT as REST in
 * auth.token; unauthenticated sockets are dropped immediately. A socket only
 * enters a room after canJoinTradeRoom proves it is the buyer, the seller, or
 * an admin (read-only monitor). Failures are silent/generic — no enumeration.
 */
// Pin the WS CORS origin to the web app (matches the REST CORS), rather than
// reflecting any Origin. Read from env at load time (the gateway decorator runs
// before DI); the handshake is still bearer-token authed, never an ambient cookie.
@WebSocketGateway({
  namespace: "/trades",
  cors: { origin: process.env.WEB_ORIGIN || "http://localhost:3000", credentials: true },
})
export class ChatGateway implements OnGatewayInit<ChatNamespace>, OnGatewayConnection<ChatSocket> {
  constructor(
    private readonly jwt: JwtService,
    private readonly chat: ChatService,
    private readonly emitter: ChatEmitterService,
  ) {}

  afterInit(server: ChatNamespace): void {
    this.emitter.bind(server); // ChatService & future outbox relay emit through this
  }

  async handleConnection(client: ChatSocket): Promise<void> {
    const payload = await this.verifyHandshake(client);
    if (!payload) {
      client.disconnect(true); // generic drop — never explain why
      return;
    }
    client.data.auth = payload;
  }

  private async verifyHandshake(client: ChatSocket): Promise<AccessTokenPayload | null> {
    const auth: Record<string, unknown> = client.handshake.auth;
    const token = auth["token"];
    if (typeof token !== "string" || token.length === 0) return null;
    try {
      const payload = await this.jwt.verifyAsync<AccessTokenPayload>(token);
      if (payload.typ !== "user" && payload.typ !== "admin") return null;
      return payload;
    } catch {
      return null; // expired/forged — same silence either way
    }
  }

  /** Client asks to join a trade room; ack {ok} only — no detail on denial. */
  @SubscribeMessage("trade:join")
  async onTradeJoin(
    @ConnectedSocket() client: ChatSocket,
    @MessageBody() body: unknown,
  ): Promise<{ ok: boolean }> {
    const auth = client.data.auth;
    if (!auth) return { ok: false };

    const parsed = zJoinPayload.safeParse(body);
    if (!parsed.success) return { ok: false };

    const trade = await this.chat.getTradeParties(parsed.data.tradeId);
    if (!trade) return { ok: false };
    if (!canJoinTradeRoom({ typ: auth.typ, sub: auth.sub }, trade)) return { ok: false };

    await client.join(tradeRoom(parsed.data.tradeId));
    return { ok: true };
  }
}
