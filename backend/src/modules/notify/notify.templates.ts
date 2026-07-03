import Handlebars from "handlebars";

/**
 * Inline notification templates (EN; FR variants come later).
 * RULES (Documents/06 "notify"): never secrets, never OTP codes, never full
 * addresses; amounts only as pre-formatted DISPLAY strings ({{amountDisplay}})
 * — no raw smallest-unit values in user-facing copy.
 */

export const TEMPLATE_NAMES = [
  "email_verify",
  "password_reset",
  "deposit_credited",
  "withdrawal_requested",
  "withdrawal_confirmed",
  "trade_escrow_locked",
  "trade_payment_submitted",
  "trade_completed",
  "trade_expired",
  "trade_cancelled",
  "trade_disputed",
  "dispute_resolved",
  "kyc_submitted",
  "kyc_reviewed",
] as const;

export type TemplateName = (typeof TEMPLATE_NAMES)[number];

interface TemplateSource {
  subject: string;
  body: string;
}

const TEMPLATE_SOURCES: Record<TemplateName, TemplateSource> = {
  email_verify: {
    subject: "Verify your QuataTrade email",
    body: "Welcome to QuataTrade! Your email verification code is:\n\n    {{code}}\n\nEnter it in the app to activate your account. The code expires in 15 minutes. If you did not create this account, you can ignore this message.",
  },
  password_reset: {
    subject: "Reset your QuataTrade password",
    body: "We received a request to reset your QuataTrade password. Use this link to choose a new one:\n\n{{resetUrl}}\n\nThe link expires in 30 minutes. If you did not request this, you can safely ignore this email — your password will not change.",
  },
  deposit_credited: {
    subject: "Deposit credited",
    body: "Your deposit{{#if amountDisplay}} of {{amountDisplay}} USDT{{/if}} has been confirmed and credited to your QuataTrade balance.",
  },
  withdrawal_requested: {
    subject: "Withdrawal requested",
    body: "We received your withdrawal request{{#if amountDisplay}} of {{amountDisplay}} USDT{{/if}}{{#if addressPreview}} to {{addressPreview}}{{/if}}. It is being reviewed and you will be notified when it is processed.",
  },
  withdrawal_confirmed: {
    subject: "Withdrawal confirmed",
    body: "Your withdrawal{{#if amountDisplay}} of {{amountDisplay}} USDT{{/if}}{{#if addressPreview}} to {{addressPreview}}{{/if}} has been confirmed on-chain.",
  },
  trade_escrow_locked: {
    subject: "Trade {{shortRef}}: escrow locked",
    body: "The crypto for trade {{shortRef}}{{#if amountDisplay}} ({{amountDisplay}} USDT){{/if}} is now locked in escrow. The buyer can send the fiat payment.",
  },
  trade_payment_submitted: {
    subject: "Trade {{shortRef}}: payment submitted",
    body: "The buyer marked the payment for trade {{shortRef}} as sent. Seller: confirm in the app once you have received the funds in your own account.",
  },
  trade_completed: {
    subject: "Trade {{shortRef}} completed",
    body: "Trade {{shortRef}} is complete. The escrowed crypto has been released.",
  },
  trade_expired: {
    subject: "Trade {{shortRef}} expired",
    body: "Trade {{shortRef}} expired before the payment was confirmed. The escrowed crypto was returned to the seller.",
  },
  trade_cancelled: {
    subject: "Trade {{shortRef}} cancelled",
    body: "Trade {{shortRef}} was cancelled. Any escrowed crypto was returned to the seller.",
  },
  trade_disputed: {
    subject: "Trade {{shortRef}} disputed",
    body: "A dispute was opened on trade {{shortRef}}. The escrow is frozen until a QuataTrade agent resolves it. Please add your evidence in the app.",
  },
  dispute_resolved: {
    subject: "Dispute resolved for trade {{shortRef}}",
    body: "The dispute on trade {{shortRef}} has been resolved{{#if resolution}} ({{resolution}}){{/if}}. See the trade page for details.",
  },
  kyc_submitted: {
    subject: "Verification documents received",
    body: "We received your identity verification documents{{#if tier}} for tier {{tier}}{{/if}}. A reviewer will check them shortly — no action is needed.",
  },
  kyc_reviewed: {
    subject: "Identity verification update",
    body: "Your identity verification was reviewed{{#if status}}: {{status}}{{/if}}. Open the app for details.",
  },
};

export interface RenderedMessage {
  subject: string;
  body: string;
}

const compiledCache = new Map<
  TemplateName,
  { subject: Handlebars.TemplateDelegate; body: Handlebars.TemplateDelegate }
>();

/**
 * Render a template with a whitelisted string context (see notify.plan.ts).
 * Plain-text output → noEscape (context values never come from raw user input;
 * anything user-derived is length-limited and whitelisted upstream).
 */
export function renderTemplate(name: TemplateName, context: Record<string, string>): RenderedMessage {
  let compiled = compiledCache.get(name);
  if (!compiled) {
    const source = TEMPLATE_SOURCES[name];
    compiled = {
      subject: Handlebars.compile(source.subject, { noEscape: true, strict: false }),
      body: Handlebars.compile(source.body, { noEscape: true, strict: false }),
    };
    compiledCache.set(name, compiled);
  }
  return { subject: compiled.subject(context), body: compiled.body(context) };
}
