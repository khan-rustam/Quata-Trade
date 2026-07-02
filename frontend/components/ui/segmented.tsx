"use client";

import { cn } from "@/lib/utils";

interface Option<T extends string> {
  value: T;
  label: string;
  tone?: "success" | "danger" | "default";
}

/** Segmented control (buy/sell filters, tabs). Keyboard + ARIA tablist semantics. */
export function Segmented<T extends string>({
  value,
  onChange,
  options,
  className,
  "aria-label": ariaLabel,
}: {
  value: T;
  onChange: (v: T) => void;
  options: Option<T>[];
  className?: string;
  "aria-label"?: string;
}): React.JSX.Element {
  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className={cn("inline-flex rounded-[10px] border border-border bg-surface-2 p-0.5", className)}
    >
      {options.map((opt) => {
        const active = opt.value === value;
        const activeTone =
          opt.tone === "success"
            ? "bg-success/15 text-success"
            : opt.tone === "danger"
              ? "bg-danger/15 text-danger"
              : "bg-surface-3 text-text-1";
        return (
          <button
            key={opt.value}
            role="tab"
            type="button"
            aria-selected={active}
            onClick={() => onChange(opt.value)}
            className={cn(
              "min-h-9 rounded-[8px] px-3 text-sm font-medium transition-colors",
              active ? activeTone : "text-text-2 hover:text-text-1",
            )}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
