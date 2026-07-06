"use client";

import { motion, useReducedMotion } from "motion/react";
import { Lock, ShieldCheck, Snowflake, KeyRound, Fingerprint, Server } from "lucide-react";
import { cn } from "@/lib/utils";

// This file exports stylized, animated SVG containers that wrap the standard Lucide icons 
// to create high-impact, glowing fintech graphics for the Security pillars.

interface IllustrationProps {
  className?: string;
}

export function EscrowIllustration({ className }: IllustrationProps): React.JSX.Element {
  const reduce = useReducedMotion();
  return (
    <div className={cn("relative flex items-center justify-center h-16 w-16 mb-4", className)}>
      {/* Glow path */}
      <motion.div
        animate={reduce ? undefined : { scale: [1, 1.1, 1], opacity: [0.3, 0.6, 0.3] }}
        transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
        className="absolute inset-0 rounded-full bg-accent-400/10 blur-md"
      />
      <svg width="64" height="64" viewBox="0 0 64 64" fill="none" className="z-10">
        <circle cx="32" cy="32" r="28" stroke="var(--color-accent-400)" strokeWidth="1.5" strokeDasharray="4 4" className="opacity-60" />
        <motion.circle
          cx="32"
          cy="32"
          r="24"
          stroke="var(--color-accent-400)"
          strokeWidth="2.5"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 1.2, ease: "easeOut" }}
        />
      </svg>
      <div className="absolute text-accent-400 z-20">
        <Lock size={22} />
      </div>
    </div>
  );
}

export function VerificationIllustration({ className }: IllustrationProps): React.JSX.Element {
  const reduce = useReducedMotion();
  return (
    <div className={cn("relative flex items-center justify-center h-16 w-16 mb-4", className)}>
      <motion.div
        animate={reduce ? undefined : { rotate: 360 }}
        transition={{ duration: 15, repeat: Infinity, ease: "linear" }}
        className="absolute inset-0 border border-dashed border-accent-400/35 rounded-full"
      />
      <motion.div
        animate={reduce ? undefined : { scale: [1, 1.05, 1] }}
        transition={{ duration: 2.5, repeat: Infinity }}
        className="absolute inset-2 bg-accent-400/5 rounded-full"
      />
      <svg width="64" height="64" viewBox="0 0 64 64" fill="none" className="z-10">
        <path d="M12 32 L32 12 L52 32 L32 52 Z" stroke="var(--color-accent-400)" strokeWidth="2" strokeLinejoin="round" />
      </svg>
      <div className="absolute text-accent-400 z-20">
        <ShieldCheck size={22} />
      </div>
    </div>
  );
}

export function ColdStorageIllustration({ className }: IllustrationProps): React.JSX.Element {
  const reduce = useReducedMotion();
  return (
    <div className={cn("relative flex items-center justify-center h-16 w-16 mb-4", className)}>
      <div className="absolute inset-1 rounded-lg bg-surface-3/60 border border-border" />
      <motion.div
        animate={reduce ? undefined : { y: [0, -4, 0] }}
        transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
        className="absolute text-accent-400 z-20"
      >
        <Snowflake size={24} className="text-info" />
      </motion.div>
      <svg width="64" height="64" viewBox="0 0 64 64" fill="none" className="absolute z-10">
        <rect x="8" y="8" width="48" height="48" rx="8" stroke="var(--color-border)" strokeWidth="1.5" />
        <rect x="14" y="14" width="36" height="36" rx="4" stroke="var(--color-info)" strokeWidth="1" strokeDasharray="3 3" />
      </svg>
    </div>
  );
}

export function SecurityKeysIllustration({ className }: IllustrationProps): React.JSX.Element {
  const reduce = useReducedMotion();
  return (
    <div className={cn("relative flex items-center justify-center h-16 w-16 mb-4", className)}>
      <motion.div
        animate={reduce ? undefined : { scale: [1, 0.9, 1] }}
        transition={{ duration: 3, repeat: Infinity }}
        className="absolute inset-0 bg-accent-400/5 rounded-full border border-border/80"
      />
      <svg width="64" height="64" viewBox="0 0 64 64" fill="none" className="absolute z-10">
        <circle cx="32" cy="32" r="16" stroke="var(--color-accent-400)" strokeWidth="2" />
        <line x1="32" y1="8" x2="32" y2="16" stroke="var(--color-border)" strokeWidth="2" />
        <line x1="32" y1="48" x2="32" y2="56" stroke="var(--color-border)" strokeWidth="2" />
        <line x1="8" y1="32" x2="16" y2="32" stroke="var(--color-border)" strokeWidth="2" />
        <line x1="48" y1="32" x2="56" y2="32" stroke="var(--color-border)" strokeWidth="2" />
      </svg>
      <div className="absolute text-accent-400 z-20">
        <KeyRound size={20} />
      </div>
    </div>
  );
}

export function BiometricsIllustration({ className }: IllustrationProps): React.JSX.Element {
  const reduce = useReducedMotion();
  return (
    <div className={cn("relative flex items-center justify-center h-16 w-16 mb-4", className)}>
      <div className="absolute inset-0 bg-accent-400/5 rounded-xl border border-accent-400/20" />
      {/* Scanning bar */}
      <motion.div
        animate={reduce ? undefined : { y: [-18, 18, -18] }}
        transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
        className="absolute left-2 right-2 h-0.5 bg-accent-400 shadow-[0_0_8px_var(--color-accent-400)] z-20"
      />
      <div className="absolute text-accent-400 z-10 opacity-80">
        <Fingerprint size={26} />
      </div>
    </div>
  );
}

export function InfrastructureIllustration({ className }: IllustrationProps): React.JSX.Element {
  const reduce = useReducedMotion();
  return (
    <div className={cn("relative flex items-center justify-center h-16 w-16 mb-4", className)}>
      <svg width="64" height="64" viewBox="0 0 64 64" fill="none" className="absolute z-10">
        <path d="M12 18 L52 18 L52 48 L12 48 Z" stroke="var(--color-border)" strokeWidth="1.5" />
        <line x1="12" y1="28" x2="52" y2="28" stroke="var(--color-border)" strokeWidth="1" />
        <line x1="12" y1="38" x2="52" y2="38" stroke="var(--color-border)" strokeWidth="1" />
      </svg>
      {/* Pulsing connection dots */}
      <motion.div
        animate={reduce ? undefined : { opacity: [0.3, 1, 0.3] }}
        transition={{ duration: 1.5, repeat: Infinity }}
        className="absolute top-[21px] left-6 h-2 w-2 rounded-full bg-accent-400"
      />
      <motion.div
        animate={reduce ? undefined : { opacity: [1, 0.3, 1] }}
        transition={{ duration: 1.5, repeat: Infinity }}
        className="absolute top-[31px] left-8 h-2 w-2 rounded-full bg-accent-400"
      />
      <div className="absolute text-accent-400 z-20">
        <Server size={20} />
      </div>
    </div>
  );
}
