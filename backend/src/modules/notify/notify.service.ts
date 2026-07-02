import { Inject, Injectable, Logger } from "@nestjs/common";
import { toDisplay } from "@quatatrade/shared";
import { newId } from "../../common/ids";
import { MAILER, type Mailer } from "./notify.mailer";
import { planDispatch, safeContext } from "./notify.plan";
import { NOTIFY_STORE, type NotificationListItem, type NotifyStore } from "./notify.store";
import { renderTemplate } from "./notify.templates";

/**
 * notify — domain events → per-user notifications (Documents/06 "notify").
 * For every recipient: an in_app row (delivered immediately) AND an email row
 * (queued → SMTP attempt; failure leaves it queued with attempts+1 — the row
 * doubles as the delivery log). Templates/context are whitelisted: no secrets,
 * no OTP codes, no full addresses, amounts only as display strings.
 * Called by the outbox relay job (worker) and the notifications controller.
 */
@Injectable()
export class NotifyService {
  private readonly logger = new Logger(NotifyService.name);

  constructor(
    @Inject(NOTIFY_STORE) private readonly store: NotifyStore,
    @Inject(MAILER) private readonly mailer: Mailer,
  ) {}

  /**
   * Map one domain event to notifications. Unknown/unmapped events are a
   * successful no-op (the relay marks them processed). SMTP failures NEVER
   * throw — they only leave the email row queued for a later retry sweep.
   */
  async dispatch(eventType: string, payload: Record<string, unknown>): Promise<void> {
    const plan = planDispatch(eventType, payload);
    if (!plan) return;

    const context = safeContext(payload);
    let recipients = plan.recipients;
    if (plan.tradeId) {
      const parties = await this.store.tradeParties(plan.tradeId);
      if (!parties) {
        this.logger.warn(`event ${eventType}: trade ${plan.tradeId} not found — skipping`);
        return;
      }
      recipients = [parties.buyerId, parties.sellerId];
      context["shortRef"] = parties.shortRef;
      context["amountDisplay"] = toDisplay(parties.amount);
    }

    const emails = await this.store.userEmails(recipients);
    const storedPayload: Record<string, unknown> = { ...context, event: eventType };
    if (plan.tradeId) storedPayload["tradeId"] = plan.tradeId;

    for (const userId of recipients) {
      await this.store.insert({
        id: newId(),
        userId,
        channel: "in_app",
        template: plan.template,
        payload: storedPayload,
        status: "delivered",
        deliveredAt: new Date(),
      });

      const emailId = newId();
      await this.store.insert({
        id: emailId,
        userId,
        channel: "email",
        template: plan.template,
        payload: storedPayload,
        status: "queued",
        deliveredAt: null,
      });

      const to = emails.get(userId);
      if (!to) {
        await this.store.recordEmailFailure(emailId);
        this.logger.warn(`email ${emailId} (${plan.template}): no address for recipient — left queued`);
        continue;
      }

      const message = renderTemplate(plan.template, context);
      try {
        await this.mailer.send(to, message.subject, message.body);
        await this.store.markEmailDelivered(emailId);
      } catch (err) {
        await this.store.recordEmailFailure(emailId);
        // generic log only — never the address, body, or SMTP credentials
        this.logger.warn(
          `email ${emailId} (${plan.template}) send failed: ${err instanceof Error ? err.message : "unknown error"}`,
        );
      }
    }
  }

  async listForUser(
    userId: string,
    page: number,
    pageSize: number,
  ): Promise<{ items: NotificationListItem[]; total: number }> {
    return this.store.listForUser(userId, page, pageSize);
  }

  async markRead(userId: string, notificationId: string): Promise<boolean> {
    return this.store.markRead(userId, notificationId);
  }
}
