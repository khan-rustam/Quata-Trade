import type { PaymentMethod } from "@quatatrade/shared";
import { cn } from "@/lib/utils";

/** Partner-colored chips on neutral backgrounds (Documents/11 §11.6). Covers every
 * rail in the payment_method domain so any market's rails render (labels/colours are
 * cosmetic; availability per market is admin-controlled). */
const META: Record<PaymentMethod, { label: string; dot: string }> = {
  QUATAPAY: { label: "QuataPay", dot: "bg-accent-400" },
  MTN_MOMO: { label: "MTN MoMo", dot: "bg-[#FFCB05]" },
  ORANGE_MONEY: { label: "Orange Money", dot: "bg-[#FF7900]" },
  BANK_TRANSFER: { label: "Bank transfer", dot: "bg-[#5B7CFA]" },
  MPESA: { label: "M-Pesa", dot: "bg-[#4CAF50]" },
  AIRTEL_MONEY: { label: "Airtel Money", dot: "bg-[#ED1C24]" },
  MOOV_MONEY: { label: "Moov Money", dot: "bg-[#F58220]" },
  WAVE: { label: "Wave", dot: "bg-[#1DC8FF]" },
  VODAFONE_CASH: { label: "Vodafone Cash", dot: "bg-[#E60000]" },
  OPAY: { label: "OPay", dot: "bg-[#1DCF6B]" },
  PALMPAY: { label: "PalmPay", dot: "bg-[#6C2BD9]" },
};

/** The display name for a rail. Exported so no surface has to re-derive it —
 *  the offer page used to fall back to "QuataPay" for every rail it did not
 *  special-case, mislabelling 8 of the 11. */
export function paymentMethodLabel(method: PaymentMethod): string {
  return META[method].label;
}

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
