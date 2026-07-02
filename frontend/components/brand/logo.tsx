import { Keyhole } from "./keyhole";
import { cn } from "@/lib/utils";

/** Wordmark lockup: Q-key glyph + "QuataTrade" in Space Grotesk 700. */
export function Logo({ size = 22, className }: { size?: number; className?: string }): React.JSX.Element {
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <Keyhole size={size} className="text-accent-400" />
      <span className="font-display font-bold tracking-tight" style={{ fontSize: size * 0.9 }}>
        QuataTrade
      </span>
    </span>
  );
}
