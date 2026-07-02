import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>): React.JSX.Element {
  return (
    <div
      className={cn(
        "rounded-[12px] border border-border bg-surface-1 p-5",
        className,
      )}
      {...props}
    />
  );
}
