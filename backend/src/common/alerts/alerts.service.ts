import { Inject, Injectable, Logger, Optional } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { Kysely } from "kysely";
import type { Env } from "../../config/env";
import { DB } from "../../db/database.module";
import type { Database } from "../../db/types";
import { newId } from "../ids";
import { MAILER, type Mailer } from "../../modules/notify/notify.mailer";

type Severity = "info" | "warning" | "critical";

/** Which domain events page ops/security, and at what severity (Documents/09 §G). */
const SECURITY_EVENTS: Record<string, { severity: Severity; title: string }> = {
  "reconciliation.mismatch": { severity: "critical", title: "Ledger reconciliation mismatch" },
  "user.frozen": { severity: "critical", title: "User auto-frozen by the risk engine" },
  "ledger.adjustment": { severity: "critical", title: "Manual ledger adjustment posted" },
  "admin.kill_switch": { severity: "critical", title: "Kill switch toggled" },
  "risk.flagged": { severity: "warning", title: "Risk score escalated" },
  "aml.hit": { severity: "critical", title: "AML / sanctions blocklist hit" },
  "withdrawal.broadcast_stale": { severity: "critical", title: "Withdrawal stuck in BROADCAST" },
  "reconciliation.reserve_shortfall": { severity: "critical", title: "On-chain reserve shortfall" },
  "reconciliation.job_error": { severity: "critical", title: "Reconciliation job failed to run" },
  // A user's deposit is frozen pending a human decision — it must never sit silently.
  "deposit.policy_hold": { severity: "warning", title: "Deposit held for review (policy/limit)" },
  "deposit.hold_released": { severity: "warning", title: "Held deposit RELEASED by an admin" },
  "deposit.hold_rejected": { severity: "warning", title: "Held deposit REJECTED by an admin" },
  // Two DB rows for one on-chain transfer; the second was blocked before crediting.
  "deposit.duplicate_blocked": { severity: "critical", title: "Duplicate deposit blocked (same tx credited twice?)" },
  // A credited deposit vanished from the chain — phantom balance, funds at risk.
  "deposit.orphaned": { severity: "critical", title: "Credited deposit ORPHANED by chain reorg" },
};

const ICON: Record<Severity, string> = { info: "info", warning: "warn", critical: "CRITICAL" };

function safeJson(meta: Record<string, unknown>): string {
  try {
    return JSON.stringify(meta).slice(0, 1000);
  } catch {
    return "[unserializable]";
  }
}

/**
 * Ops/security alerting. Delivers high-signal events out-of-band (webhook) so a
 * human is actually paged — reconciliation mismatches, risk auto-freezes, and
 * privileged admin actions. NEVER throws: alerting must not break the flow it
 * observes; a delivery failure degrades to an error log. Webhook is Slack/Discord
 * "text" compatible; empty ALERT_WEBHOOK_URL disables delivery (log-only).
 */
@Injectable()
export class AlertsService {
  private readonly logger = new Logger(AlertsService.name);
  private readonly webhookUrl: string;
  private readonly emailTo: string;
  private readonly telegramToken: string;
  private readonly telegramChatId: string;

  constructor(
    config: ConfigService<Env, true>,
    // Optional so the unit test can construct with config alone; production wires
    // both. DB persists the alert (admin Alerts page); MAILER emails criticals.
    @Optional() @Inject(DB) private readonly db?: Kysely<Database>,
    @Optional() @Inject(MAILER) private readonly mailer?: Mailer,
  ) {
    this.webhookUrl = config.get("ALERT_WEBHOOK_URL", { infer: true });
    this.emailTo = config.get("ALERT_EMAIL_TO", { infer: true });
    this.telegramToken = config.get("TELEGRAM_BOT_TOKEN", { infer: true });
    this.telegramChatId = config.get("TELEGRAM_CHAT_ID", { infer: true });
  }

  /** Route a domain event (from the outbox relay) to the alert channel if security-relevant. */
  async fromEvent(eventType: string, payload: Record<string, unknown>): Promise<void> {
    const spec = SECURITY_EVENTS[eventType];
    if (!spec) return;
    await this.send(spec.severity, spec.title, { event: eventType, ...payload });
  }

  /** Fire an alert directly (e.g. from a job). Never throws. */
  async send(severity: Severity, title: string, meta: Record<string, unknown> = {}): Promise<void> {
    const line = `[ALERT:${ICON[severity]}] ${title} — ${safeJson(meta)}`;
    if (severity === "critical") this.logger.error(line);
    else this.logger.warn(line);

    // Persist for the admin Alerts page + email criticals + Telegram. All are
    // best-effort: alerting must never break the flow it observes.
    await this.persist(severity, title, meta);
    if (severity === "critical") await this.emailCritical(title, meta);
    await this.telegram(severity, title, meta);

    if (this.webhookUrl.trim() === "") return;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5_000);
    try {
      await fetch(this.webhookUrl, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ text: `[${severity.toUpperCase()}] ${title}\n\`\`\`${safeJson(meta)}\`\`\`` }),
        signal: controller.signal,
      });
    } catch (err) {
      this.logger.warn(`alert webhook failed: ${err instanceof Error ? err.message : "unknown error"}`);
    } finally {
      clearTimeout(timer);
    }
  }

  /** Store the alert so it shows on the admin Alerts page. Never throws. */
  private async persist(severity: Severity, title: string, meta: Record<string, unknown>): Promise<void> {
    if (!this.db) return;
    const eventType = typeof meta["event"] === "string" ? (meta["event"] as string) : "direct";
    try {
      await this.db
        .insertInto("alerts")
        .values({ id: newId(), severity, event_type: eventType, title, metadata: JSON.stringify(meta) })
        .execute();
    } catch (err) {
      this.logger.warn(`alert persist failed: ${err instanceof Error ? err.message : "unknown error"}`);
    }
  }

  /**
   * Push the alert to Telegram (BotFather bot → chat/group). Env-gated: dormant
   * until both TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID are set. Never throws;
   * 5s timeout. No secrets in the message (title + already-trimmed meta only).
   */
  private async telegram(severity: Severity, title: string, meta: Record<string, unknown>): Promise<void> {
    if (this.telegramToken.trim() === "" || this.telegramChatId.trim() === "") return;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5_000);
    try {
      await fetch(`https://api.telegram.org/bot${this.telegramToken}/sendMessage`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          chat_id: this.telegramChatId,
          text: `${ICON[severity]} ${title}\n${safeJson(meta)}`,
          disable_web_page_preview: true,
        }),
        signal: controller.signal,
      });
    } catch (err) {
      this.logger.warn(`alert telegram failed: ${err instanceof Error ? err.message : "unknown error"}`);
    } finally {
      clearTimeout(timer);
    }
  }

  /** Email a CRITICAL alert to the ops recipients (ALERT_EMAIL_TO). Never throws. */
  private async emailCritical(title: string, meta: Record<string, unknown>): Promise<void> {
    if (!this.mailer || this.emailTo.trim() === "") return;
    try {
      await this.mailer.send(this.emailTo, `[CRITICAL] ${title}`, `${title}\n\n${safeJson(meta)}`);
    } catch (err) {
      this.logger.warn(`alert email failed: ${err instanceof Error ? err.message : "unknown error"}`);
    }
  }
}
