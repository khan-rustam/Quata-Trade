"use client";

import dynamic from "next/dynamic";

export type { ChartPoint } from "./trend-chart-impl";

/**
 * Lazy boundary for the recharts-backed TrendChart. `ssr: false` keeps recharts
 * out of the server render and out of the initial admin JS chunk — it only loads
 * when a page that actually shows a chart mounts. A skeleton fills the space while
 * the chunk fetches. The import path stays the same for callers.
 */
export const TrendChart = dynamic(() => import("./trend-chart-impl").then((m) => m.TrendChart), {
  ssr: false,
  loading: () => <div className="h-[220px] w-full animate-pulse rounded-lg bg-surface-2" />,
});
