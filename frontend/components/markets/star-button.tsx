"use client";

import { Star } from "lucide-react";

/**
 * Watchlist star. Lives inside table rows / cards that are themselves links, so
 * it stops propagation + prevents default to avoid navigating on toggle.
 */
export function StarButton({ active, onToggle, size = 16 }: { active: boolean; onToggle: () => void; size?: number }): React.JSX.Element {
  return (
    <button
      type="button"
      aria-label="watchlist"
      aria-pressed={active}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onToggle();
      }}
      className={active ? "text-warning" : "text-text-3 hover:text-warning"}
    >
      <Star size={size} className={active ? "fill-current" : ""} />
    </button>
  );
}
