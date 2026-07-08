"use client";

import { useEffect, useRef } from "react";
import { AreaSeries, CandlestickSeries, ColorType, CrosshairMode, createChart, type UTCTimestamp } from "lightweight-charts";
import type { MarketChart } from "@quatatrade/shared";

// A canvas library can't read Tailwind classes, so the semantic brand colours
// (success/danger) are inlined here as literals (Documents/11 palette).
const UP = "#4ade8c";
const DOWN = "#f87171";

function dedupe<T extends { time: number }>(arr: T[]): T[] {
  const m = new Map<number, T>();
  for (const x of arr) m.set(x.time, x);
  return [...m.values()].sort((a, b) => a.time - b.time);
}

/**
 * Professional price chart (lightweight-charts v5, Documents/02 stack). Area for
 * line mode, candlesticks for OHLC. Theme-aware grid/text, crosshair, time + price
 * axes, auto-resize. Falls back to line when a range has no OHLC candles.
 */
export function LightweightChart({ chart: data, kind }: { chart: MarketChart; kind: "line" | "candlestick" }): React.JSX.Element {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const dark =
      typeof document !== "undefined" &&
      (document.documentElement.dataset.theme === "dark" ||
        (!document.documentElement.dataset.theme && window.matchMedia?.("(prefers-color-scheme: dark)").matches));
    const gridColor = dark ? "rgba(148,163,184,0.10)" : "rgba(100,116,139,0.14)";
    const textColor = dark ? "#8aa0a8" : "#5b6b6a";

    const chart = createChart(el, {
      autoSize: true,
      layout: { background: { type: ColorType.Solid, color: "transparent" }, textColor, attributionLogo: false, fontSize: 11 },
      grid: { horzLines: { color: gridColor }, vertLines: { color: "transparent" } },
      rightPriceScale: { borderColor: gridColor },
      timeScale: { borderColor: gridColor, timeVisible: true, secondsVisible: false },
      crosshair: { mode: CrosshairMode.Normal },
    });

    const toSec = (ms: number) => Math.floor(ms / 1000) as UTCTimestamp;
    const useCandles = kind === "candlestick" && data.candles.length > 1;

    if (useCandles) {
      const series = chart.addSeries(CandlestickSeries, {
        upColor: UP,
        downColor: DOWN,
        borderVisible: false,
        wickUpColor: UP,
        wickDownColor: DOWN,
      });
      series.setData(dedupe(data.candles.map((c) => ({ time: toSec(c.t), open: c.o, high: c.h, low: c.l, close: c.c }))));
    } else {
      const up = (data.line.at(-1)?.v ?? 0) >= (data.line[0]?.v ?? 0);
      const color = up ? UP : DOWN;
      const series = chart.addSeries(AreaSeries, {
        lineColor: color,
        topColor: up ? "rgba(74,222,140,0.20)" : "rgba(248,113,113,0.20)",
        bottomColor: up ? "rgba(74,222,140,0)" : "rgba(248,113,113,0)",
        lineWidth: 2,
        priceLineVisible: false,
      });
      series.setData(dedupe(data.line.map((p) => ({ time: toSec(p.t), value: p.v }))));
    }

    chart.timeScale().fitContent();
    return () => chart.remove();
  }, [data, kind]);

  return <div ref={ref} className="h-72 w-full" />;
}
