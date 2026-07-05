import type { Metadata } from "next";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { Check } from "lucide-react";
import { Section, SectionHeading } from "@/components/public/marketing";
import { buttonClassName } from "@/components/ui/button";
import { PaymentMethodChip } from "@/components/trade/payment-method-chip";
import { Reveal } from "@/components/motion/reveal";

export const metadata: Metadata = {
  title: "Fees — QuataTrade",
  description: "QuataTrade's trading fees per payment method, with worked examples. No hidden fees.",
};

export default function FeesPage(): React.JSX.Element {
  const t = useTranslations("fees");
  const bulletKeys = ["bullet1", "bullet2", "bullet3", "bullet4"];

  return (
    <>
      <Section narrow>
        <Reveal>
          <SectionHeading as="h1" eyebrow={t("eyebrow")} title={t("title")} subtitle={t("subtitle")} />
        </Reveal>

        <Reveal className="mt-8 overflow-hidden rounded-xl border border-border">
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-surface-2 text-left text-xs uppercase tracking-wide text-text-3">
              <tr>
                <th className="px-4 py-3">{t("tableHeadMethod")}</th>
                <th className="px-4 py-3 text-right">{t("tableHeadFee")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              <tr>
                <td className="px-4 py-4">
                  <PaymentMethodChip method="QUATAPAY" />
                </td>
                <td className="px-4 py-4 text-right font-money text-base font-semibold">{t("feeQuatapay")}</td>
              </tr>
              <tr>
                <td className="px-4 py-4">
                  <PaymentMethodChip method="MTN_MOMO" />
                </td>
                <td className="px-4 py-4 text-right font-money text-base font-semibold">{t("feeMomo")}</td>
              </tr>
              <tr>
                <td className="px-4 py-4">
                  <PaymentMethodChip method="ORANGE_MONEY" />
                </td>
                <td className="px-4 py-4 text-right font-money text-base font-semibold">{t("feeOrange")}</td>
              </tr>
            </tbody>
          </table>
        </Reveal>

        <Reveal className="mt-6 rounded-xl border border-border bg-surface-1 p-5">
          <p className="text-sm font-medium">{t("workedExampleTitle")}</p>
          <p className="mt-2 text-sm leading-relaxed text-text-2">
            {t("exampleBuy")}{" "}
            <span className="font-money">{t("exampleAmount1")}</span>{" "}
            {t("exampleMid1")}{" "}
            <span className="font-money">{t("exampleAmount2")}</span>
            {t("exampleMid2")}{" "}
            <span className="font-money text-accent-400">{t("exampleAmount3")}</span>{" "}
            {t("exampleEnd")}
          </p>
        </Reveal>

        <Reveal>
          <ul className="mt-6 space-y-2 text-sm text-text-2">
            {bulletKeys.map((k) => (
              <li key={k} className="flex gap-2">
                <Check size={16} className="mt-0.5 shrink-0 text-success" />
                {t(k)}
              </li>
            ))}
          </ul>
        </Reveal>

        <Reveal className="mt-8 flex items-center gap-3">
          <Link href="/register" className={buttonClassName()}>
            {t("ctaStart")}
          </Link>
          <Link href="/legal/terms" className="text-sm text-text-2 hover:text-text-1">
            {t("ctaTerms")}
          </Link>
        </Reveal>
      </Section>
    </>
  );
}
