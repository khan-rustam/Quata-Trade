import type { PaymentMethod } from "@quatatrade/shared";
import { cn } from "@/lib/utils";

/** Partner-colored chips on neutral backgrounds (Documents/11 §11.6). */
const META: Record<PaymentMethod, { label: string; dot: string }> = {
  MTN_MOMO: { label: "MTN MoMo", dot: "bg-[#FFCB05]" },
  ORANGE_MONEY: { label: "Orange Money", dot: "bg-[#FF7900]" },
  QUATAPAY: { label: "QuataPay", dot: "bg-accent-400" },
};

export function PaymentMethodChip({ method, className }: { method: PaymentMethod; className?: string }): React.JSX.Element {
  const m = META[method];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full bg-surface-2 px-2 py-0.5 text-xs font-medium text-text-1",
        className,
      )}
    >
      <span className={cn("h-2 w-2 rounded-full", m.dot)} aria-hidden />
      {m.label}
    </span>
  );
}
