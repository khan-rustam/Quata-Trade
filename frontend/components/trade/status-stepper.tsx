import type { TradeStatus } from "@quatatrade/shared";
import { Check } from "lucide-react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";

const STEPS = ["OPENED", "ESCROW_LOCKED", "PAYMENT_SUBMITTED", "COMPLETED"] as const;
const LABEL_KEYS: Record<(typeof STEPS)[number], string> = {
  OPENED: "opened",
  ESCROW_LOCKED: "escrowLocked",
  PAYMENT_SUBMITTED: "paymentSent",
  COMPLETED: "completed",
};

/** Horizontal trade progress. Filled steps use the escrow/accent color. */
export function StatusStepper({ status }: { status: TradeStatus }): React.JSX.Element {
  const tx = useTranslations("statusStepper");
  const terminalIndex =
    status === "COMPLETED" || status === "RESOLVED_RELEASE"
      ? 3
      : status === "PAYMENT_SUBMITTED"
        ? 2
        : status === "ESCROW_LOCKED" || status === "DISPUTED"
          ? 1
          : 0;

  const aborted = status === "CANCELLED" || status === "EXPIRED" || status === "RESOLVED_REFUND";

  return (
    <ol className="flex items-center" aria-label={tx("progressLabel")}>
      {STEPS.map((step, i) => {
        const done = i <= terminalIndex && !aborted;
        const current = i === terminalIndex && !aborted;
        return (
          <li key={step} className={cn("flex items-center", i < STEPS.length - 1 && "flex-1")}>
            <div className="flex flex-col items-center gap-1">
              <span
                className={cn(
                  "flex h-7 w-7 items-center justify-center rounded-full border text-xs font-semibold transition-colors",
                  done
                    ? "border-accent-400 bg-accent-400 text-[#101614]"
                    : current
                      ? "border-accent-400 text-accent-400"
                      : "border-border text-text-3",
                )}
                aria-current={current ? "step" : undefined}
              >
                {done && !current ? <Check size={14} /> : i + 1}
              </span>
              <span className={cn("text-[11px]", done || current ? "text-text-1" : "text-text-3")}>
                {tx(LABEL_KEYS[step])}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <span
                className={cn("mx-1 mb-4 h-0.5 flex-1 rounded", i < terminalIndex && !aborted ? "bg-accent-400" : "bg-border")}
                aria-hidden
              />
            )}
          </li>
        );
      })}
    </ol>
  );
}
