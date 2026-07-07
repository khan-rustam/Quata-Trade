/**
 * Tiny inline SVG sparkline for market rows/cards (no chart lib — lightweight-charts
 * is reserved for the Phase-B asset-detail charts). Colours by 7d direction.
 */
export function Sparkline({ data, className }: { data: number[]; className?: string }): React.JSX.Element | null {
  if (!data || data.length < 2) return null;
  const w = 100;
  const h = 32;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const points = data
    .map((v, i) => `${((i / (data.length - 1)) * w).toFixed(2)},${(h - ((v - min) / range) * h).toFixed(2)}`)
    .join(" ");
  const up = (data[data.length - 1] ?? 0) >= (data[0] ?? 0);
  return (
    <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" className={className} aria-hidden>
      <polyline
        points={points}
        fill="none"
        stroke="currentColor"
        strokeWidth={1.5}
        vectorEffect="non-scaling-stroke"
        className={up ? "text-success" : "text-danger"}
      />
    </svg>
  );
}
