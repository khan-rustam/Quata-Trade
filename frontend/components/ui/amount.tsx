import { formatUsdt, formatXaf } from "@/lib/format";
import { cn } from "@/lib/utils";

/**
 * Money display — always IBM Plex Mono, tabular, unit-labeled (Documents/11 §11.4).
 * Never do arithmetic in the UI; pass smallest-unit strings from the API.
 */
export function Usdt({
  value,
  className,
  showUnit = true,
  size = "md",
}: {
  value: string | bigint;
  className?: string;
  showUnit?: boolean;
  size?: "sm" | "md" | "lg" | "xl";
}): React.JSX.Element {
  const sizes = { sm: "text-sm", md: "text-base", lg: "text-lg", xl: "text-2xl" };
  return (
    <span className={cn("font-money tabular-nums text-text-1", sizes[size], className)}>
      {formatUsdt(value)}
      {showUnit && <span className="ml-1 text-text-2">USDT</span>}
    </span>
  );
}

export function Xaf({ value, className }: { value: string | bigint; className?: string }): React.JSX.Element {
  return <span className={cn("font-money tabular-nums text-text-1", className)}>{formatXaf(value)}</span>;
}
