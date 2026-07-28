"use client";

import { useEffect, useRef, useState } from "react";
import { formatFiat } from "@quatatrade/shared";
import { useLocale } from "next-intl";
import { useReducedMotion } from "motion/react";
import { formatUsdt } from "@/lib/format";
import { useUserMarket } from "@/hooks/use-user-market";
import { cn } from "@/lib/utils";

/**
 * Balance count-up (Documents/11 §11.7: "Balance updates: 300ms count-up").
 *
 * Deliberately narrow, because this is a money surface:
 *  - it animates ONLY between two server-confirmed values, on a real change while
 *    mounted. First paint renders the value outright — a balance counting up from 0
 *    reads as a balance that was briefly wrong.
 *  - it interpolates in INTEGER smallest units and formats every frame through
 *    `formatUsdt`, so no frame is ever a float artifact or a malformed amount.
 *  - the final frame is the exact canonical value, not the interpolation's last step.
 *
 * USDT-TRC20 is 6 decimals, so Number stays exact to ~9e9 USDT — far above any
 * balance this platform holds. Above that we skip the animation rather than risk
 * a lossy frame.
 */
function useCountUp(units: string | bigint, enabled: boolean): bigint {
  const target = typeof units === "bigint" ? units : BigInt(units || "0");
  const reduce = useReducedMotion();
  const prev = useRef<bigint | null>(null);
  const [shown, setShown] = useState<bigint>(target);

  useEffect(() => {
    const from = prev.current;
    prev.current = target;

    // First paint, disabled, reduced motion, no change, or out of exact-integer
    // range → show the real number immediately.
    if (
      from === null ||
      !enabled ||
      reduce ||
      from === target ||
      target > BigInt(Number.MAX_SAFE_INTEGER) ||
      from > BigInt(Number.MAX_SAFE_INTEGER)
    ) {
      setShown(target);
      return;
    }

    const start = performance.now();
    const a = Number(from);
    const b = Number(target);
    let raf = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / 300);
      const eased = 1 - Math.pow(1 - t, 3); // ease-out, §11.7
      if (t < 1) {
        setShown(BigInt(Math.round(a + (b - a) * eased)));
        raf = requestAnimationFrame(tick);
      } else {
        setShown(target); // land on the canonical value, never the eased approximation
      }
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, enabled, reduce]);

  return shown;
}

/**
 * Money display — always IBM Plex Mono, tabular, unit-labeled (Documents/11 §11.4).
 * Never do arithmetic in the UI; pass smallest-unit strings from the API.
 *
 * `animate` opts into the §11.7 balance count-up. Use it only on a headline balance
 * the user watches change — never on a static figure in a list or a confirm screen.
 */
export function Usdt({
  value,
  className,
  showUnit = true,
  size = "md",
  animate = false,
}: {
  value: string | bigint;
  className?: string;
  showUnit?: boolean;
  size?: "sm" | "md" | "lg" | "xl";
  animate?: boolean;
}): React.JSX.Element {
  const sizes = { sm: "text-sm", md: "text-base", lg: "text-lg", xl: "text-2xl" };
  const shown = useCountUp(value, animate);
  return (
    <span className={cn("font-money tabular-nums text-text-1", sizes[size], className)}>
      {formatUsdt(shown)}
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
