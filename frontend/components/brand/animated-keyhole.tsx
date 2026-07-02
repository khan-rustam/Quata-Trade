"use client";

import { motion, useReducedMotion } from "motion/react";

/**
 * The QuataTrade signature: the padlock "draws closed" on mount (~700ms, once) —
 * the same keyhole motif used at escrow-lock in-product, so brand and product
 * tell one story (Documents/11 §11.5 / §11.7). Renders the fully-locked state
 * instantly under prefers-reduced-motion.
 */
export function AnimatedKeyhole({
  size = 200,
  className,
}: {
  size?: number;
  className?: string;
}): React.JSX.Element {
  const reduce = useReducedMotion();
  const ease = [0.2, 0.7, 0.2, 1] as const;

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 200 200"
      fill="none"
      className={className}
      role="img"
      aria-label="Funds locked in escrow"
    >
      <defs>
        <linearGradient id="qk-body" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#159e85" />
          <stop offset="1" stopColor="#0b3b36" />
        </linearGradient>
        <radialGradient id="qk-glow" cx="50%" cy="48%" r="50%">
          <stop offset="0" stopColor="#2fd4a7" stopOpacity="0.5" />
          <stop offset="1" stopColor="#2fd4a7" stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* ambient glow */}
      <motion.circle
        cx="100"
        cy="116"
        r="92"
        fill="url(#qk-glow)"
        initial={{ opacity: reduce ? 0.7 : 0 }}
        animate={{ opacity: 0.7 }}
        transition={{ duration: 0.7, delay: reduce ? 0 : 0.45 }}
      />

      {/* shackle — drops + seats into the body */}
      <motion.path
        d="M67 98 V74 a33 33 0 0 1 66 0 V98"
        stroke="#2fd4a7"
        strokeWidth="12"
        strokeLinecap="round"
        fill="none"
        initial={{ y: reduce ? 0 : -18, opacity: reduce ? 1 : 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.55, ease, delay: reduce ? 0 : 0.05 }}
      />

      {/* body */}
      <motion.rect
        x="50"
        y="94"
        width="100"
        height="88"
        rx="20"
        fill="url(#qk-body)"
        stroke="#2fd4a7"
        strokeWidth="2.5"
        initial={{ y: reduce ? 0 : 10, opacity: reduce ? 1 : 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.45, ease, delay: reduce ? 0 : 0.32 }}
      />

      {/* keyhole (Q counter + tapered slot) lights up when locked */}
      <motion.g
        initial={{ opacity: reduce ? 1 : 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.4, delay: reduce ? 0 : 0.6 }}
      >
        <circle cx="100" cy="128" r="12" fill="#0e1416" />
        <path d="M100 134 L93 160 H107 Z" fill="#0e1416" />
        <circle cx="100" cy="128" r="6" fill="#2fd4a7" />
      </motion.g>
    </svg>
  );
}
