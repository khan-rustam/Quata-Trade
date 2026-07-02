"use client";

import { useEffect, useRef, useState } from "react";
import { Clock } from "lucide-react";
import { formatClock } from "@/lib/format";
import { cn } from "@/lib/utils";

/**
 * Payment countdown. Turns `warning` at 25% remaining and pulses under 2 min
 * (Documents/11 §11.7 — urgency without panic). Time is read only inside the
 * interval callback (never during render) to stay pure.
 */
export function Countdown({
  deadline,
  totalMinutes = 30,
  onExpire,
}: {
  deadline: string | null;
  totalMinutes?: number;
  onExpire?: () => void;
}): React.JSX.Element | null {
  const [ms, setMs] = useState<number | null>(null);
  const firedRef = useRef(false);

  useEffect(() => {
    firedRef.current = false;
    const update = () => {
      const rem = deadline ? Math.max(0, new Date(deadline).getTime() - Date.now()) : 0;
      setMs(rem);
      if (deadline && rem <= 0 && !firedRef.current) {
        firedRef.current = true;
        onExpire?.();
      }
    };
    const first = setTimeout(update, 0);
    const id = setInterval(update, 1000);
    return () => {
      clearTimeout(first);
      clearInterval(id);
    };
  }, [deadline, onExpire]);

  if (!deadline) return null;

  const ratio = ms === null ? 1 : ms / (totalMinutes * 60_000);
  const low = ratio <= 0.25;
  const critical = ms !== null && ms > 0 && ms <= 120_000;

  return (
    <span
      suppressHydrationWarning
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 font-money text-sm tabular-nums",
        ms !== null && ms <= 0 ? "bg-surface-3 text-text-3" : low ? "bg-warning/15 text-warning" : "bg-surface-2 text-text-1",
        critical && "motion-safe:animate-pulse",
      )}
      role="timer"
      aria-live="off"
    >
      <Clock size={14} aria-hidden />
      {ms === null ? "—" : ms <= 0 ? "Expired" : formatClock(ms)}
    </span>
  );
}
