"use client";

import { useEffect, useRef, useState } from "react";
import { animate, useInView, useReducedMotion } from "motion/react";
import { cn } from "@/lib/utils";

/**
 * Count-up when scrolled into view. Renders the final value immediately under
 * prefers-reduced-motion. Always Plex Mono + tabular-nums (Documents/11 §11.4).
 * Note: for real platform stats only — never fabricate numbers on money surfaces.
 */
export function AnimatedNumber({
  value,
  format = (v: number) => Math.round(v).toString(),
  duration = 1.4,
  className,
}: {
  value: number;
  format?: (v: number) => string;
  duration?: number;
  className?: string;
}): React.JSX.Element {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: "-20%" });
  const reduce = useReducedMotion();
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    // Reduced motion / not-yet-visible: render the resolved value with no animation
    // (handled by `shown` below) — never setState synchronously in the effect body.
    if (!inView || reduce) return;
    const controls = animate(0, value, { duration, ease: "easeOut", onUpdate: setDisplay });
    return () => controls.stop();
  }, [inView, value, duration, reduce]);

  const shown = reduce ? value : inView ? display : 0;

  return (
    <span ref={ref} className={cn("font-money tabular-nums", className)}>
      {format(shown)}
    </span>
  );
}
