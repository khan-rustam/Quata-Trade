/**
 * Indicative USDT→local-fiat rates — DISPLAY ONLY. Real trades price off the
 * seller's `priceXafPerUnit` (offer/trade flow) and `api.feePreview`, never these.
 * There is no live feed yet; keyed by ISO currency so each market shows its own
 * hint (or none). Add a currency here when that market goes live, or replace the
 * whole map when a rate service lands.
 */
export const INDICATIVE_RATES: Record<string, number> = {
  XAF: 650,
};

/** Indicative rate for a currency, or null when we don't have one yet (hide the hint). */
export function indicativeRate(currencyCode: string): number | null {
  return INDICATIVE_RATES[currencyCode] ?? null;
}
