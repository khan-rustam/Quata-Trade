import { isAmountString, toDisplay } from "@quatatrade/shared";
import type { TemplateName } from "./notify.templates";

/**
 * PURE event → notification mapping (unit-tested in notify.spec.ts).
 * The service resolves trade parties / emails and performs the I/O.
 */

export interface DispatchPlan {
  template: TemplateName;
  /** recipients resolved directly from the payload (userId events) */
  recipients: string[];
  /** when set, recipients are the trade's buyer AND seller */
  tradeId: string | null;
}

/** Events addressed to a single user via payload.userId. */
const DIRECT_EVENTS: Readonly<Record<string, TemplateName>> = {
  // NOTE: verification + reset emails are sent from their queued rows by
  // EmailSendJob (they carry the code/token in the payload); they are NOT
  // dispatched here (safeContext would strip the code, and it would double-send).
  "deposit.credited": "deposit_credited",
  "withdrawal.requested": "withdrawal_requested",
  "withdrawal.confirmed": "withdrawal_confirmed",
  "kyc.submitted": "kyc_submitted",
  "kyc.reviewed": "kyc_reviewed",
};

/** Events that notify BOTH trade parties via payload.tradeId. */
const TRADE_EVENTS: Readonly<Record<string, TemplateName>> = {
  "trade.escrow_locked": "trade_escrow_locked",
  "trade.payment_submitted": "trade_payment_submitted",
  "trade.completed": "trade_completed",
  "trade.expired": "trade_expired",
  "trade.cancelled": "trade_cancelled",
  "trade.disputed": "trade_disputed",
  "dispute.resolved": "dispute_resolved",
};

function str(payload: Record<string, unknown>, key: string): string | null {
  const value = payload[key];
  return typeof value === "string" && value.length > 0 ? value : null;
}

/** Map a domain event to a plan; null = not a notifiable event (no-op). */
export function planDispatch(eventType: string, payload: Record<string, unknown>): DispatchPlan | null {
  const tradeTemplate = TRADE_EVENTS[eventType];
  if (tradeTemplate) {
    const tradeId = str(payload, "tradeId");
    if (!tradeId) return null;
    return { template: tradeTemplate, recipients: [], tradeId };
  }
  const directTemplate = DIRECT_EVENTS[eventType];
  if (directTemplate) {
    const userId = str(payload, "userId");
    if (!userId) return null;
    return { template: directTemplate, recipients: [userId], tradeId: null };
  }
  return null;
}

/** Whitelisted, length-limited string fields allowed into templates verbatim. */
const PASSTHROUGH_KEYS = ["shortRef", "resolution", "kind"] as const;
const MAX_VALUE_LENGTH = 64;

/**
 * Build a SAFE template context from an outbox payload: whitelist only —
 * secrets/OTP codes/hashes and unknown fields never reach templates or the
 * persisted notification payload. Amounts become display strings; addresses
 * are masked to first/last 4 chars (never full addresses, Documents/06).
 */
export function safeContext(payload: Record<string, unknown>): Record<string, string> {
  const context: Record<string, string> = {};

  for (const key of PASSTHROUGH_KEYS) {
    const value = payload[key];
    if (typeof value === "string" && value.length > 0 && value.length <= MAX_VALUE_LENGTH) {
      context[key] = value;
    }
  }

  const status = payload["status"] ?? payload["to"];
  if (typeof status === "string" && status.length > 0 && status.length <= MAX_VALUE_LENGTH) {
    context["status"] = status;
  }

  const amount = payload["amount"];
  if (typeof amount === "string" && isAmountString(amount)) {
    context["amountDisplay"] = toDisplay(amount);
  }

  const address = payload["toAddress"] ?? payload["address"];
  if (typeof address === "string" && address.length >= 10) {
    context["addressPreview"] = `${address.slice(0, 4)}…${address.slice(-4)}`;
  }

  const tier = payload["tier"];
  if (typeof tier === "number" && Number.isInteger(tier) && tier >= 0) {
    context["tier"] = String(tier);
  }

  return context;
}
