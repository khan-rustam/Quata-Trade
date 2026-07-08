"use client";

import { useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useQuery } from "@tanstack/react-query";
import { ArrowDown, ArrowUp } from "lucide-react";
import type { MarketCoin, TrendingCoin } from "@quatatrade/shared";
import { Card } from "@/components/ui/card";
import { Segmented } from "@/components/ui/segmented";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/lib/api/client";

const REFRESH_MS = 120_000;
type Tab = "trending" | "gainers" | "losers" | "topVolume";

const nf = (o: Intl.NumberFormatOptions) => new Intl.NumberFormat("en", o);
const price = (n: number) => "$" + nf({ maximumFractionDigits: n !== 0 && n < 1 ? 6 : 2, minimumFractionDigits: 2 }).format(n);
const compact = (n: number) => "$" + nf({ notation: "compact", maximumFractionDigits: 2 }).format(n);

function Row({ coin, right }: { coin: TrendingCoin | MarketCoin; right?: React.ReactNode }): React.JSX.Element {
  return (
    <Link
      href={`/markets/${coin.id}`}
      className="flex items-center justify-between gap-2 rounded-lg px-2 py-1.5 hover:bg-surface-2"
    >
      <span className="flex min-w-0 items-center gap-2">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={coin.image} alt="" width={20} height={20} loading="lazy" className="rounded-full" />
        <span className="truncate text-sm font-medium">{coin.symbol}</span>
        <span className="truncate text-xs text-text-3">{coin.name}</span>
      </span>
      <span className="shrink-0 text-sm">{right}</span>
    </Link>
  );
}

function ChangeTag({ v }: { v: number | null }): React.JSX.Element {
  if (v === null) return <span className="text-text-3">—</span>;
  const up = v >= 0;
  return (
    <span className={`inline-flex items-center gap-0.5 font-money tabular-nums ${up ? "text-success" : "text-danger"}`}>
      {up ? <ArrowUp size={12} /> : <ArrowDown size={12} />}
      {Math.abs(v).toFixed(2)}%
    </span>
  );
}

export function MarketMovers(): React.JSX.Element {
  const tx = useTranslations("markets");
  const [tab, setTab] = useState<Tab>("trending");
  const { data, isLoading } = useQuery({
    queryKey: ["markets", "movers"],
    queryFn: () => api.marketsMovers(),
    refetchInterval: REFRESH_MS,
  });

  return (
    <Card className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-display text-lg font-medium">{tx("moversTitle")}</h2>
        <Segmented
          value={tab}
          onChange={(v) => setTab(v as Tab)}
          aria-label={tx("moversTitle")}
          options={[
            { value: "trending", label: tx("tabTrending") },
            { value: "gainers", label: tx("tabGainers"), tone: "success" },
            { value: "losers", label: tx("tabLosers"), tone: "danger" },
            { value: "topVolume", label: tx("tabVolume") },
          ]}
        />
      </div>

      {isLoading || !data ? (
        <Skeleton className="h-56 w-full" />
      ) : (
        <div className="grid gap-0.5 sm:grid-cols-2 lg:grid-cols-1">
          {tab === "trending" &&
            data.trending.slice(0, 8).map((c) => <Row key={c.id} coin={c} right={c.rank !== null ? `#${c.rank}` : ""} />)}
          {tab === "gainers" &&
            data.gainers.map((c) => (
              <Row key={c.id} coin={c} right={<span className="inline-flex items-center gap-2"><span className="font-money tabular-nums">{price(c.price)}</span><ChangeTag v={c.change24h} /></span>} />
            ))}
          {tab === "losers" &&
            data.losers.map((c) => (
              <Row key={c.id} coin={c} right={<span className="inline-flex items-center gap-2"><span className="font-money tabular-nums">{price(c.price)}</span><ChangeTag v={c.change24h} /></span>} />
            ))}
          {tab === "topVolume" &&
            data.topVolume.map((c) => <Row key={c.id} coin={c} right={<span className="font-money tabular-nums text-text-2">{compact(c.volume24h)}</span>} />)}
        </div>
      )}
    </Card>
  );
}
