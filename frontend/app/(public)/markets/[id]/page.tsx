"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, ArrowUp, ArrowDown, CheckCircle2, Clock } from "lucide-react";
import type { ChartRange, MarketCoinDetail } from "@quatatrade/shared";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button, buttonClassName } from "@/components/ui/button";
import { Segmented } from "@/components/ui/segmented";
import { Skeleton } from "@/components/ui/skeleton";
import { LightweightChart } from "@/components/markets/lightweight-chart";
import { StarButton } from "@/components/markets/star-button";
import { useWatchlist } from "@/hooks/use-watchlist";
import { api } from "@/lib/api/client";

const REFRESH_MS = 60_000;
const RANGES: ChartRange[] = ["24h", "7d", "30d", "90d", "1y", "all"];

const nf = (o: Intl.NumberFormatOptions) => new Intl.NumberFormat("en", o);
const usd = (n: number | null) => (n === null ? "—" : "$" + nf({ notation: "compact", maximumFractionDigits: 2 }).format(n));
const price = (n: number | null) =>
  n === null ? "—" : "$" + nf({ maximumFractionDigits: n !== 0 && n < 1 ? 6 : 2, minimumFractionDigits: 2 }).format(n);
const supply = (n: number | null) => (n === null ? "—" : nf({ notation: "compact", maximumFractionDigits: 2 }).format(n));
const date = (s: string | null) => (s ? new Date(s).toLocaleDateString() : "—");

export default function MarketDetailPage(): React.JSX.Element {
  const tx = useTranslations("marketDetail");
  const params = useParams<{ id: string }>();
  const id = params.id;

  const { authed, ids, toggle } = useWatchlist();
  const [range, setRange] = useState<ChartRange>("7d");
  const [kind, setKind] = useState<"line" | "candlestick">("line");
  const [showFull, setShowFull] = useState(false);

  const coin = useQuery({ queryKey: ["markets", "coin", id], queryFn: () => api.marketsCoin(id), refetchInterval: REFRESH_MS });
  const chart = useQuery({
    queryKey: ["markets", "chart", id, range],
    queryFn: () => api.marketsChart(id, { range }),
    refetchInterval: REFRESH_MS,
  });

  const c: MarketCoinDetail | undefined = coin.data;

  return (
    <div className="mx-auto w-full max-w-5xl space-y-5 px-4 py-8">
      <Link href="/markets" className="inline-flex items-center gap-1.5 text-sm text-text-2 hover:text-text-1">
        <ArrowLeft size={15} /> {tx("back")}
      </Link>

      {coin.isLoading || !c ? (
        <Skeleton className="h-20 w-full" />
      ) : coin.error ? (
        <Card>
          <p className="text-text-2">{tx("loadError")}</p>
        </Card>
      ) : (
        <>
          {/* header */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={c.image} alt="" width={40} height={40} className="rounded-full" />
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="font-display text-xl font-bold">{c.name}</h1>
                  <span className="text-sm text-text-3">{c.symbol}</span>
                  {c.rank !== null && <Badge tone="neutral">#{c.rank}</Badge>}
                  {authed && <StarButton active={ids.has(c.id)} onToggle={() => toggle(c.id)} size={18} />}
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-money text-2xl font-bold tabular-nums">{price(c.price)}</span>
                  {c.change24h !== null && (
                    <span className={`inline-flex items-center gap-0.5 text-sm ${c.change24h >= 0 ? "text-success" : "text-danger"}`}>
                      {c.change24h >= 0 ? <ArrowUp size={13} /> : <ArrowDown size={13} />}
                      {Math.abs(c.change24h).toFixed(2)}%
                    </span>
                  )}
                </div>
              </div>
            </div>
            {c.symbol === "USDT" && (
              <Link href="/trade" className={buttonClassName({})}>
                {tx("trade")}
              </Link>
            )}
          </div>

          {/* chart */}
          <Card className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <Segmented
                value={range}
                onChange={(v) => setRange(v as ChartRange)}
                aria-label={tx("range")}
                options={RANGES.map((r) => ({ value: r, label: r }))}
              />
              <Segmented
                value={kind}
                onChange={(v) => setKind(v as "line" | "candlestick")}
                aria-label={tx("chartType")}
                options={[
                  { value: "line", label: tx("line") },
                  { value: "candlestick", label: tx("candles") },
                ]}
              />
            </div>
            {chart.isLoading ? (
              <Skeleton className="h-72 w-full" />
            ) : chart.isError ? (
              <div className="flex h-72 flex-col items-center justify-center gap-2 text-sm text-text-3">
                <span>{tx("chartError")}</span>
                <Button size="sm" variant="secondary" onClick={() => void chart.refetch()}>
                  {tx("retry")}
                </Button>
              </div>
            ) : chart.data && (chart.data.line.length > 1 || chart.data.candles.length > 1) ? (
              <LightweightChart chart={chart.data} kind={kind} />
            ) : (
              <div className="flex h-72 items-center justify-center text-sm text-text-3">{tx("chartEmpty")}</div>
            )}
          </Card>

          {/* stats */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            <Stat label={tx("high24h")} value={price(c.high24h)} />
            <Stat label={tx("low24h")} value={price(c.low24h)} />
            <Stat label={tx("ath")} value={price(c.ath)} sub={date(c.athDate)} />
            <Stat label={tx("atl")} value={price(c.atl)} sub={date(c.atlDate)} />
            <Stat label={tx("marketCap")} value={usd(c.marketCap)} />
            <Stat label={tx("fdv")} value={usd(c.fdv)} />
            <Stat label={tx("volume")} value={usd(c.volume24h)} />
            <Stat label={tx("circulating")} value={supply(c.circulatingSupply)} />
            <Stat label={tx("totalSupply")} value={supply(c.totalSupply)} />
            <Stat label={tx("maxSupply")} value={supply(c.maxSupply)} />
          </div>

          {/* QuataTrade availability / networks */}
          <Card className="space-y-3">
            <p className="font-medium">{tx("networksTitle")}</p>
            {c.symbol === "USDT" ? <UsdtNetworks /> : <p className="text-sm text-text-3">{tx("notSupported", { symbol: c.symbol })}</p>}
          </Card>

          {/* description */}
          {c.description && (
            <Card className="space-y-2">
              <p className="font-medium">{tx("about", { name: c.name })}</p>
              <p className={`text-sm text-text-2 ${showFull ? "" : "line-clamp-4"}`}>{c.description}</p>
              {c.description.length > 280 && (
                <Button size="sm" variant="ghost" onClick={() => setShowFull((s) => !s)}>
                  {showFull ? tx("showLess") : tx("showMore")}
                </Button>
              )}
            </Card>
          )}
        </>
      )}
    </div>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }): React.JSX.Element {
  return (
    <Card className="space-y-0.5">
      <p className="text-xs text-text-3">{label}</p>
      <p className="font-money text-sm font-semibold tabular-nums">{value}</p>
      {sub && <p className="text-xs text-text-3">{sub}</p>}
    </Card>
  );
}

function UsdtNetworks(): React.JSX.Element {
  const tx = useTranslations("marketDetail");
  const nets = [
    { name: "TRON (TRC20)", supported: true, conf: "19", eta: "~1 min" },
    { name: "Ethereum (ERC20)", supported: false },
    { name: "BNB Smart Chain", supported: false },
    { name: "Polygon", supported: false },
    { name: "Solana", supported: false },
  ];
  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <table className="w-full min-w-120 text-sm">
        <thead className="border-b border-border bg-surface-2 text-left text-xs uppercase tracking-wide text-text-3">
          <tr>
            <th className="px-3 py-2 font-medium">{tx("network")}</th>
            <th className="px-3 py-2 font-medium">{tx("status")}</th>
            <th className="px-3 py-2 font-medium">{tx("confirmations")}</th>
            <th className="px-3 py-2 font-medium">{tx("eta")}</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {nets.map((n) => (
            <tr key={n.name}>
              <td className="px-3 py-2">{n.name}</td>
              <td className="px-3 py-2">
                {n.supported ? (
                  <Badge tone="success" icon={<CheckCircle2 size={12} />}>
                    {tx("supported")}
                  </Badge>
                ) : (
                  <Badge tone="neutral" icon={<Clock size={12} />}>
                    {tx("soon")}
                  </Badge>
                )}
              </td>
              <td className="px-3 py-2 text-text-2">{n.conf ?? "—"}</td>
              <td className="px-3 py-2 text-text-2">{n.eta ?? "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
