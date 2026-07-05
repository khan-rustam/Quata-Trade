import { forwardRef, type ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md" | "lg";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
}

/**
 * Button — Documents/11 §11.8. Primary = accent on dark with ink text.
 * Money-moving buttons should render the exact amount as children
 * ("Release 150.00 USDT") and stay disabled until the form is valid.
 */
const variants: Record<Variant, string> = {
  primary:
    "bg-accent-400 text-bg hover:bg-accent-200 disabled:bg-surface-3 disabled:text-text-3",
  secondary:
    "bg-surface-2 text-text-1 border border-border hover:bg-surface-3 disabled:text-text-3",
  ghost: "bg-transparent text-text-1 hover:bg-surface-2",
  danger: "bg-danger text-[#101614] hover:opacity-90 disabled:opacity-50",
};

const sizes: Record<Size, string> = {
  sm: "h-9 px-3 text-sm",
  md: "h-11 px-4 text-base",
  lg: "h-12 px-6 text-base",
};

const base =
  "inline-flex items-center justify-center gap-2 rounded-btn font-medium " +
  "transition-[transform,background-color] duration-150 ease-out active:scale-[0.97] " +
  "disabled:cursor-not-allowed disabled:active:scale-100 " +
  "min-h-11 min-w-11"; // 44px touch target

/**
 * Button styling as a class string. Use on a `next/link` <Link> to get a
 * button-looking navigation control WITHOUT the invalid `<a><button>` nesting
 * that breaks keyboard/SR semantics (WCAG 4.1.2). For real actions, use <Button>.
 */
export function buttonClassName({
  variant = "primary",
  size = "md",
  className,
}: { variant?: Variant; size?: Size; className?: string } = {}): string {
  return cn(base, variants[variant], sizes[size], className);
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "primary", size = "md", ...props }, ref) => (
    <button ref={ref} className={buttonClassName({ variant, size, className })} {...props} />
  ),
);
Button.displayName = "Button";
