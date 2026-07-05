"use client";

import { useRef } from "react";
import { cn } from "@/lib/utils";

interface Option<T extends string> {
  value: T;
  label: string;
  tone?: "success" | "danger" | "default";
}

/**
 * Segmented single-choice control (buy/sell, offer side). It picks one value and
 * reveals no panels, so it is a radiogroup — not a tablist — with roving tabindex
 * and arrow-key navigation (WCAG 4.1.2 / keyboard pattern for radios).
 */
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
  const ref = useRef<HTMLDivElement>(null);

  const move = (dir: 1 | -1, from: number) => {
    const next = (from + dir + options.length) % options.length;
    onChange(options[next]!.value);
    ref.current?.querySelectorAll<HTMLButtonElement>('[role="radio"]')[next]?.focus();
  };

  return (
    <div
      ref={ref}
      role="radiogroup"
      aria-label={ariaLabel}
      className={cn("inline-flex rounded-[10px] border border-border bg-surface-2 p-0.5", className)}
    >
      {options.map((opt, i) => {
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
            role="radio"
            type="button"
            aria-checked={active}
            tabIndex={active ? 0 : -1}
            onClick={() => onChange(opt.value)}
            onKeyDown={(e) => {
              if (e.key === "ArrowRight" || e.key === "ArrowDown") {
                e.preventDefault();
                move(1, i);
              } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
                e.preventDefault();
                move(-1, i);
              }
            }}
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
