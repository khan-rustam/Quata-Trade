import { Inject, Injectable } from "@nestjs/common";
import type { Kysely } from "kysely";
import { DB } from "../../db/database.module";
import type { Database } from "../../db/types";

/**
 * Thin persistence boundary for notify — an interface so the service's
 * dispatch logic is unit-testable with an in-memory store (no Kysely mocks,
 * no unchecked casts). KyselyNotifyStore is the production implementation.
 */

export const NOTIFY_STORE = Symbol("NOTIFY_STORE");

export interface NewNotification {
  id: string;
  userId: string;
  channel: "in_app" | "email";
  template: string;
  payload: Record<string, unknown>;
  status: "queued" | "delivered";
  deliveredAt: Date | null;
}

export interface QueuedEmail {
  id: string;
  userId: string;
  template: string;
  payload: Record<string, unknown>;
  attempts: number;
}

export interface NotificationListItem {
  id: string;
  channel: string;
  template: string;
  payload: Record<string, unknown>;
  readAt: Date | null;
  createdAt: Date;
}

export interface TradeParties {
  buyerId: string;
  sellerId: string;
  shortRef: string;
  amount: bigint;
}

export interface NotifyStore {
  insert(row: NewNotification): Promise<void>;
  /** email successfully handed to SMTP → delivered + delivered_at */
  markEmailDelivered(id: string): Promise<void>;
  /** SMTP failure → status stays queued, attempts + 1 */
  recordEmailFailure(id: string): Promise<void>;
  tradeParties(tradeId: string): Promise<TradeParties | null>;
  /** id → email for the given users (missing users simply absent) */
  userEmails(userIds: string[]): Promise<Map<string, string>>;
  /** queued email rows to (re)send: never-sent + retryable failures under maxAttempts */
  dueEmails(limit: number, maxAttempts: number): Promise<QueuedEmail[]>;
  listForUser(
    userId: string,
    page: number,
    pageSize: number,
  ): Promise<{ items: NotificationListItem[]; total: number }>;
  /** scoped by user — returns false when the row is not theirs / absent */
  markRead(userId: string, notificationId: string): Promise<boolean>;
}

@Injectable()
export class KyselyNotifyStore implements NotifyStore {
  constructor(@Inject(DB) private readonly db: Kysely<Database>) {}

  async insert(row: NewNotification): Promise<void> {
    await this.db
      .insertInto("notifications")
      .values({
        id: row.id,
        user_id: row.userId,
        channel: row.channel,
        template: row.template,
        payload: JSON.stringify(row.payload),
        status: row.status,
        delivered_at: row.deliveredAt,
      })
      .execute();
  }

  async markEmailDelivered(id: string): Promise<void> {
    await this.db
      .updateTable("notifications")
      .set({ status: "delivered", delivered_at: new Date() })
      .where("id", "=", id)
      .execute();
  }

  async recordEmailFailure(id: string): Promise<void> {
    await this.db
      .updateTable("notifications")
      .set((eb) => ({ attempts: eb("attempts", "+", 1) }))
      .where("id", "=", id)
      .execute();
  }

  async tradeParties(tradeId: string): Promise<TradeParties | null> {
    const row = await this.db
      .selectFrom("trades")
      .select(["buyer_id", "seller_id", "short_ref", "amount"])
      .where("id", "=", tradeId)
      .executeTakeFirst();
    if (!row) return null;
    return { buyerId: row.buyer_id, sellerId: row.seller_id, shortRef: row.short_ref, amount: row.amount };
  }

  async userEmails(userIds: string[]): Promise<Map<string, string>> {
    if (userIds.length === 0) return new Map();
    const rows = await this.db
      .selectFrom("users")
      .select(["id", "email"])
      .where("id", "in", userIds)
      .execute();
    return new Map(rows.map((r) => [r.id, r.email]));
  }

  async dueEmails(limit: number, maxAttempts: number): Promise<QueuedEmail[]> {
    const rows = await this.db
      .selectFrom("notifications")
      .select(["id", "user_id", "template", "payload", "attempts"])
      .where("channel", "=", "email")
      .where("status", "=", "queued")
      .where("attempts", "<", maxAttempts)
      .orderBy("created_at", "asc")
      .limit(limit)
      .execute();
    return rows.map((r) => ({
      id: r.id,
      userId: r.user_id,
      template: r.template,
      payload: r.payload,
      attempts: r.attempts,
    }));
  }

  async listForUser(
    userId: string,
    page: number,
    pageSize: number,
  ): Promise<{ items: NotificationListItem[]; total: number }> {
    const [rows, count] = await Promise.all([
      this.db
        .selectFrom("notifications")
        .select(["id", "channel", "template", "payload", "read_at", "created_at"])
        .where("user_id", "=", userId)
        .where("channel", "=", "in_app")
        .orderBy("created_at", "desc")
        .limit(pageSize)
        .offset((page - 1) * pageSize)
        .execute(),
      this.db
        .selectFrom("notifications")
        .select((eb) => eb.fn.countAll<bigint>().as("n"))
        .where("user_id", "=", userId)
        .where("channel", "=", "in_app")
        .executeTakeFirstOrThrow(),
    ]);
    return {
      items: rows.map((r) => ({
        id: r.id,
        channel: r.channel,
        template: r.template,
        payload: r.payload,
        readAt: r.read_at,
        createdAt: r.created_at,
      })),
      total: Number(count.n),
    };
  }

  async markRead(userId: string, notificationId: string): Promise<boolean> {
    const result = await this.db
      .updateTable("notifications")
      .set({ read_at: new Date() })
      .where("id", "=", notificationId)
      .where("user_id", "=", userId)
      .where("channel", "=", "in_app")
      .executeTakeFirst();
    return result.numUpdatedRows > 0n;
  }
}
