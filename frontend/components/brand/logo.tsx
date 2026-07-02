import Image from "next/image";
import { cn } from "@/lib/utils";

/** Wordmark lockup: the real ring-Q candlestick mark + "QuataTrade" in Space Grotesk. */
export function Logo({ size = 22, className }: { size?: number; className?: string }): React.JSX.Element {
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <Image
        src="/assets/icon-logo-transparent.png"
        alt=""
        width={size + 8}
        height={size + 8}
        className="shrink-0"
        priority
      />
      <span className="font-display font-bold tracking-tight" style={{ fontSize: size * 0.92 }}>
        QuataTrade
      </span>
    </span>
  );
}

/** The icon-only brand mark, for standalone/decorative use (hero, auth, 404). */
export function BrandMark({ size = 40, className }: { size?: number; className?: string }): React.JSX.Element {
  return (
    <Image
      src="/assets/icon-logo-transparent.png"
      alt="QuataTrade"
      width={size}
      height={size}
      className={cn("shrink-0", className)}
      priority
    />
  );
}
