/**
 * fees — review priority #1 (Documents/06-backend-modules.md).
 * Pure functions. No I/O, no floats, property-tested exhaustively.
 */
import { MAX_FEE_BPS } from "@quatatrade/shared";

export class FeeError extends Error {}

/** floor(amount * bps / 10000) using pure bigint math. */
export function computeFee(amount: bigint, bps: number): bigint {
  if (amount < 0n) throw new FeeError("amount must be non-negative");
  // Upper bound is MAX_FEE_BPS (< 10000): a 100% fee makes fee === amount and would
  // violate the trades `fee_amount < amount` CHECK. Guard here so a bad bps fails
  // loudly and early rather than at trade-insert time.
  if (!Number.isInteger(bps) || bps < 0 || bps > MAX_FEE_BPS) {
    throw new FeeError(`bps out of range: ${bps}`);
  }
  // bigint division truncates toward zero == floor for non-negative operands
  return (amount * BigInt(bps)) / 10_000n;
}

/**
 * Platform deposit fee = fixedFee + floor(amount * bps / 10000). Pure bigint math.
 * The caller (deposit credit path) must ensure the resulting fee is strictly less
 * than the deposit amount (the min-deposit policy + the config refine guarantee it)
 * so the net credit stays positive and no zero-value ledger leg is posted.
 */
export function computeDepositFee(amount: bigint, fixedFee: bigint, bps: number): bigint {
  if (fixedFee < 0n) throw new FeeError("fixed deposit fee must be non-negative");
  return fixedFee + computeFee(amount, bps); // computeFee guards amount >= 0 and the bps range
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

export interface PerSideSplit {
  buyerFee: bigint; // borne by the buyer — deducted from what they receive
  sellerFee: bigint; // borne by the seller — added to what they escrow
  buyerCredit: bigint; // amount − buyerFee (credited to the buyer on release)
  sellerLock: bigint; // amount + sellerFee (moved to escrow at lock time)
  totalFee: bigint; // buyerFee + sellerFee (credited to treasury on release)
}

/**
 * Per-side trading fee (fee-engine Phase 2). The seller escrows amount + sellerFee;
 * on release the buyer receives amount − buyerFee and treasury receives both fees.
 * ESCROW-CONSERVATION invariant: sellerLock === buyerCredit + totalFee, exactly — so
 * everything the seller locks leaves escrow with no rounding leak. Both bps are
 * bounded by MAX_FEE_BPS (< 10000) via computeFee, keeping buyerCredit > 0.
 */
export function splitPerSide(amount: bigint, buyerBps: number, sellerBps: number): PerSideSplit {
  const buyerFee = computeFee(amount, buyerBps);
  const sellerFee = computeFee(amount, sellerBps);
  const buyerCredit = amount - buyerFee;
  const sellerLock = amount + sellerFee;
  const totalFee = buyerFee + sellerFee;
  /* v8 ignore next 3 -- unreachable: (amount−buyerFee)+(buyerFee+sellerFee) always === amount+sellerFee */
  if (sellerLock !== buyerCredit + totalFee) {
    throw new FeeError("per-side fee split invariant violated");
  }
  return { buyerFee, sellerFee, buyerCredit, sellerLock, totalFee };
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
