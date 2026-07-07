"use client";

import { useMemo, useState } from "react";
import type { MarketChart } from "@quatatrade/shared";

const W = 800;
const H = 340;
const PAD_L = 8;
const PAD_R = 56;
const PAD_T = 12;
const PAD_B = 22;

const money = (n: number) =>
  "$" + new Intl.NumberFormat("en", { maximumFractionDigits: n < 1 ? 6 : 2, minimumFractionDigits: 2 }).format(n);

type Kind = "line" | "candlestick";

/**
 * Self-contained SVG price chart (line + candlestick) with gridlines, y-axis
 * price labels, and a hover crosshair. No chart-lib dependency — deploy-safe.
 * lightweight-charts (doc 02) is the documented upgrade for pro features
 * (zoom, drawing tools, full-screen) when needed.
 */
export function PriceChart({ chart, kind }: { chart: MarketChart; kind: Kind }): React.JSX.Element {
  const [hover, setHover] = useState<number | null>(null);

  const model = useMemo(() => {
    const useCandles = kind === "candlestick" && chart.candles.length > 1;
    const xs = useCandles ? chart.candles.map((c) => c.t) : chart.line.map((p) => p.t);
    const lows = useCandles ? chart.candles.map((c) => c.l) : chart.line.map((p) => p.v);
    const highs = useCandles ? chart.candles.map((c) => c.h) : chart.line.map((p) => p.v);
    const min = Math.min(...lows);
    const max = Math.max(...highs);
    const range = max - min || 1;
    const t0 = xs[0] ?? 0;
    const t1 = xs[xs.length - 1] ?? 1;
    const span = t1 - t0 || 1;
    const x = (t: number) => PAD_L + ((t - t0) / span) * (W - PAD_L - PAD_R);
    const y = (v: number) => PAD_T + (1 - (v - min) / range) * (H - PAD_T - PAD_B);
    return { useCandles, min, max, range, x, y, t0, t1 };
  }, [chart, kind]);

  const grid = [0, 0.25, 0.5, 0.75, 1].map((f) => {
    const v = model.min + model.range * (1 - f);
    return { y: PAD_T + f * (H - PAD_T - PAD_B), label: money(v) };
  });

  const points = chart.line.map((p) => `${model.x(p.t).toFixed(1)},${model.y(p.v).toFixed(1)}`).join(" ");
  const up = (chart.line[chart.line.length - 1]?.v ?? 0) >= (chart.line[0]?.v ?? 0);
  const candleW = chart.candles.length > 1 ? Math.max(1, ((W - PAD_L - PAD_R) / chart.candles.length) * 0.6) : 4;

  const hoverPoint = hover !== null ? chart.line[hover] : null;

  const onMove = (e: React.MouseEvent<SVGSVGElement>) => {
    if (chart.line.length === 0) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const relX = ((e.clientX - rect.left) / rect.width) * W;
    const frac = Math.min(1, Math.max(0, (relX - PAD_L) / (W - PAD_L - PAD_R)));
    setHover(Math.round(frac * (chart.line.length - 1)));
  };

  const empty = chart.line.length < 2 && chart.candles.length < 2;

  return (
    <div className="w-full">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="none"
        className="h-72 w-full"
        onMouseMove={onMove}
        onMouseLeave={() => setHover(null)}
        role="img"
      >
        {grid.map((g, i) => (
          <g key={i}>
            <line x1={PAD_L} x2={W - PAD_R} y1={g.y} y2={g.y} className="stroke-border" strokeWidth={0.5} />
            <text x={W - PAD_R + 4} y={g.y + 3} className="fill-current text-text-3" fontSize={9}>
              {g.label}
            </text>
          </g>
        ))}

        {empty ? (
          <text x={W / 2} y={H / 2} textAnchor="middle" className="fill-current text-text-3" fontSize={12}>
            —
          </text>
        ) : model.useCandles ? (
          chart.candles.map((c, i) => {
            const cUp = c.c >= c.o;
            const cx = model.x(c.t);
            const bodyTop = model.y(Math.max(c.o, c.c));
            const bodyBot = model.y(Math.min(c.o, c.c));
            return (
              <g key={i} className={cUp ? "text-success" : "text-danger"}>
                <line x1={cx} x2={cx} y1={model.y(c.h)} y2={model.y(c.l)} stroke="currentColor" strokeWidth={0.6} />
                <rect
                  x={cx - candleW / 2}
                  y={bodyTop}
                  width={candleW}
                  height={Math.max(0.6, bodyBot - bodyTop)}
                  fill="currentColor"
                />
              </g>
            );
          })
        ) : (
          <>
            <polyline
              points={points}
              fill="none"
              stroke="currentColor"
              strokeWidth={1.5}
              vectorEffect="non-scaling-stroke"
              className={up ? "text-success" : "text-danger"}
            />
          </>
        )}

        {hoverPoint && (
          <g className="text-text-2">
            <line x1={model.x(hoverPoint.t)} x2={model.x(hoverPoint.t)} y1={PAD_T} y2={H - PAD_B} stroke="currentColor" strokeWidth={0.5} strokeDasharray="3 3" />
            <circle cx={model.x(hoverPoint.t)} cy={model.y(hoverPoint.v)} r={3} className="fill-accent-400" />
          </g>
        )}
      </svg>

      {hoverPoint && (
        <p className="mt-1 text-center font-money text-xs text-text-2 tabular-nums">
          {money(hoverPoint.v)} · {new Date(hoverPoint.t).toLocaleString()}
        </p>
      )}
    </div>
  );
}
