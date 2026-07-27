/**
 * Campaign attribution — capture, persist, and forward the ad parameters
 * that arrive on a marketing landing URL.
 *
 * Why this exists: the dedicated `/signup/*` landing routes are the click
 * targets for Facebook / Google / TikTok ads, QR codes, billboards and
 * flyers. Every one of those channels tags its links with `utm_*` (and the
 * ad networks add their own click IDs). Those parameters have to survive
 * the whole registration funnel — which for QuataTrade means an email-verification
 * round-trip and a two-step form — or the conversion is reported as
 * "direct" and the campaign looks like it did nothing.
 *
 * Design notes:
 *
 *   * **Client-only, read in an effect.** The signup landing pages are
 *     statically prerendered, and `useSearchParams()` would force a Suspense
 *     boundary and a dynamic render. Ad landing pages are exactly where an
 *     instantly-painted static document matters most, so we read
 *     `window.location` after mount instead.
 *
 *   * **Cookie + sessionStorage, belt and braces.** The cookie carries the
 *     attribution across a full page navigation and back (OTP links, app
 *     redirects); sessionStorage survives a cookie being blocked by an
 *     in-app browser. Either alone loses a real fraction of traffic.
 *
 *   * **Last non-direct click wins.** We only overwrite a stored record when
 *     the incoming URL actually carries campaign parameters. A visitor who
 *     lands from an ad, wanders to /pricing, then comes back to sign up is
 *     still credited to the ad — internal navigation never clears it.
 *
 *   * **No PII.** Only channel metadata is stored, so this needs no consent
 *     gate beyond the existing cookie banner and nothing here can leak a
 *     user identifier.
 */

/** UTM parameters, in the order we serialise them. */
export const UTM_KEYS = [
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_term",
  "utm_content",
  "utm_id",
] as const;

/** Ad-network click identifiers, forwarded alongside the UTM tags. */
export const CLICK_ID_KEYS = [
  "gclid", // Google Ads
  "fbclid", // Meta (Facebook / Instagram)
  "ttclid", // TikTok
  "msclkid", // Microsoft / Bing
  "twclid", // X / Twitter
] as const;

export type UtmKey = (typeof UTM_KEYS)[number];
export type ClickIdKey = (typeof CLICK_ID_KEYS)[number];

export interface CampaignRecord {
  /** UTM tags present on the landing URL. */
  utm: Partial<Record<UtmKey, string>>;
  /** Ad-network click IDs present on the landing URL. */
  clickIds: Partial<Record<ClickIdKey, string>>;
  /**
   * Which signup surface the visitor landed on (`user`, `merchant`,
   * `agent`, `business`, …). Set by the landing page, not the URL, so
   * reporting can split conversions by funnel even when a campaign
   * points several ads at the same UTM set.
   */
  segment?: string;
  /** Path of the landing page, for funnel-entry reporting. */
  landingPath?: string;
  /** Referrer at first touch — distinguishes organic social from paid. */
  referrer?: string;
  /** ISO timestamp of capture. */
  capturedAt: string;
}

const STORAGE_KEY = "qd_campaign";
/** 90 days — long enough to cover a considered signup, short enough to stay honest. */
const MAX_AGE_SECONDS = 90 * 24 * 60 * 60;

/* ------------------------------------------------------------------ *
 * Storage primitives
 * ------------------------------------------------------------------ */

function readCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const prefix = `${name}=`;
  for (const part of document.cookie.split("; ")) {
    if (part.startsWith(prefix)) return part.slice(prefix.length);
  }
  return null;
}

function writeCookie(name: string, value: string): void {
  if (typeof document === "undefined") return;
  // `Secure` only when actually on https — omitting it on http keeps the
  // cookie working in local dev, where the whole funnel is tested.
  const secure = window.location.protocol === "https:" ? "; Secure" : "";
  document.cookie =
    `${name}=${value}; Max-Age=${MAX_AGE_SECONDS}; Path=/; SameSite=Lax${secure}`;
}

function persist(record: CampaignRecord): void {
  let encoded: string;
  try {
    encoded = encodeURIComponent(JSON.stringify(record));
  } catch {
    return; // unserialisable — nothing sensible to store
  }
  writeCookie(STORAGE_KEY, encoded);
  try {
    window.sessionStorage.setItem(STORAGE_KEY, encoded);
  } catch {
    /* storage unavailable (private mode / in-app browser) — cookie still stands */
  }
}

/* ------------------------------------------------------------------ *
 * Public API
 * ------------------------------------------------------------------ */

/** Read the stored campaign record, or `null` if this visit is untagged. */
export function readCampaign(): CampaignRecord | null {
  if (typeof window === "undefined") return null;
  let raw = readCookie(STORAGE_KEY);
  if (!raw) {
    try {
      raw = window.sessionStorage.getItem(STORAGE_KEY);
    } catch {
      raw = null;
    }
  }
  if (!raw) return null;
  try {
    const parsed = JSON.parse(decodeURIComponent(raw)) as CampaignRecord;
    // Guard against a hand-edited or truncated cookie producing a shape
    // the callers below would crash on.
    if (!parsed || typeof parsed !== "object") return null;
    return {
      utm: parsed.utm ?? {},
      clickIds: parsed.clickIds ?? {},
      segment: parsed.segment,
      landingPath: parsed.landingPath,
      referrer: parsed.referrer,
      capturedAt: parsed.capturedAt ?? new Date().toISOString(),
    };
  } catch {
    return null;
  }
}

/**
 * Parse the current URL, merge with anything already stored, and persist.
 *
 * Returns the effective record (existing one untouched when the current URL
 * carries no campaign parameters), or `null` when there is nothing to track.
 */
export function captureCampaign(
  options: { segment?: string } = {},
): CampaignRecord | null {
  if (typeof window === "undefined") return null;

  const params = new URLSearchParams(window.location.search);

  const utm: Partial<Record<UtmKey, string>> = {};
  for (const key of UTM_KEYS) {
    // 200 chars is well past any legitimate UTM value and keeps a crafted
    // link from bloating the cookie past what the browser will store.
    const value = params.get(key)?.trim().slice(0, 200);
    if (value) utm[key] = value;
  }

  const clickIds: Partial<Record<ClickIdKey, string>> = {};
  for (const key of CLICK_ID_KEYS) {
    const value = params.get(key)?.trim().slice(0, 200);
    if (value) clickIds[key] = value;
  }

  const hasIncoming =
    Object.keys(utm).length > 0 || Object.keys(clickIds).length > 0;
  const existing = readCampaign();

  // Internal navigation — keep the credit where it was, but let the landing
  // page stamp its segment onto an existing record so a visitor who arrived
  // on a generic ad and then picked a role is still attributed to that role.
  if (!hasIncoming) {
    if (!existing) return null;
    if (options.segment && existing.segment !== options.segment) {
      const updated = { ...existing, segment: options.segment };
      persist(updated);
      return updated;
    }
    return existing;
  }

  const record: CampaignRecord = {
    utm,
    clickIds,
    segment: options.segment ?? existing?.segment,
    landingPath: window.location.pathname,
    // Only the first touch's referrer is interesting; a later ad click
    // shouldn't overwrite "came from Instagram" with "came from our own site".
    referrer: existing?.referrer || document.referrer || undefined,
    capturedAt: new Date().toISOString(),
  };
  persist(record);
  return record;
}

/**
 * Flatten the stored campaign into plain `snake_case` fields, suitable for
 * an analytics payload or a form submission.
 */
export function campaignFields(): Record<string, string> {
  const record = readCampaign();
  if (!record) return {};
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(record.utm)) {
    if (value) out[key] = value;
  }
  for (const [key, value] of Object.entries(record.clickIds)) {
    if (value) out[key] = value;
  }
  if (record.segment) out.signup_segment = record.segment;
  if (record.landingPath) out.landing_path = record.landingPath;
  return out;
}

/**
 * Append the stored campaign parameters to an outbound URL.
 *
 * Used for app-store links and any hop that leaves the Next.js router, so
 * install attribution survives the jump. Parameters already present on the
 * target URL win — an explicitly-built link is never overwritten.
 */
export function withCampaign(url: string): string {
  const fields = campaignFields();
  if (Object.keys(fields).length === 0) return url;
  try {
    // `window.location.origin` is only a base for relative inputs; absolute
    // URLs ignore it entirely.
    const base =
      typeof window === "undefined" ? "https://quatatrade.com" : window.location.origin;
    const parsed = new URL(url, base);
    for (const [key, value] of Object.entries(fields)) {
      if (!parsed.searchParams.has(key)) parsed.searchParams.set(key, value);
    }
    // Preserve the original shape: relative in, relative out.
    return /^https?:\/\//i.test(url)
      ? parsed.toString()
      : `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return url;
  }
}

/**
 * Push a funnel event into the analytics layer.
 *
 * Deliberately transport-agnostic: it writes to `window.dataLayer`, which
 * is what GTM, GA4, the Meta pixel and the TikTok pixel all read from when
 * installed. If no tag manager is present this is a no-op that costs an
 * array push, so it is always safe to call.
 */
export function pushCampaignEvent(
  event: string,
  extra: Record<string, unknown> = {},
): void {
  if (typeof window === "undefined") return;
  const w = window as typeof window & { dataLayer?: unknown[] };
  w.dataLayer = w.dataLayer ?? [];
  try {
    w.dataLayer.push({ event, ...campaignFields(), ...extra });
  } catch {
    /* analytics must never break the signup flow */
  }
}
