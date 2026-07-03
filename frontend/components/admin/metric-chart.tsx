"use client";

import { useSyncExternalStore, type ReactElement } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export interface ChartPoint {
  label: string;
  value: number;
}

const ACCENT = "var(--color-accent-400)";
const GRID = "var(--color-border)";
const AXIS = "var(--color-text-3)";

const noopSubscribe = () => () => {};
/** True only after client hydration — recharts must not render during SSR (it measures the DOM). */
function useHydrated(): boolean {
  return useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false,
  );
}

/** Compact axis labels: 1200 → 1.2k, 3_400_000 → 3.4M. */
function compact(v: number): string {
  const abs = Math.abs(v);
  if (abs >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `${(v / 1_000).toFixed(1)}k`;
  return String(v);
}

function ChartTooltip({
  active,
  payload,
  label,
  formatter,
}: {
  active?: boolean;
  payload?: Array<{ value?: number | string }>;
  label?: string | number;
  formatter?: (v: number) => string;
}): ReactElement | null {
  if (!active || !payload || payload.length === 0) return null;
  const raw = payload[0]?.value;
  const value = typeof raw === "number" ? raw : Number(raw ?? 0);
  return (
    <div className="rounded-lg border border-border bg-surface-1 px-3 py-2 text-xs shadow-lg">
      <p className="text-text-3">{label}</p>
      <p className="font-medium text-text-1">{formatter ? formatter(value) : compact(value)}</p>
    </div>
  );
}

/** Themed area/bar trend chart. Client-only (recharts measures the DOM). */
export function TrendChart({
  data,
  type = "area",
  color = ACCENT,
  height = 220,
  formatter,
}: {
  data: ChartPoint[];
  type?: "area" | "bar";
  color?: string;
  height?: number;
  formatter?: (v: number) => string;
}): ReactElement {
  const hydrated = useHydrated();
  if (!hydrated) return <div style={{ height }} className="w-full animate-pulse rounded-lg bg-surface-2" />;

  const gradId = `qt-grad-${type}`;
  const axisProps = { stroke: AXIS, fontSize: 11, tickLine: false, axisLine: false } as const;

  return (
    <ResponsiveContainer width="100%" height={height}>
      {type === "area" ? (
        <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.35} />
              <stop offset="100%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke={GRID} strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="label" {...axisProps} minTickGap={28} />
          <YAxis {...axisProps} width={44} tickFormatter={compact} />
          <Tooltip content={<ChartTooltip formatter={formatter} />} cursor={{ stroke: GRID }} />
          <Area type="monotone" dataKey="value" stroke={color} strokeWidth={2} fill={`url(#${gradId})`} />
        </AreaChart>
      ) : (
        <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid stroke={GRID} strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="label" {...axisProps} minTickGap={28} />
          <YAxis {...axisProps} width={44} tickFormatter={compact} />
          <Tooltip content={<ChartTooltip formatter={formatter} />} cursor={{ fill: "var(--color-surface-2)" }} />
          <Bar dataKey="value" fill={color} radius={[3, 3, 0, 0]} />
        </BarChart>
      )}
    </ResponsiveContainer>
  );
}
