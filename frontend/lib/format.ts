import { toDisplay, formatXAF as sharedFormatXAF, type AssetCode } from "@quatatrade/shared";

/** USDT amount (smallest units string) → "1,234.56" grouped for display. */
export function formatUsdt(units: string | bigint, asset: AssetCode = "USDT_TRC20", decimals = 2): string {
  const plain = toDisplay(units, asset, decimals);
  const [whole = "0", frac] = plain.split(".");
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return frac !== undefined ? `${grouped}.${frac}` : grouped;
}

/** XAF whole-franc amount → "97 500 XAF". */
export function formatXaf(units: string | bigint): string {
  return sharedFormatXAF(units);
}

/**
 * Compact offer price like "650 XAF" / "1,600,000 NGN" per USDT. Prices are whole
 * local-currency units; `currencyCode` defaults to XAF for public/CM surfaces.
 */
export function formatRate(priceXafPerUnit: string | bigint, currencyCode = "XAF", locale = "en"): string {
  const n = typeof priceXafPerUnit === "string" ? priceXafPerUnit : priceXafPerUnit.toString();
  return `${Number(n).toLocaleString(locale === "fr" ? "fr-FR" : "en-US")} ${currencyCode}`;
}

/** Truncate a TRON address / hash for display: TQ12…9fZ. */
export function shortHash(value: string, head = 6, tail = 4): string {
  if (value.length <= head + tail + 1) return value;
  return `${value.slice(0, head)}…${value.slice(-tail)}`;
}

/** Locale-aware absolute date-time. */
export function formatDateTime(iso: string, locale = "en"): string {
  return new Date(iso).toLocaleString(locale === "fr" ? "fr-FR" : "en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Short relative time ("2m ago", "il y a 2 min"). */
export function timeAgo(iso: string, locale = "en"): string {
  const diff = Date.now() - new Date(iso).getTime();
  const sec = Math.round(diff / 1000);
  const rtf = new Intl.RelativeTimeFormat(locale === "fr" ? "fr" : "en", { numeric: "auto" });
  if (sec < 60) return rtf.format(-sec, "second");
  const min = Math.round(sec / 60);
  if (min < 60) return rtf.format(-min, "minute");
  const hr = Math.round(min / 60);
  if (hr < 24) return rtf.format(-hr, "hour");
  return rtf.format(-Math.round(hr / 24), "day");
}

/** mm:ss countdown from a future ISO deadline; clamps at 0. */
export function msToDeadline(deadlineIso: string | null): number {
  if (!deadlineIso) return 0;
  return Math.max(0, new Date(deadlineIso).getTime() - Date.now());
}

export function formatClock(ms: number): string {
  const total = Math.floor(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}
