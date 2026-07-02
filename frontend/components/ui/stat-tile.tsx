import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Compact KPI tile: label + value (+ optional delta/footnote). */
export function StatTile({
  label,
  value,
  footnote,
  icon,
  className,
}: {
  label: string;
  value: ReactNode;
  footnote?: ReactNode;
  icon?: ReactNode;
  className?: string;
}): React.JSX.Element {
  return (
    <div className={cn("rounded-xl border border-border bg-surface-1 p-4", className)}>
      <div className="flex items-center justify-between">
        <p className="text-sm text-text-2">{label}</p>
        {icon && <span className="text-text-3">{icon}</span>}
      </div>
      <div className="mt-1.5 text-xl font-semibold text-text-1">{value}</div>
      {footnote && <div className="mt-1 text-xs text-text-3">{footnote}</div>}
    </div>
  );
}
