import Handlebars from "handlebars";
import {
  renderEmailHtml,
  type EmailButton,
  type EmailContent,
  type EmailFact,
} from "./notify.layout";

/**
 * Inline notification templates (EN; FR variants come later).
 * RULES (Documents/06 "notify"): never secrets, never OTP codes, never full
 * addresses; amounts only as pre-formatted DISPLAY strings ({{amountDisplay}})
 * — no raw smallest-unit values in user-facing copy.
 *
 * Each template has a plain-text `body` (the multipart text fallback) AND a
 * structured `EmailContent` that `renderEmailHtml` turns into the branded HTML
 * part (notify.layout.ts). Both draw from the same whitelisted context.
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
    body: "Trade {{shortRef}} is complete. The escrowed crypto has been released. Funds in your QuataTrade wallet can be withdrawn to an external wallet at any time.",
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
  /** plain-text part (multipart/alternative fallback) */
  body: string;
  /** branded HTML part */
  html: string;
}

/* ------------------------------------------------------------------ */
/* HTML content — structured per template, drawn from the same context */
/* ------------------------------------------------------------------ */

function amountFact(ctx: Record<string, string>): EmailFact[] {
  const a = ctx["amountDisplay"];
  return a ? [{ label: "Amount", value: `${a} USDT` }] : [];
}
function addressFact(ctx: Record<string, string>): EmailFact[] {
  const a = ctx["addressPreview"];
  return a ? [{ label: "To", value: a }] : [];
}
function tradeFact(ctx: Record<string, string>): EmailFact[] {
  const r = ctx["shortRef"];
  return r ? [{ label: "Trade", value: r }] : [];
}
function button(appUrl: string, path: string, label: string): EmailButton | undefined {
  return appUrl ? { label, url: `${appUrl}${path}` } : undefined;
}

const EMAIL_CONTENT: Record<TemplateName, (ctx: Record<string, string>, appUrl: string) => EmailContent> = {
  email_verify: (ctx) => ({
    preheader: "Your QuataTrade verification code",
    heading: "Confirm your email",
    paragraphs: ["Welcome to QuataTrade! Enter this code in the app to activate your account:"],
    code: ctx["code"] || undefined,
    note: "This code expires in 15 minutes. If you didn't create a QuataTrade account, you can safely ignore this email.",
  }),
  password_reset: (ctx) => ({
    preheader: "Reset your QuataTrade password",
    heading: "Reset your password",
    paragraphs: ["We received a request to reset your QuataTrade password. Choose a new one using the button below."],
    button: ctx["resetUrl"] ? { label: "Reset password", url: ctx["resetUrl"] } : undefined,
    note: "This link expires in 30 minutes. If you didn't request this, ignore this email — your password won't change.",
  }),
  deposit_credited: (ctx, appUrl) => ({
    preheader: "Your deposit has been credited",
    heading: "Deposit credited",
    paragraphs: ["Your deposit has been confirmed on-chain and added to your QuataTrade balance."],
    facts: amountFact(ctx),
    button: button(appUrl, "/wallet", "View wallet"),
  }),
  withdrawal_requested: (ctx, appUrl) => ({
    preheader: "We've received your withdrawal request",
    heading: "Withdrawal requested",
    paragraphs: ["We've received your withdrawal request and it's being processed."],
    facts: [...amountFact(ctx), ...addressFact(ctx)],
    note: "Larger withdrawals may be reviewed manually for your security. We'll email you as soon as it's sent.",
    button: button(appUrl, "/wallet", "View wallet"),
  }),
  withdrawal_confirmed: (ctx, appUrl) => ({
    preheader: "Your withdrawal has been sent",
    heading: "Withdrawal sent",
    paragraphs: ["Your withdrawal has been confirmed on the TRON network."],
    facts: [...amountFact(ctx), ...addressFact(ctx)],
    button: button(appUrl, "/wallet", "View wallet"),
  }),
  trade_escrow_locked: (ctx, appUrl) => ({
    preheader: "Escrow is locked for your trade",
    heading: "Escrow locked",
    paragraphs: ["The crypto for this trade is now locked in escrow. The buyer can send the fiat payment off-platform."],
    facts: [...tradeFact(ctx), ...amountFact(ctx)],
    button: button(appUrl, "/trade", "View trade"),
  }),
  trade_payment_submitted: (ctx, appUrl) => ({
    preheader: "The buyer marked the payment as sent",
    heading: "Payment submitted",
    paragraphs: [
      "The buyer has marked the payment as sent. Once the funds arrive in your account, confirm the trade in the app to release the escrow.",
    ],
    facts: tradeFact(ctx),
    button: button(appUrl, "/trade", "Review & confirm"),
  }),
  trade_completed: (ctx, appUrl) => ({
    preheader: "Your trade is complete",
    heading: "Trade completed",
    paragraphs: [
      "This trade is complete — the escrowed crypto has been released. Any funds in your QuataTrade wallet can be withdrawn to an external wallet whenever you like. Thanks for trading on QuataTrade.",
    ],
    facts: [...tradeFact(ctx), ...amountFact(ctx)],
    button: button(appUrl, "/trade", "View trade"),
  }),
  trade_expired: (ctx, appUrl) => ({
    preheader: "Your trade expired",
    heading: "Trade expired",
    paragraphs: ["This trade expired before the payment was confirmed. The escrowed crypto has been returned to the seller."],
    facts: tradeFact(ctx),
    button: button(appUrl, "/trade", "View trade"),
  }),
  trade_cancelled: (ctx, appUrl) => ({
    preheader: "Your trade was cancelled",
    heading: "Trade cancelled",
    paragraphs: ["This trade was cancelled. Any escrowed crypto has been returned to the seller."],
    facts: tradeFact(ctx),
    button: button(appUrl, "/trade", "View trade"),
  }),
  trade_disputed: (ctx, appUrl) => ({
    preheader: "A dispute was opened on your trade",
    heading: "Trade disputed",
    paragraphs: [
      "A dispute has been opened on this trade. The escrow is now frozen until a QuataTrade agent resolves it. Please add your evidence in the app.",
    ],
    facts: tradeFact(ctx),
    button: button(appUrl, "/trade", "Add evidence"),
  }),
  dispute_resolved: (ctx, appUrl) => ({
    preheader: "Your dispute has been resolved",
    heading: "Dispute resolved",
    paragraphs: ["The dispute on this trade has been resolved. See the trade page for the full details."],
    facts: [
      ...tradeFact(ctx),
      ...(ctx["resolution"] ? [{ label: "Outcome", value: ctx["resolution"] }] : []),
    ],
    button: button(appUrl, "/trade", "View trade"),
  }),
  kyc_submitted: (ctx) => ({
    preheader: "We've received your verification documents",
    heading: "Documents received",
    paragraphs: [
      "We've received your identity verification documents. A reviewer will check them shortly — there's nothing more you need to do right now.",
    ],
    facts: ctx["tier"] ? [{ label: "Tier", value: ctx["tier"] }] : [],
  }),
  kyc_reviewed: (ctx, appUrl) => ({
    preheader: "There's an update on your verification",
    heading: "Verification update",
    paragraphs: ["Your identity verification has been reviewed. Open the app to see the outcome and what to do next."],
    facts: ctx["status"] ? [{ label: "Outcome", value: ctx["status"] }] : [],
    button: button(appUrl, "/account", "View status"),
  }),
};

const compiledCache = new Map<
  TemplateName,
  { subject: Handlebars.TemplateDelegate; body: Handlebars.TemplateDelegate }
>();

/**
 * Render a template with a whitelisted string context (see notify.plan.ts).
 * Returns the interpolated subject, a plain-text body (noEscape — context values
 * are length-limited and whitelisted upstream, never raw user input), and the
 * branded HTML part. `appUrl` (WEB_ORIGIN) powers in-email buttons/links.
 */
export function renderTemplate(
  name: TemplateName,
  context: Record<string, string>,
  appUrl = "",
): RenderedMessage {
  let compiled = compiledCache.get(name);
  if (!compiled) {
    const source = TEMPLATE_SOURCES[name];
    compiled = {
      subject: Handlebars.compile(source.subject, { noEscape: true, strict: false }),
      body: Handlebars.compile(source.body, { noEscape: true, strict: false }),
    };
    compiledCache.set(name, compiled);
  }
  const html = renderEmailHtml(EMAIL_CONTENT[name](context, appUrl), appUrl);
  return { subject: compiled.subject(context), body: compiled.body(context), html };
}
