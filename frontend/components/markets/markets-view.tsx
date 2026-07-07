"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useQuery } from "@tanstack/react-query";
import { ArrowDown, ArrowUp, ArrowUpDown, Search, TrendingUp, TrendingDown } from "lucide-react";
import type { MarketCoin } from "@quatatrade/shared";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button, buttonClassName } from "@/components/ui/button";
import { Segmented } from "@/components/ui/segmented";
import { Skeleton } from "@/components/ui/skeleton";
import { Sparkline } from "./sparkline";
import { StarButton } from "./star-button";
import { FearGreedGauge } from "./fear-greed";
import { useWatchlist } from "@/hooks/use-watchlist";
import { api } from "@/lib/api/client";

const REFRESH_MS = 60_000;
const PER_PAGE = 100;

const nf = (opts: Intl.NumberFormatOptions) => new Intl.NumberFormat("en", opts);
const usdCompact = (n: number) => "$" + nf({ notation: "compact", maximumFractionDigits: 2 }).format(n);
const compact = (n: number | null) => (n === null ? "—" : nf({ notation: "compact", maximumFractionDigits: 2 }).format(n));
const price = (n: number) => "$" + nf({ maximumFractionDigits: n !== 0 && n < 1 ? 6 : 2, minimumFractionDigits: 2 }).format(n);
const pct = (n: number | null) => (n === null ? "—" : `${n >= 0 ? "+" : ""}${n.toFixed(2)}%`);

function Change({ value }: { value: number | null }): React.JSX.Element {
  if (value === null) return <span className="text-text-3">—</span>;
  const up = value >= 0;
  return (
    <span className={`inline-flex items-center gap-0.5 font-money tabular-nums ${up ? "text-success" : "text-danger"}`}>
      {up ? <ArrowUp size={12} /> : <ArrowDown size={12} />}
      {pct(Math.abs(value))}
    </span>
  );
}

type SortKey = "rank" | "price" | "change1h" | "change24h" | "change7d" | "marketCap" | "volume24h";

export function MarketsView(): React.JSX.Element {
  const tx = useTranslations("markets");
  const { authed, ids, toggle } = useWatchlist();
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [wlOnly, setWlOnly] = useState(false);
  const [sort, setSort] = useState<{ key: SortKey; dir: "asc" | "desc" }>({ key: "rank", dir: "asc" });

  const global = useQuery({ queryKey: ["markets", "global"], queryFn: () => api.marketsGlobal(), refetchInterval: REFRESH_MS });
  const coins = useQuery({
    queryKey: ["markets", "coins", page],
    queryFn: () => api.marketsCoins({ page: String(page), perPage: String(PER_PAGE) }),
    refetchInterval: REFRESH_MS,
  });

  const rows = useMemo(() => {
    let list = coins.data?.items ?? [];
    const term = q.trim().toLowerCase();
    if (term) list = list.filter((c) => c.name.toLowerCase().includes(term) || c.symbol.toLowerCase().includes(term));
    if (wlOnly) list = list.filter((c) => ids.has(c.id));
    const dir = sort.dir === "asc" ? 1 : -1;
    return [...list].sort((a, b) => {
      const av = a[sort.key];
      const bv = b[sort.key];
      if (av === null) return 1; // nulls last
      if (bv === null) return -1;
      return (av - bv) * dir;
    });
  }, [coins.data, q, sort, wlOnly, ids]);

  const featured = coins.data?.items.slice(0, 8) ?? [];

  const toggleSort = (key: SortKey) =>
    setSort((s) => (s.key === key ? { key, dir: s.dir === "asc" ? "desc" : "asc" } : { key, dir: key === "rank" ? "asc" : "desc" }));

  return (
    <div className="mx-auto w-full max-w-6xl space-y-8 px-4 py-8">
      <header className="space-y-1">
        <h1 className="font-display text-2xl font-bold">{tx("title")}</h1>
        <p className="text-text-2">{tx("subtitle")}</p>
      </header>

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {global.isLoading || !global.data ? (
          Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-20 rounded-xl" />)
        ) : (
          <>
            <OverviewTile label={tx("totalMcap")} value={usdCompact(global.data.totalMarketCap)} delta={global.data.marketCapChange24h} />
            <OverviewTile label={tx("volume24h")} value={usdCompact(global.data.totalVolume24h)} />
            <OverviewTile label={tx("btcDom")} value={`${global.data.btcDominance.toFixed(1)}%`} />
            <OverviewTile label={tx("ethDom")} value={`${global.data.ethDominance.toFixed(1)}%`} />
            <OverviewTile label={tx("activeCryptos")} value={nf({ notation: "compact" }).format(global.data.activeCryptos)} />
          </>
        )}
      </section>

      <section className="grid gap-3 md:grid-cols-2">
        <FearGreedGauge />
        <Card className="flex flex-col items-start justify-center gap-2">
          <p className="font-medium">{tx("compareTitle")}</p>
          <p className="text-sm text-text-2">{tx("compareBody")}</p>
          <Link href="/markets/compare" className={buttonClassName({ size: "sm", variant: "secondary" })}>
            {tx("compareCta")}
          </Link>
        </Card>
      </section>

      <section className="space-y-3">
        <h2 className="font-display text-lg font-medium">{tx("featured")}</h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {coins.isLoading
            ? Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-28 rounded-xl" />)
            : featured.map((c) => (
                <div key={c.id} className="relative">
                  <Link href={`/markets/${c.id}`} className="block">
                    <FeaturedCard c={c} />
                  </Link>
                  {authed && (
                    <div className="absolute right-3 top-3">
                      <StarButton active={ids.has(c.id)} onToggle={() => toggle(c.id)} />
                    </div>
                  )}
                </div>
              ))}
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="font-display text-lg font-medium">{tx("supportedTitle")}</h2>
        <Card className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-accent-400/15 font-display text-xs font-bold text-accent-400">
              USDT
            </span>
            <div>
              <p className="font-medium">Tether · USDT</p>
              <p className="text-xs text-text-3">TRON (TRC20)</p>
            </div>
            <Badge tone="success">{tx("tradingEnabled")}</Badge>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-text-3">{tx("comingSoon")}: BTC · ETH · BNB · SOL · XRP</span>
            <Link href="/trade" className={buttonClassName({ size: "sm" })}>
              {tx("tradeUsdt")}
            </Link>
          </div>
        </Card>
      </section>

      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-display text-lg font-medium">{tx("allCoins")}</h2>
          <div className="flex flex-wrap items-center gap-2">
            {authed && (
              <Segmented
                value={wlOnly ? "watch" : "all"}
                onChange={(v) => setWlOnly(v === "watch")}
                aria-label={tx("filterLabel")}
                options={[
                  { value: "all", label: tx("filterAll") },
                  { value: "watch", label: tx("filterWatch") },
                ]}
              />
            )}
            <div className="relative">
              <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-text-3" />
              <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder={tx("searchPlaceholder")} className="w-64 pl-9" />
            </div>
          </div>
        </div>

        <div className="overflow-x-auto rounded-xl border border-border">
          <table className="w-full min-w-200 text-sm">
            <thead className="border-b border-border bg-surface-2 text-left text-xs uppercase tracking-wide text-text-3">
              <tr>
                <Th onClick={() => toggleSort("rank")} active={sort.key === "rank"} dir={sort.dir}>#</Th>
                <th className="px-3 py-2.5 font-medium">{tx("colName")}</th>
                <Th onClick={() => toggleSort("price")} active={sort.key === "price"} dir={sort.dir} right>{tx("colPrice")}</Th>
                <Th onClick={() => toggleSort("change1h")} active={sort.key === "change1h"} dir={sort.dir} right>1h</Th>
                <Th onClick={() => toggleSort("change24h")} active={sort.key === "change24h"} dir={sort.dir} right>24h</Th>
                <Th onClick={() => toggleSort("change7d")} active={sort.key === "change7d"} dir={sort.dir} right>7d</Th>
                <Th onClick={() => toggleSort("marketCap")} active={sort.key === "marketCap"} dir={sort.dir} right>{tx("colMcap")}</Th>
                <Th onClick={() => toggleSort("volume24h")} active={sort.key === "volume24h"} dir={sort.dir} right>{tx("colVolume")}</Th>
                <th className="px-3 py-2.5 font-medium">7d</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {coins.isLoading ? (
                <tr>
                  <td colSpan={9} className="px-3 py-6">
                    <Skeleton className="h-40 w-full" />
                  </td>
                </tr>
              ) : coins.error ? (
                <tr>
                  <td colSpan={9} className="px-3 py-8 text-center text-text-3">
                    {tx("loadError")}
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-3 py-8 text-center text-text-3">
                    {tx("noResults")}
                  </td>
                </tr>
              ) : (
                rows.map((c) => (
                  <tr key={c.id} className="hover:bg-surface-2">
                    <td className="px-3 py-2.5 text-text-3">{c.rank ?? "—"}</td>
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-2">
                        {authed && <StarButton active={ids.has(c.id)} onToggle={() => toggle(c.id)} size={14} />}
                        <Link href={`/markets/${c.id}`} className="flex items-center gap-2 hover:text-accent-400">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={c.image} alt="" width={22} height={22} loading="lazy" className="rounded-full" />
                          <span className="font-medium">{c.name}</span>
                          <span className="text-xs text-text-3">{c.symbol}</span>
                        </Link>
                      </div>
                    </td>
                    <td className="px-3 py-2.5 text-right font-money tabular-nums">{price(c.price)}</td>
                    <td className="px-3 py-2.5 text-right"><Change value={c.change1h} /></td>
                    <td className="px-3 py-2.5 text-right"><Change value={c.change24h} /></td>
                    <td className="px-3 py-2.5 text-right"><Change value={c.change7d} /></td>
                    <td className="px-3 py-2.5 text-right font-money tabular-nums">{usdCompact(c.marketCap)}</td>
                    <td className="px-3 py-2.5 text-right font-money tabular-nums">{usdCompact(c.volume24h)}</td>
                    <td className="px-3 py-2.5">
                      <Sparkline data={c.sparkline} className="h-8 w-24" />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-between">
          <Button size="sm" variant="secondary" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1 || coins.isFetching}>
            {tx("prev")}
          </Button>
          <span className="text-sm text-text-3">{tx("pageN", { n: page })}</span>
          <Button
            size="sm"
            variant="secondary"
            onClick={() => setPage((p) => p + 1)}
            disabled={coins.isFetching || (coins.data?.items.length ?? 0) < PER_PAGE}
          >
            {tx("next")}
          </Button>
        </div>
        <p className="text-xs text-text-3">{tx("dataNote")}</p>
      </section>
    </div>
  );
}

function OverviewTile({ label, value, delta }: { label: string; value: string; delta?: number }): React.JSX.Element {
  return (
    <Card className="space-y-1">
      <p className="text-xs text-text-3">{label}</p>
      <p className="font-money text-lg font-semibold tabular-nums">{value}</p>
      {delta !== undefined && (
        <span className={`inline-flex items-center gap-0.5 text-xs ${delta >= 0 ? "text-success" : "text-danger"}`}>
          {delta >= 0 ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
          {pct(delta)}
        </span>
      )}
    </Card>
  );
}

function FeaturedCard({ c }: { c: MarketCoin }): React.JSX.Element {
  return (
    <Card className="space-y-2">
      <div className="flex items-center gap-2">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={c.image} alt="" width={24} height={24} loading="lazy" className="rounded-full" />
        <span className="font-medium">{c.symbol}</span>
        <span className="truncate text-xs text-text-3">{c.name}</span>
      </div>
      <div className="flex items-end justify-between">
        <p className="font-money text-lg font-semibold tabular-nums">{price(c.price)}</p>
        <Change value={c.change24h} />
      </div>
      <Sparkline data={c.sparkline} className="h-8 w-full" />
      <div className="flex justify-between text-xs text-text-3">
        <span>{compact(c.marketCap)}</span>
        <span>Vol {compact(c.volume24h)}</span>
      </div>
    </Card>
  );
}

function Th({
  children,
  onClick,
  active,
  dir,
  right,
}: {
  children: React.ReactNode;
  onClick: () => void;
  active: boolean;
  dir: "asc" | "desc";
  right?: boolean;
}): React.JSX.Element {
  return (
    <th className={`px-3 py-2.5 font-medium ${right ? "text-right" : ""}`}>
      <button
        type="button"
        onClick={onClick}
        className={`inline-flex items-center gap-1 hover:text-text-1 ${active ? "text-text-1" : ""} ${right ? "flex-row-reverse" : ""}`}
      >
        {children}
        {active ? dir === "asc" ? <ArrowUp size={11} /> : <ArrowDown size={11} /> : <ArrowUpDown size={11} className="opacity-40" />}
      </button>
    </th>
  );
}
