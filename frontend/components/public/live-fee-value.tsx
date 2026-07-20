"use client";

import { useQuery } from "@tanstack/react-query";
import { toDisplay, type FeeSchedule } from "@quatatrade/shared";
import { api } from "@/lib/api/client";

/**
 * Renders a fee from the LIVE configured schedule.
 *
 * These numbers used to live in the translation catalogue, which is how the page
 * came to advertise a 0 USDT withdrawal fee while `withdrawal_fee` was set to
 * 1 USDT and every withdrawal was charged it. Reading the configured value means
 * the published figure cannot contradict what is taken, and an admin changing a
 * fee updates this page without anyone remembering to edit the copy.
 *
 * `fallback` is the catalogue string, shown until the schedule loads and if the
 * request fails — a marketing page must never render a blank where a price goes.
 */
export function LiveFeeValue({
  row,
  fallback,
}: {
  row: "buyerFee" | "sellerFee" | "depositFee" | "withdrawalFee" | "adFee" | "disputeFee";
  fallback: string;
}): React.JSX.Element {
  const { data } = useQuery({
    queryKey: ["fee-schedule"],
    queryFn: () => api.feeSchedule(),
    staleTime: 5 * 60_000,
  });

  return <>{data ? format(row, data, fallback) : fallback}</>;
}

function format(row: string, s: FeeSchedule, fallback: string): string {
  switch (row) {
    // NOT 0 by design: computeTradeFees charges the buyer the per-rail trading
    // bps (deducted from what they receive) and the seller sellerFeeBps. Publishing
    // a flat "0%" understated a fee the engine actually takes. Rails can differ, so
    // show the configured range rather than pick one.
    case "buyerFee":
      return bpsRange(s.tradingFeeBps);
    case "sellerFee":
      return pct(s.sellerFeeBps);
    case "depositFee":
      return amount(s.depositFee.fixed, s.depositFee.bps);
    case "withdrawalFee":
      return amount(s.withdrawalFee.fixed, s.withdrawalFee.bps);
    // Not part of the schedule contract — these stay catalogue copy.
    default:
      return fallback;
  }
}

/**
 * The configured per-rail range. A promotion can waive this for a market, but
 * promo overrides are per-country and this page has no country context — so it
 * publishes the base schedule and the promo note beside it does the rest.
 * Overstating a fee is the safe direction; understating it is not.
 */
function bpsRange(byRail: Record<string, number>): string {
  const values = Object.values(byRail);
  if (values.length === 0) return "0%";
  const lo = Math.min(...values);
  const hi = Math.max(...values);
  return lo === hi ? pct(lo) : `${pct(lo)}–${pct(hi)}`;
}

/** bps → percent, trimming a trailing ".0" so 0 renders as "0%" not "0.0%". */
function pct(bps: number): string {
  const v = bps / 100;
  return `${Number.isInteger(v) ? v : v.toFixed(2).replace(/0$/, "")}%`;
}

/**
 * A fee is fixed + percentage. Display only — toDisplay is the project's
 * decimal.js formatter, so the smallest-unit string never becomes a JS number.
 */
function amount(fixed: string, bps: number): string {
  const flat = `${toDisplay(fixed, "USDT_TRC20", 2)} USDT`;
  return bps > 0 ? `${flat} + ${pct(bps)}` : flat;
}
