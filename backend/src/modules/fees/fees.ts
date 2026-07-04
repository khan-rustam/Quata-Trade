/**
 * fees — review priority #1 (Documents/06-backend-modules.md).
 * Pure functions. No I/O, no floats, property-tested exhaustively.
 */

export class FeeError extends Error {}

/** floor(amount * bps / 10000) using pure bigint math. */
export function computeFee(amount: bigint, bps: number): bigint {
  if (amount < 0n) throw new FeeError("amount must be non-negative");
  if (!Number.isInteger(bps) || bps < 0 || bps > 10_000) {
    throw new FeeError(`bps out of range: ${bps}`);
  }
  // bigint division truncates toward zero == floor for non-negative operands
  return (amount * BigInt(bps)) / 10_000n;
}

export interface FeeSplit {
  buyerCredit: bigint;
  fee: bigint;
}

/** Split with the golden invariant: buyerCredit + fee === amount, exactly. */
export function split(amount: bigint, bps: number): FeeSplit {
  const fee = computeFee(amount, bps);
  const buyerCredit = amount - fee;
  /* v8 ignore next 3 -- mathematically unreachable: buyerCredit + fee always === amount; kept as a tripwire */
  if (buyerCredit + fee !== amount) {
    throw new FeeError("fee split invariant violated");
  }
  return { buyerCredit, fee };
}

/**
 * Fiat value of a crypto amount: floor(units * priceXafPerWholeUnit / 10^assetDecimals).
 * `amount` is in smallest units; price is XAF per WHOLE unit.
 */
export function fiatValueXaf(amount: bigint, priceXafPerUnit: bigint, assetDecimals: number): bigint {
  if (amount < 0n || priceXafPerUnit <= 0n) throw new FeeError("invalid fiat conversion input");
  if (!Number.isInteger(assetDecimals) || assetDecimals < 0 || assetDecimals > 18) {
    throw new FeeError("invalid asset decimals");
  }
  return (amount * priceXafPerUnit) / 10n ** BigInt(assetDecimals);
}
