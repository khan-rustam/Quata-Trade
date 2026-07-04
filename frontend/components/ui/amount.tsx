"use client";

import { formatFiat } from "@quatatrade/shared";
import { useLocale } from "next-intl";
import { formatUsdt } from "@/lib/format";
import { useUserMarket } from "@/hooks/use-user-market";
import { cn } from "@/lib/utils";

/**
 * Money display — always IBM Plex Mono, tabular, unit-labeled (Documents/11 §11.4).
 * Never do arithmetic in the UI; pass smallest-unit strings from the API.
 */
export function Usdt({
  value,
  className,
  showUnit = true,
  size = "md",
}: {
  value: string | bigint;
  className?: string;
  showUnit?: boolean;
  size?: "sm" | "md" | "lg" | "xl";
}): React.JSX.Element {
  const sizes = { sm: "text-sm", md: "text-base", lg: "text-lg", xl: "text-2xl" };
  return (
    <span className={cn("font-money tabular-nums text-text-1", sizes[size], className)}>
      {formatUsdt(value)}
      {showUnit && <span className="ml-1 text-text-2">USDT</span>}
    </span>
  );
}

/**
 * Local fiat amount, rendered in the SIGNED-IN user's market currency (XAF, NGN, …).
 * Amounts are stored as whole local-currency units, so this only labels + groups them.
 * Falls back to XAF on public/pre-auth surfaces.
 */
export function Xaf({ value, className }: { value: string | bigint; className?: string }): React.JSX.Element {
  const { currencyCode } = useUserMarket();
  const locale = useLocale();
  return (
    <span className={cn("font-money tabular-nums text-text-1", className)}>
      {formatFiat(value, currencyCode, locale)}
    </span>
  );
}
