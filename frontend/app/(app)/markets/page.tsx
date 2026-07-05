"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { ArrowDownRight, ArrowUpRight, TrendingUp } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { buttonClassName } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useUserMarket } from "@/hooks/use-user-market";
import { indicativeRate } from "@/lib/market";

/**
 * Markets — single asset in Phase 1 (USDT/XAF). Layout is built to scale to
 * more assets later. Live price feed + lightweight-charts land with the rate
 * service; this shows the indicative rate and routes into Trade.
 */
export default function MarketsPage(): React.JSX.Element {
  const tx = useTranslations("markets");
  const market = useUserMarket();
  const rate = indicativeRate(market.currencyCode);
  const high = rate !== null ? Math.round(rate * 1.006) : null;
  const low = rate !== null ? Math.round(rate * 0.994) : null;
  const dash = "—";
  return (
    <div className="space-y-5">
      <PageHeader title={tx("title")} subtitle={tx("subtitle")} />

      <Card>
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-full bg-accent-400/15 font-display text-sm font-bold text-accent-400">
              USDT
            </span>
            <div>
              <p className="font-medium">Tether · USDT</p>
              <p className="text-xs text-text-3">TRON (TRC20)</p>
            </div>
          </div>
          <Badge tone="success" icon={<TrendingUp size={12} />}>
            {tx("indicative")}
          </Badge>
        </div>

        <div className="mt-5 flex items-end justify-between">
          <div>
            <p className="font-money text-3xl font-bold tabular-nums">
              {rate !== null ? `${rate.toLocaleString()} ${market.currencyCode}` : dash}
            </p>
            <p className="text-sm text-text-2">{tx("perUsdt")}</p>
          </div>
          <div className="text-right text-sm">
            <p className="flex items-center justify-end gap-1 text-success">
              <ArrowUpRight size={14} /> +0.4%
            </p>
            <p className="text-text-3">24h</p>
          </div>
        </div>

        <div className="mt-5 grid grid-cols-3 gap-2 text-center text-sm">
          <Stat label={tx("high24h")} value={high !== null ? high.toLocaleString() : dash} up />
          <Stat label={tx("low24h")} value={low !== null ? low.toLocaleString() : dash} />
          <Stat label={tx("spread")} value="~1.2%" />
        </div>

        <div className="mt-5 grid grid-cols-2 gap-2">
          <Link href="/trade?side=BUY" className={buttonClassName({ className: "w-full" })}>
            <ArrowDownRight size={16} /> {tx("buyUsdt")}
          </Link>
          <Link href="/trade?side=SELL" className={buttonClassName({ variant: "secondary", className: "w-full" })}>
            <ArrowUpRight size={16} /> {tx("sellUsdt")}
          </Link>
        </div>
      </Card>

      <Card className="text-sm text-text-2">{tx("disclaimer")}</Card>
    </div>
  );
}

function Stat({ label, value, up }: { label: string; value: string; up?: boolean }): React.JSX.Element {
  return (
    <div className="rounded-lg bg-surface-2 p-2.5">
      <p className="text-xs text-text-3">{label}</p>
      <p className={`font-money text-sm font-medium tabular-nums ${up ? "text-success" : "text-text-1"}`}>{value}</p>
    </div>
  );
}
