import { Inject, Injectable, Logger } from "@nestjs/common";
import { Cron } from "@nestjs/schedule";
import { ConfigService } from "@nestjs/config";
import type { Env } from "../config/env";
import { MAILER, type Mailer } from "../modules/notify/notify.mailer";
import { NOTIFY_STORE, type NotifyStore } from "../modules/notify/notify.store";
import { renderTemplate, TEMPLATE_NAMES, type TemplateName } from "../modules/notify/notify.templates";

const BATCH_SIZE = 50;
/** after this many failed attempts a row is left dead (no longer picked up) */
const MAX_ATTEMPTS = 8;

/**
 * Delivery arm of the notify pipeline: sends QUEUED email rows (channel=email,
 * status=queued). Covers verification + password-reset emails (their code/token
 * live in the row payload) AND retries any domain-notification email that failed
 * its inline send. Marks delivered on success, attempts+1 on failure; rows past
 * MAX_ATTEMPTS stop being retried. Runs every 30s with a running-flag guard.
 * Worker-only (the API has no ScheduleModule, so @Cron is inert there).
 */
@Injectable()
export class EmailSendJob {
  private readonly logger = new Logger(EmailSendJob.name);
  private running = false;
  private readonly webOrigin: string;

  constructor(
    @Inject(NOTIFY_STORE) private readonly store: NotifyStore,
    @Inject(MAILER) private readonly mailer: Mailer,
    config: ConfigService<Env, true>,
  ) {
    this.webOrigin = config.get("WEB_ORIGIN", { infer: true });
  }

  @Cron("*/30 * * * * *")
  async run(): Promise<void> {
    if (this.running) return;
    this.running = true;
    try {
      const due = await this.store.dueEmails(BATCH_SIZE, MAX_ATTEMPTS);
      if (due.length === 0) return;
      const emails = await this.store.userEmails(due.map((d) => d.userId));

      for (const row of due) {
        const to = emails.get(row.userId);
        if (!to || !isTemplateName(row.template)) {
          await this.store.recordEmailFailure(row.id);
          continue;
        }
        const message = renderTemplate(row.template, this.contextFor(row.template, row.payload), this.webOrigin);
        try {
          await this.mailer.send(to, message.subject, message.body, message.html);
          await this.store.markEmailDelivered(row.id);
        } catch (err) {
          await this.store.recordEmailFailure(row.id);
          this.logger.warn(
            `email ${row.id} (${row.template}) send failed (attempt ${row.attempts + 1}): ${
              err instanceof Error ? err.message : "unknown error"
            }`,
          );
        }
      }
    } finally {
      this.running = false;
    }
  }

  /** Whitelist the stored payload to string values; add a reset link for password_reset. */
  private contextFor(template: TemplateName, payload: Record<string, unknown>): Record<string, string> {
    const context: Record<string, string> = {};
    for (const [k, v] of Object.entries(payload)) {
      if (typeof v === "string") context[k] = v;
    }
    if (template === "password_reset" && typeof payload["token"] === "string") {
      context["resetUrl"] = `${this.webOrigin}/reset?token=${encodeURIComponent(payload["token"])}`;
    }
    return context;
  }
}

function isTemplateName(name: string): name is TemplateName {
  return (TEMPLATE_NAMES as readonly string[]).includes(name);
}
