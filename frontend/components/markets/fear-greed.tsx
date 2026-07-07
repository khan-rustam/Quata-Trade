"use client";

import { useTranslations } from "next-intl";
import { useQuery } from "@tanstack/react-query";
import type { FearGreed } from "@quatatrade/shared";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Sparkline } from "./sparkline";
import { api } from "@/lib/api/client";

const REFRESH_MS = 300_000;

function tone(v: number): string {
  if (v < 25) return "text-danger";
  if (v < 45) return "text-warning";
  if (v < 55) return "text-text-2";
  return "text-success";
}

/**
 * Crypto Fear & Greed index — a linear gauge (0–100) with a marker, the current
 * classification, and a 30-day trend sparkline. Data from alternative.me, cached.
 */
export function FearGreedGauge(): React.JSX.Element {
  const tx = useTranslations("markets");
  const { data, isLoading } = useQuery({
    queryKey: ["markets", "fng"],
    queryFn: () => api.marketsFearGreed(),
    refetchInterval: REFRESH_MS,
  });

  if (isLoading || !data) return <Skeleton className="h-40 rounded-xl" />;
  const fng: FearGreed = data;
  const pos = Math.min(100, Math.max(0, fng.value));

  return (
    <Card className="space-y-3">
      <p className="text-sm font-medium">{tx("fngTitle")}</p>
      <div className="flex items-end gap-2">
        <span className={`font-money text-3xl font-bold tabular-nums ${tone(pos)}`}>{fng.value}</span>
        <span className={`pb-1 text-sm font-medium ${tone(pos)}`}>{fng.classification}</span>
      </div>
      <div className="relative">
        <div className="h-2.5 w-full rounded-full bg-gradient-to-r from-danger via-warning to-success" />
        <div
          className="absolute top-1/2 h-4 w-1 -translate-x-1/2 -translate-y-1/2 rounded-full bg-text-1 ring-2 ring-bg"
          style={{ left: `${pos}%` }}
          aria-hidden
        />
      </div>
      <div className="flex justify-between text-xs text-text-3">
        <span>{tx("fngFear")}</span>
        <span>{tx("fngGreed")}</span>
      </div>
      {fng.history.length > 1 && <Sparkline data={fng.history.map((h) => h.v)} className="h-8 w-full text-text-3" />}
    </Card>
  );
}
