import type { Metadata } from "next";
import Link from "next/link";
import { Check } from "lucide-react";
import { Section, SectionHeading } from "@/components/public/marketing";
import { Button } from "@/components/ui/button";
import { PaymentMethodChip } from "@/components/trade/payment-method-chip";

export const metadata: Metadata = {
  title: "Fees — QuataTrade",
  description: "QuataTrade's trading fees per payment method, with worked examples. No hidden fees.",
};

export default function FeesPage(): React.JSX.Element {
  return (
    <>
      <Section narrow>
        <SectionHeading
          eyebrow="Transparent pricing"
          title="Simple, published fees"
          subtitle="One small trading fee per completed trade, taken in crypto. No hidden charges, ever."
        />

        <div className="mt-8 overflow-hidden rounded-xl border border-border">
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-surface-2 text-left text-xs uppercase tracking-wide text-text-3">
              <tr>
                <th className="px-4 py-3">Payment method</th>
                <th className="px-4 py-3 text-right">Trading fee</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              <tr>
                <td className="px-4 py-4"><PaymentMethodChip method="QUATAPAY" /></td>
                <td className="px-4 py-4 text-right font-money text-base font-semibold">0.30%</td>
              </tr>
              <tr>
                <td className="px-4 py-4"><PaymentMethodChip method="MTN_MOMO" /></td>
                <td className="px-4 py-4 text-right font-money text-base font-semibold">0.50%</td>
              </tr>
              <tr>
                <td className="px-4 py-4"><PaymentMethodChip method="ORANGE_MONEY" /></td>
                <td className="px-4 py-4 text-right font-money text-base font-semibold">0.50%</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div className="mt-6 rounded-xl border border-border bg-surface-1 p-5">
          <p className="text-sm font-medium">Worked example</p>
          <p className="mt-2 text-sm leading-relaxed text-text-2">
            Buy <span className="font-money">100.00 USDT</span> from a seller via MTN MoMo at 0.50%. The fee is{" "}
            <span className="font-money">0.50 USDT</span>, so you receive{" "}
            <span className="font-money text-accent-400">99.50 USDT</span> once the seller confirms your payment.
            The fee is taken from the trade in crypto — you never pay a separate charge.
          </p>
        </div>

        <ul className="mt-6 space-y-2 text-sm text-text-2">
          {[
            "No account, deposit, or listing fees.",
            "No fee on cancelled or expired trades — escrow simply returns to the seller.",
            "Withdrawals pay the blockchain (TRON) network fee only; it is shown before you confirm.",
            "The fee you see before opening a trade is the fee you pay.",
          ].map((t) => (
            <li key={t} className="flex gap-2">
              <Check size={16} className="mt-0.5 shrink-0 text-success" />
              {t}
            </li>
          ))}
        </ul>

        <div className="mt-8 flex items-center gap-3">
          <Link href="/register">
            <Button>Start trading</Button>
          </Link>
          <Link href="/legal/terms" className="text-sm text-text-2 hover:text-text-1">
            Read the full fee terms
          </Link>
        </div>
      </Section>
    </>
  );
}
