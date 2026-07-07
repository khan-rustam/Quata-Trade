/**
 * Branded HTML email layout (Documents/02 "MJML + Handlebars" intent, hand-rolled
 * as email-client-safe table HTML to avoid a heavy runtime MJML dependency —
 * Deviations Log 10 §"HTML email layout").
 *
 * SECURITY: this is the ONLY place raw values become HTML. Every interpolated
 * value passes through `esc()` (defence-in-depth — callers already feed a
 * whitelisted, secret-free context, see notify.plan.ts `safeContext`). Colours
 * are the brand tokens from Documents/11 §11.8, inlined because email clients
 * strip CSS variables. Light is the robust base; a dark-mode block upgrades
 * clients that honour `prefers-color-scheme`.
 */

export interface EmailButton {
  label: string;
  url: string;
}

export interface EmailFact {
  label: string;
  value: string;
}

export interface EmailContent {
  /** hidden inbox-preview text */
  preheader?: string;
  heading: string;
  paragraphs?: string[];
  /** a verification / one-time code, shown in a large monospace box */
  code?: string;
  button?: EmailButton;
  /** label/value rows (amount, trade ref, …) */
  facts?: EmailFact[];
  /** small muted footnote (expiry, "ignore if this wasn't you", …) */
  note?: string;
}

/** Escape the five HTML-significant chars — safe for both text nodes and quoted attributes. */
function esc(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// Brand tokens (Documents/11 §11.8) — inlined; light base values.
const C = {
  brand700: "#0E5F55",
  brand900: "#0B3B36",
  accent200: "#A9EFD9",
  paper: "#F6F9F8",
  card: "#FFFFFF",
  border: "#E2EAE7",
  divider: "#EEF3F1",
  ink: "#101614",
  muted: "#5C6B67",
  faint: "#5E706C",
} as const;

const FONT_STACK =
  "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";
const MONO_STACK = "'SFMono-Regular',ui-monospace,Menlo,Consolas,monospace";

function renderButton(button: EmailButton): string {
  const url = esc(button.url);
  return `
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:26px 0 6px;">
      <tr>
        <td align="center" bgcolor="${C.brand700}" style="border-radius:10px;">
          <a href="${url}" target="_blank" rel="noopener noreferrer"
             style="display:inline-block;padding:13px 30px;font-family:${FONT_STACK};font-size:15px;font-weight:600;line-height:1;color:#ffffff;text-decoration:none;border-radius:10px;">
            ${esc(button.label)}
          </a>
        </td>
      </tr>
    </table>`;
}

function renderFacts(facts: EmailFact[]): string {
  const rows = facts
    .map((f, i) => {
      const divider = i < facts.length - 1 ? `border-bottom:1px solid ${C.divider};` : "";
      return `
      <tr>
        <td class="qt-fact-label" style="padding:13px 16px;font-family:${FONT_STACK};font-size:14px;color:${C.muted};${divider}">${esc(f.label)}</td>
        <td class="qt-fact-val" align="right" style="padding:13px 16px;font-family:${MONO_STACK};font-size:14px;font-weight:600;color:${C.ink};${divider}">${esc(f.value)}</td>
      </tr>`;
    })
    .join("");
  return `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
           class="qt-facts" style="margin:22px 0 6px;border:1px solid ${C.border};border-radius:12px;background:${C.paper};">
      ${rows}
    </table>`;
}

function renderCode(code: string): string {
  return `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:22px 0 6px;">
      <tr>
        <td align="center" class="qt-code"
            style="padding:22px;background:${C.paper};border:1px solid ${C.border};border-radius:12px;font-family:${MONO_STACK};font-size:32px;font-weight:700;letter-spacing:10px;color:${C.ink};">
          ${esc(code)}
        </td>
      </tr>
    </table>`;
}

/** Render a full, standalone HTML email document for the given content. */
export function renderEmailHtml(content: EmailContent, appUrl = ""): string {
  const paragraphs = (content.paragraphs ?? [])
    .map(
      (p) =>
        `<p class="qt-p" style="margin:0 0 16px;font-family:${FONT_STACK};font-size:15px;line-height:1.65;color:${C.muted};">${esc(
          p,
        )}</p>`,
    )
    .join("");

  const code = content.code ? renderCode(content.code) : "";
  const facts = content.facts && content.facts.length > 0 ? renderFacts(content.facts) : "";
  const button = content.button ? renderButton(content.button) : "";
  const note = content.note
    ? `<p class="qt-note" style="margin:24px 0 0;font-family:${FONT_STACK};font-size:13px;line-height:1.6;color:${C.faint};">${esc(
        content.note,
      )}</p>`
    : "";

  const preheader = content.preheader
    ? `<div style="display:none;max-height:0;overflow:hidden;opacity:0;mso-hide:all;">${esc(
        content.preheader,
      )}</div>`
    : "";

  const openLink = appUrl
    ? ` &nbsp;·&nbsp; <a href="${esc(appUrl)}" target="_blank" rel="noopener noreferrer" style="color:${C.brand700};text-decoration:none;">Open QuataTrade</a>`
    : "";

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light dark">
<meta name="supported-color-schemes" content="light dark">
<title>QuataTrade</title>
<style>
  body{margin:0;padding:0;width:100%!important;background:${C.paper};}
  a{text-decoration:none;}
  @media (prefers-color-scheme: dark){
    .qt-body{background:#0E1416!important;}
    .qt-card{background:#151C1E!important;border-color:#2C3A3D!important;}
    .qt-h1{color:#E7EDEB!important;}
    .qt-p,.qt-fact-label{color:#9FB3AE!important;}
    .qt-fact-val,.qt-code{color:#E7EDEB!important;}
    .qt-facts,.qt-code{background:#1C2528!important;border-color:#2C3A3D!important;}
    .qt-note,.qt-foot{color:#5E706C!important;}
    .qt-divider{border-color:#2C3A3D!important;}
  }
</style>
</head>
<body class="qt-body" style="margin:0;padding:0;background:${C.paper};">
${preheader}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" class="qt-body" style="background:${C.paper};">
  <tr>
    <td align="center" style="padding:28px 12px;">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:600px;max-width:600px;">
        <!-- header -->
        <tr>
          <td align="center" bgcolor="${C.brand900}"
              style="border-radius:16px 16px 0 0;background-color:${C.brand900};background-image:linear-gradient(135deg,${C.brand900} 0%,${C.brand700} 55%,#159E85 100%);padding:26px 32px;">
            <span style="font-family:${FONT_STACK};font-size:22px;font-weight:700;letter-spacing:-0.3px;color:#ffffff;">Quata<span style="color:${C.accent200};">Trade</span></span>
            <div style="margin-top:4px;font-family:${FONT_STACK};font-size:12px;letter-spacing:0.3px;color:${C.accent200};">Crypto to cash. Protected.</div>
          </td>
        </tr>
        <!-- card -->
        <tr>
          <td class="qt-card" bgcolor="${C.card}"
              style="background:${C.card};border:1px solid ${C.border};border-top:none;border-radius:0 0 16px 16px;padding:34px 32px 30px;">
            <h1 class="qt-h1" style="margin:0 0 16px;font-family:${FONT_STACK};font-size:22px;font-weight:700;line-height:1.3;color:${C.ink};">${esc(
              content.heading,
            )}</h1>
            ${paragraphs}
            ${code}
            ${facts}
            ${button}
            ${note}
          </td>
        </tr>
        <!-- footer -->
        <tr>
          <td style="padding:22px 24px 8px;">
            <p class="qt-foot" style="margin:0 0 6px;font-family:${FONT_STACK};font-size:12px;line-height:1.6;color:${C.faint};">
              QuataTrade will never ask for your password, PIN, or recovery phrase.
            </p>
            <p class="qt-foot" style="margin:0;font-family:${FONT_STACK};font-size:12px;line-height:1.6;color:${C.faint};">
              You're receiving this because you have a QuataTrade account.${openLink}
            </p>
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>
</body>
</html>`;
}
