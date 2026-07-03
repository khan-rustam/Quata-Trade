import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { Env } from "../../config/env";

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

  constructor(config: ConfigService<Env, true>) {
    this.webhookUrl = config.get("ALERT_WEBHOOK_URL", { infer: true });
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
}
