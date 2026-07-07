"use client";

import { useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, ArrowUp, ArrowDown } from "lucide-react";
import type { MarketCoin } from "@quatatrade/shared";
import { Card } from "@/components/ui/card";
import { Select } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Sparkline } from "@/components/markets/sparkline";
import { api } from "@/lib/api/client";

const nf = (o: Intl.NumberFormatOptions) => new Intl.NumberFormat("en", o);
const usd = (n: number) => "$" + nf({ notation: "compact", maximumFractionDigits: 2 }).format(n);
const price = (n: number) => "$" + nf({ maximumFractionDigits: n !== 0 && n < 1 ? 6 : 2, minimumFractionDigits: 2 }).format(n);
const supply = (n: number | null) => (n === null ? "—" : nf({ notation: "compact", maximumFractionDigits: 2 }).format(n));

function Pct({ v }: { v: number | null }): React.JSX.Element {
  if (v === null) return <span className="text-text-3">—</span>;
  const up = v >= 0;
  return (
    <span className={`inline-flex items-center gap-0.5 font-money tabular-nums ${up ? "text-success" : "text-danger"}`}>
      {up ? <ArrowUp size={12} /> : <ArrowDown size={12} />}
      {Math.abs(v).toFixed(2)}%
    </span>
  );
}

export default function ComparePage(): React.JSX.Element {
  const tx = useTranslations("marketsCompare");
  const { data, isLoading } = useQuery({
    queryKey: ["markets", "coins", 1],
    queryFn: () => api.marketsCoins({ page: "1", perPage: "100" }),
  });
  const coins = data?.items ?? [];
  const [a, setA] = useState("bitcoin");
  const [b, setB] = useState("ethereum");
  const ca = coins.find((c) => c.id === a);
  const cb = coins.find((c) => c.id === b);
  const options = coins.map((c) => ({ value: c.id, label: `${c.name} (${c.symbol})` }));

  const rows: { label: string; render: (c: MarketCoin) => React.ReactNode }[] = [
    { label: tx("price"), render: (c) => <span className="font-money tabular-nums">{price(c.price)}</span> },
    { label: tx("change24h"), render: (c) => <Pct v={c.change24h} /> },
    { label: tx("change7d"), render: (c) => <Pct v={c.change7d} /> },
    { label: tx("marketCap"), render: (c) => <span className="font-money tabular-nums">{usd(c.marketCap)}</span> },
    { label: tx("volume"), render: (c) => <span className="font-money tabular-nums">{usd(c.volume24h)}</span> },
    { label: tx("supply"), render: (c) => <span className="font-money tabular-nums">{supply(c.circulatingSupply)}</span> },
    { label: tx("chart7d"), render: (c) => <Sparkline data={c.sparkline} className="h-8 w-28" /> },
  ];

  return (
    <div className="mx-auto w-full max-w-3xl space-y-5 px-4 py-8">
      <Link href="/markets" className="inline-flex items-center gap-1.5 text-sm text-text-2 hover:text-text-1">
        <ArrowLeft size={15} /> {tx("back")}
      </Link>
      <header className="space-y-1">
        <h1 className="font-display text-2xl font-bold">{tx("title")}</h1>
        <p className="text-text-2">{tx("subtitle")}</p>
      </header>

      {isLoading ? (
        <Skeleton className="h-72 w-full" />
      ) : (
        <Card className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Select options={options} value={a} onChange={(e) => setA(e.target.value)} aria-label={tx("coinA")} />
            <Select options={options} value={b} onChange={(e) => setB(e.target.value)} aria-label={tx("coinB")} />
          </div>
          {ca && cb ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-left text-xs uppercase tracking-wide text-text-3">
                  <tr>
                    <th className="py-2 font-medium">{tx("metric")}</th>
                    <th className="py-2 font-medium">{ca.symbol}</th>
                    <th className="py-2 font-medium">{cb.symbol}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {rows.map((r) => (
                    <tr key={r.label}>
                      <td className="py-2.5 text-text-3">{r.label}</td>
                      <td className="py-2.5">{r.render(ca)}</td>
                      <td className="py-2.5">{r.render(cb)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-sm text-text-3">{tx("pickTwo")}</p>
          )}
        </Card>
      )}
      <p className="text-xs text-text-3">{tx("note")}</p>
    </div>
  );
}
