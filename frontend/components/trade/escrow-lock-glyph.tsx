"use client";

import { useEffect, useRef, useState } from "react";
import { useReducedMotion } from "motion/react";
import type { TradeStatus } from "@quatatrade/shared";

/** Statuses in which the escrow is holding funds. */
const LOCKED: readonly TradeStatus[] = ["ESCROW_LOCKED", "PAYMENT_SUBMITTED", "DISPUTED"];
/** Statuses where the escrow has paid out or returned — the lock opens. */
const RELEASED: readonly TradeStatus[] = ["COMPLETED", "RESOLVED_RELEASE", "RESOLVED_REFUND"];

/**
 * The signature moment (Documents/11 §11.7): when escrow locks, the keyhole draws
 * itself closed with a soft accent-400 pulse ring — 600ms, once. When it releases,
 * the ring opens again.
 *
 * Fires on a real transition into the state, and once on mount when arriving at an
 * already-locked trade — that is the "feel the protection engage" beat. It must NOT
 * replay on the trade room's poll/refresh, so the played state is tracked in a ref
 * keyed by status rather than re-derived each render.
 *
 * Under prefers-reduced-motion the settled state renders instantly with no ring:
 * §11.7 says pulse rings become a static colour change.
 */
export function EscrowLockGlyph({
  status,
  size = 16,
  className,
}: {
  status: TradeStatus;
  size?: number;
  className?: string;
}): React.JSX.Element {
  const reduce = useReducedMotion();
  const locked = LOCKED.includes(status);
  const released = RELEASED.includes(status);

  // `null` until the first status we have seen, so mounting on a locked trade counts
  // as an arrival rather than a no-op.
  const seen = useRef<TradeStatus | null>(null);
  const [pulse, setPulse] = useState(false);

  useEffect(() => {
    const prev = seen.current;
    seen.current = status;
    if (reduce) return;
    // Symmetric: arriving at (or transitioning into) a locked trade plays the close;
    // arriving at (or transitioning into) a settled one plays the open.
    const entering = prev === null ? locked : !LOCKED.includes(prev) && locked;
    const opening = prev === null ? released : LOCKED.includes(prev) && released;
    if (!entering && !opening) return;
    setPulse(true);
    const t = setTimeout(() => setPulse(false), 600);
    return () => clearTimeout(t);
  }, [status, locked, released, reduce]);

  // Circumference of the r=12 outer ring, for the draw-closed stroke animation.
  const circumference = 2 * Math.PI * 12;
  const draw = pulse && locked && !reduce;

  return (
    <span
      // qt-pulse-ring is the §11.7 ring: 600ms, once, accent-400 (app/globals.css)
      className={`inline-flex rounded-full ${pulse ? "qt-pulse-ring" : ""} ${className ?? ""}`}
      style={{ width: size, height: size }}
    >
      <svg width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden="true">
        <circle
          cx="16"
          cy="16"
          r="12"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={draw ? circumference : 0}
          transform="rotate(-90 16 16)"
          style={draw ? { animation: "qt-draw-ring 600ms ease-out forwards" } : undefined}
        />
        <circle
          cx="16"
          cy="13.5"
          r="3.5"
          fill="currentColor"
          style={draw ? { animation: "qt-keyhole-in 400ms ease-out 200ms backwards" } : undefined}
        />
        <path
          d="M16 16.5 L16 22 L20 26"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          style={draw ? { animation: "qt-keyhole-in 400ms ease-out 200ms backwards" } : undefined}
        />
      </svg>
    </span>
  );
}
