import { describe, expect, it } from "vitest";
import type { Mailer } from "./notify.mailer";
import { planDispatch, safeContext } from "./notify.plan";
import { NotifyService } from "./notify.service";
import type {
  NewNotification,
  NotificationListItem,
  NotifyStore,
  QueuedEmail,
  TradeParties,
} from "./notify.store";
import { renderTemplate, TEMPLATE_NAMES } from "./notify.templates";

/* ------------------------------------------------------------------ */
/* template rendering                                                  */
/* ------------------------------------------------------------------ */

const FULL_CONTEXT: Record<string, string> = {
  shortRef: "QT-8F3K2",
  amountDisplay: "12.50",
  addressPreview: "TR7N…gjLj",
  resolution: "RELEASE_TO_BUYER",
  status: "APPROVED",
  tier: "2",
};

describe("renderTemplate", () => {
  it("renders every template with non-empty subject and body, no leftover handlebars", () => {
    for (const name of TEMPLATE_NAMES) {
      const { subject, body } = renderTemplate(name, FULL_CONTEXT);
      expect(subject.length, name).toBeGreaterThan(0);
      expect(body.length, name).toBeGreaterThan(0);
      expect(subject, name).not.toContain("{{");
      expect(body, name).not.toContain("{{");
    }
  });

  it("interpolates the trade reference and display amount", () => {
    const { subject, body } = renderTemplate("trade_escrow_locked", FULL_CONTEXT);
    expect(subject).toContain("QT-8F3K2");
    expect(body).toContain("12.50 USDT");
  });

  it("degrades gracefully when optional context is missing", () => {
    const { body } = renderTemplate("deposit_credited", {});
    expect(body).toContain("Your deposit");
    expect(body).not.toContain("undefined");
  });
});

/* ------------------------------------------------------------------ */
/* event → plan mapping                                                */
/* ------------------------------------------------------------------ */

describe("planDispatch mapping", () => {
  const userPayload = { userId: "u-1" };
  const tradePayload = { tradeId: "t-1" };

  it.each([
    ["deposit.credited", "deposit_credited"],
    ["withdrawal.requested", "withdrawal_requested"],
    ["withdrawal.confirmed", "withdrawal_confirmed"],
    ["kyc.submitted", "kyc_submitted"],
    ["kyc.reviewed", "kyc_reviewed"],
  ])("%s → %s for the payload user", (eventType, template) => {
    const plan = planDispatch(eventType, userPayload);
    expect(plan).toEqual({ template, recipients: ["u-1"], tradeId: null });
  });

  it.each([
    ["trade.escrow_locked", "trade_escrow_locked"],
    ["trade.payment_submitted", "trade_payment_submitted"],
    ["trade.completed", "trade_completed"],
    ["trade.expired", "trade_expired"],
    ["trade.cancelled", "trade_cancelled"],
    ["trade.disputed", "trade_disputed"],
    ["dispute.resolved", "dispute_resolved"],
  ])("%s → %s addressed to both trade parties", (eventType, template) => {
    const plan = planDispatch(eventType, tradePayload);
    expect(plan).toEqual({ template, recipients: [], tradeId: "t-1" });
  });

  it("returns null for unmapped events and malformed payloads", () => {
    expect(planDispatch("ledger.posted", { journalId: "j-1" })).toBeNull();
    expect(planDispatch("user.registered", {})).toBeNull();
    expect(planDispatch("trade.completed", { tradeId: 42 })).toBeNull();
  });
});

describe("safeContext whitelist", () => {
  it("converts amount strings to display strings only", () => {
    expect(safeContext({ amount: "12500000" })["amountDisplay"]).toBe("12.50");
    expect(safeContext({ amount: "not-a-number" })["amountDisplay"]).toBeUndefined();
  });

  it("masks addresses — the full address never appears", () => {
    const address = "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj2B";
    const ctx = safeContext({ toAddress: address });
    expect(ctx["addressPreview"]).toBe("TR7N…Lj2B");
    expect(Object.values(ctx).some((v) => v.includes(address))).toBe(false);
  });

  it("drops unknown fields — secrets and codes can never leak into templates", () => {
    const ctx = safeContext({
      shortRef: "QT-AAAAA",
      otpCode: "123456",
      passwordHash: "$argon2id$...",
      refreshToken: "abc",
    });
    expect(ctx).toEqual({ shortRef: "QT-AAAAA" });
  });

  it("maps trade transition 'to' onto status and stringifies tier", () => {
    expect(safeContext({ to: "COMPLETED" })["status"]).toBe("COMPLETED");
    expect(safeContext({ tier: 2 })["tier"]).toBe("2");
  });
});

/* ------------------------------------------------------------------ */
/* dispatch with mocked store + transport                              */
/* ------------------------------------------------------------------ */

type StoredRow = NewNotification & { attempts: number };

class MemoryStore implements NotifyStore {
  rows: StoredRow[] = [];
  trades = new Map<string, TradeParties>();
  emails = new Map<string, string>();

  async insert(row: NewNotification): Promise<void> {
    this.rows.push({ ...row, attempts: 0 });
  }
  async markEmailDelivered(id: string): Promise<void> {
    const row = this.rows.find((r) => r.id === id);
    if (row) {
      row.status = "delivered";
      row.deliveredAt = new Date();
    }
  }
  async recordEmailFailure(id: string): Promise<void> {
    const row = this.rows.find((r) => r.id === id);
    if (row) row.attempts += 1;
  }
  async tradeParties(tradeId: string): Promise<TradeParties | null> {
    return this.trades.get(tradeId) ?? null;
  }
  async userEmails(userIds: string[]): Promise<Map<string, string>> {
    return new Map(userIds.flatMap((id) => (this.emails.has(id) ? [[id, this.emails.get(id) ?? ""] as [string, string]] : [])));
  }
  async dueEmails(limit: number, maxAttempts: number): Promise<QueuedEmail[]> {
    return this.rows
      .filter((r) => r.channel === "email" && r.status === "queued" && r.attempts < maxAttempts)
      .slice(0, limit)
      .map((r) => ({ id: r.id, userId: r.userId, template: r.template, payload: r.payload, attempts: r.attempts }));
  }
  async listForUser(
    userId: string,
    page: number,
    pageSize: number,
  ): Promise<{ items: NotificationListItem[]; total: number }> {
    const mine = this.rows.filter((r) => r.userId === userId && r.channel === "in_app");
    const items = mine.slice((page - 1) * pageSize, page * pageSize).map((r) => ({
      id: r.id,
      channel: r.channel,
      template: r.template,
      payload: r.payload,
      readAt: null,
      createdAt: new Date(),
    }));
    return { items, total: mine.length };
  }
  async markRead(userId: string, notificationId: string): Promise<boolean> {
    return this.rows.some((r) => r.id === notificationId && r.userId === userId && r.channel === "in_app");
  }
}

class MockMailer implements Mailer {
  sent: Array<{ to: string; subject: string; text: string }> = [];
  failWith: Error | null = null;

  async send(to: string, subject: string, text: string): Promise<void> {
    if (this.failWith) throw this.failWith;
    this.sent.push({ to, subject, text });
  }
}

function makeService(): { service: NotifyService; store: MemoryStore; mailer: MockMailer } {
  const store = new MemoryStore();
  const mailer = new MockMailer();
  store.emails.set("buyer-1", "buyer@example.test");
  store.emails.set("seller-1", "seller@example.test");
  store.emails.set("user-1", "user@example.test");
  store.trades.set("trade-1", {
    buyerId: "buyer-1",
    sellerId: "seller-1",
    shortRef: "QT-8F3K2",
    amount: 12_500_000n,
  });
  return { service: new NotifyService(store, mailer), store, mailer };
}

describe("NotifyService.dispatch", () => {
  it("trade event → BOTH parties get an in_app (delivered) and an email row", async () => {
    const { service, store, mailer } = makeService();
    await service.dispatch("trade.completed", { tradeId: "trade-1", to: "COMPLETED" });

    const inApp = store.rows.filter((r) => r.channel === "in_app");
    const email = store.rows.filter((r) => r.channel === "email");
    expect(inApp.map((r) => r.userId).sort()).toEqual(["buyer-1", "seller-1"]);
    expect(email.map((r) => r.userId).sort()).toEqual(["buyer-1", "seller-1"]);
    for (const row of inApp) {
      expect(row.status).toBe("delivered");
      expect(row.deliveredAt).toBeInstanceOf(Date);
      expect(row.template).toBe("trade_completed");
    }
    for (const row of email) expect(row.status).toBe("delivered"); // SMTP succeeded
    expect(mailer.sent).toHaveLength(2);
    expect(mailer.sent[0]?.subject).toContain("QT-8F3K2");
  });

  it("SMTP failure leaves the email row queued with attempts+1 and does NOT throw", async () => {
    const { service, store, mailer } = makeService();
    mailer.failWith = new Error("connection refused");

    await expect(service.dispatch("deposit.credited", { userId: "user-1", amount: "5000000" })).resolves.toBeUndefined();

    const email = store.rows.find((r) => r.channel === "email");
    expect(email?.status).toBe("queued");
    expect(email?.attempts).toBe(1);
    expect(email?.deliveredAt).toBeNull();
    const inApp = store.rows.find((r) => r.channel === "in_app");
    expect(inApp?.status).toBe("delivered"); // in-app unaffected by SMTP
  });

  it("SMTP success sets delivered + delivered_at on the email row", async () => {
    const { service, store, mailer } = makeService();
    await service.dispatch("kyc.reviewed", { userId: "user-1", status: "APPROVED" });

    const email = store.rows.find((r) => r.channel === "email");
    expect(email?.status).toBe("delivered");
    expect(email?.deliveredAt).toBeInstanceOf(Date);
    expect(mailer.sent[0]?.to).toBe("user@example.test");
    expect(mailer.sent[0]?.text).toContain("APPROVED");
  });

  it("unknown events and missing trades are silent no-ops", async () => {
    const { service, store, mailer } = makeService();
    await service.dispatch("ledger.posted", { journalId: "j-1" });
    await service.dispatch("trade.completed", { tradeId: "missing-trade" });
    expect(store.rows).toHaveLength(0);
    expect(mailer.sent).toHaveLength(0);
  });

  it("never persists or emails secrets from the event payload", async () => {
    const { service, store, mailer } = makeService();
    await service.dispatch("deposit.credited", { userId: "user-1", otpCode: "123456" });

    for (const row of store.rows) {
      expect(JSON.stringify(row.payload)).not.toContain("123456");
    }
    expect(mailer.sent[0]?.text).not.toContain("123456");
  });

  it("recipient without an email address leaves the email row queued", async () => {
    const { service, store } = makeService();
    store.emails.delete("user-1");
    await service.dispatch("withdrawal.requested", { userId: "user-1", amount: "1000000" });

    const email = store.rows.find((r) => r.channel === "email");
    expect(email?.status).toBe("queued");
    expect(email?.attempts).toBe(1);
  });
});
