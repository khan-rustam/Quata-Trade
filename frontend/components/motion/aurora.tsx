"use client";

import { motion, useReducedMotion } from "motion/react";
import { cn } from "@/lib/utils";

/**
 * Marketing-only ambient glow — a few blurred radial blobs drifting on transform
 * (the "Quata Flow" gradient). NEVER behind body copy or on money screens
 * (Documents/11 §11.7). Purely decorative.
 */
const BLOBS = [
  { color: "rgba(47,212,167,0.20)", size: 540, top: "-10%", left: "6%", dx: 40, dy: 28, dur: 15 },
  { color: "rgba(21,158,133,0.16)", size: 580, top: "2%", left: "60%", dx: -48, dy: 22, dur: 19 },
  { color: "rgba(14,95,85,0.22)", size: 480, top: "46%", left: "34%", dx: 30, dy: -34, dur: 17 },
];

export function Aurora({ className }: { className?: string }): React.JSX.Element {
  const reduce = useReducedMotion();
  return (
    <div aria-hidden className={cn("pointer-events-none absolute inset-0 -z-10 overflow-hidden", className)}>
      {BLOBS.map((b, i) => {
        const style = {
          width: b.size,
          height: b.size,
          top: b.top,
          left: b.left,
          background: `radial-gradient(circle at center, ${b.color} 0%, transparent 70%)`,
          filter: "blur(64px)",
          mixBlendMode: "screen" as const,
        };
        if (reduce) return <div key={i} className="absolute rounded-full" style={style} />;
        return (
          <motion.div
            key={i}
            className="absolute rounded-full"
            style={style}
            animate={{ x: [0, b.dx, 0], y: [0, b.dy, 0] }}
            transition={{ duration: b.dur, repeat: Infinity, repeatType: "mirror", ease: "easeInOut" }}
          />
        );
      })}
    </div>
  );
}
