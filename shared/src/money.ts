import Decimal from "decimal.js";
import { ASSET_DECIMALS, type AssetCode } from "./constants.js";

/**
 * Money discipline (Documents/02-tech-stack.md):
 * - Amounts are BIGINT smallest units everywhere past the display layer.
 * - JSON has no bigint → amounts travel as decimal strings ("1500000").
 * - decimal.js is used ONLY to convert to/from human display values.
 * - Components/services must never do arithmetic on display values.
 */

Decimal.set({ precision: 40, rounding: Decimal.ROUND_DOWN });

/** Matches a non-negative integer amount string (smallest units). */
export const AMOUNT_REGEX = /^(0|[1-9]\d*)$/;

export function isAmountString(value: string): boolean {
  return AMOUNT_REGEX.test(value);
}

/** Parse a wire amount string into bigint. Throws on malformed input. */
export function parseAmount(value: string): bigint {
  if (!isAmountString(value)) {
    throw new Error(`Invalid amount string: "${value}"`);
  }
  return BigInt(value);
}

/** Serialize a bigint amount for the wire. Rejects negatives (wire amounts are magnitudes). */
export function serializeAmount(value: bigint): string {
  if (value < 0n) {
    throw new Error("Wire amounts must be non-negative");
  }
  return value.toString(10);
}

/** Convert smallest units → human display string, e.g. 1500000n → "1.50" (USDT). */
export function toDisplay(
  amount: bigint | string,
  asset: AssetCode = "USDT_TRC20",
  displayDecimals = 2,
): string {
  const units = typeof amount === "string" ? parseAmount(amount) : amount;
  const decimals = ASSET_DECIMALS[asset];
  return new Decimal(units.toString())
    .div(new Decimal(10).pow(decimals))
    .toFixed(displayDecimals, Decimal.ROUND_DOWN);
}

/**
 * Convert a human-entered decimal string → smallest units bigint.
 * Rejects more precision than the asset supports (never silently rounds money).
 */
export function fromDisplay(value: string, asset: AssetCode = "USDT_TRC20"): bigint {
  const trimmed = value.trim();
  if (!/^\d+(\.\d+)?$/.test(trimmed)) {
    throw new Error(`Invalid display amount: "${value}"`);
  }
  const decimals = ASSET_DECIMALS[asset];
  const [, frac = ""] = trimmed.split(".");
  if (frac.length > decimals) {
    throw new Error(`Too many decimal places for ${asset}: max ${decimals}`);
  }
  const units = new Decimal(trimmed).mul(new Decimal(10).pow(decimals));
  if (!units.isInteger()) {
    throw new Error(`Amount does not convert to integer units: "${value}"`);
  }
  return BigInt(units.toFixed(0));
}

/** Format XAF (whole francs, no decimals) with thousands separators for display. */
export function formatXAF(amount: bigint | string): string {
  const units = typeof amount === "string" ? parseAmount(amount) : amount;
  return `${units.toLocaleString("fr-FR")} XAF`;
}

/**
 * Format a fiat amount for any market. Amounts are stored as WHOLE local-currency
 * units (e.g. XAF francs, NGN naira), so this only groups the number and appends the
 * market's currency code — no smallest-unit division. `locale` controls grouping style.
 */
export function formatFiat(amount: bigint | string, currencyCode: string, locale = "en"): string {
  const units = typeof amount === "string" ? parseAmount(amount) : amount;
  const grouped = units.toLocaleString(locale === "fr" ? "fr-FR" : "en-US");
  return `${grouped} ${currencyCode}`;
}
