import type { ReputationTier } from "@quatatrade/shared";
import { Award } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Reputation tier chip — deterministic tier from trade history (shared reputationTier()).
 * Token-only colors; meaning carried by icon + label, never color alone (brand a11y rule).
 * Pass `label` to localize (default is the English tier name).
 */
const TIER_CLASS: Record<ReputationTier, string> = {
  NEW: "border-border bg-surface-2 text-text-2",
  BRONZE: "border-warning/40 bg-warning/10 text-warning",
  SILVER: "border-info/40 bg-info/10 text-info",
  GOLD: "border-accent-400/50 bg-accent-400/12 text-accent-400",
};
const TIER_LABEL: Record<ReputationTier, string> = {
  NEW: "New",
  BRONZE: "Bronze",
  SILVER: "Silver",
  GOLD: "Gold",
};

export function ReputationBadge({
  tier,
  label,
  className,
}: {
  tier: ReputationTier;
  label?: string;
  className?: string;
}): React.JSX.Element {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-chip border px-2 py-0.5 text-xs font-medium",
        TIER_CLASS[tier],
        className,
      )}
    >
      <Award size={12} aria-hidden />
      {label ?? TIER_LABEL[tier]}
    </span>
  );
}
