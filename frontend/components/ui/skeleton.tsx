import { cn } from "@/lib/utils";

/** Skeleton loader — every data surface shows one within 400ms (Documents/11). */
export function Skeleton({ className }: { className?: string }): React.JSX.Element {
  return (
    <div
      className={cn("animate-pulse rounded-md bg-surface-3 motion-reduce:animate-none", className)}
      aria-hidden
    />
  );
}

/** A row of skeleton lines for list/card placeholders. */
export function SkeletonText({ lines = 3, className }: { lines?: number; className?: string }): React.JSX.Element {
  return (
    <div className={cn("space-y-2", className)}>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton key={i} className={cn("h-3.5", i === lines - 1 ? "w-2/3" : "w-full")} />
      ))}
    </div>
  );
}
