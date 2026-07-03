import { forwardRef, type InputHTMLAttributes, type TextareaHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

const base =
  "w-full rounded-[10px] border border-border bg-surface-2 text-text-1 placeholder:text-text-3 " +
  "transition-colors outline-none focus-visible:border-accent-400 focus-visible:ring-2 focus-visible:ring-accent-400/40 " +
  "disabled:cursor-not-allowed disabled:opacity-60 aria-[invalid=true]:border-danger aria-[invalid=true]:ring-danger/30";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  /** right-aligned monospace for amounts */
  mono?: boolean;
  suffix?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, mono, suffix, ...props }, ref) => {
    const field = (
      <input
        ref={ref}
        className={cn(
          base,
          "h-11 pl-3 text-base",
          // leave room on the right for the absolutely-positioned suffix so the
          // right-aligned value never collides with it (XAF / USDT).
          suffix ? "pr-14" : "pr-3",
          mono && "font-money text-right tabular-nums",
          className,
        )}
        {...props}
      />
    );
    if (!suffix) return field;
    return (
      <div className="relative">
        {field}
        <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-text-2">
          {suffix}
        </span>
      </div>
    );
  },
);
Input.displayName = "Input";

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(
  ({ className, ...props }, ref) => (
    <textarea ref={ref} className={cn(base, "min-h-24 px-3 py-2 text-base", className)} {...props} />
  ),
);
Textarea.displayName = "Textarea";
