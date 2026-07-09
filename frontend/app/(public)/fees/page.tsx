import type { Metadata } from "next";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { Check } from "lucide-react";
import { Section, SectionHeading } from "@/components/public/marketing";
import { buttonClassName } from "@/components/ui/button";
import { Reveal } from "@/components/motion/reveal";
import { FeeCalculator } from "@/components/public/fee-calculator";
import { buildMetadata } from "@/lib/seo-engine";

export function generateMetadata(): Promise<Metadata> {
  return buildMetadata("/fees", {
    title: "Fees — QuataTrade",
    description:
      "QuataTrade's launch fee structure: 0% trading for buyers and sellers, a low flat deposit fee, and no platform withdrawal fee. No hidden fees.",
  });
}

const ROWS = ["buyerFee", "sellerFee", "depositFee", "withdrawalFee", "adFee", "disputeFee"] as const;
const EXAMPLES = ["example1", "example2", "example3"] as const;
const NOTES = ["note1", "note2", "note3", "note4"] as const;

export default function FeesPage(): React.JSX.Element {
  const t = useTranslations("fees");

  return (
    <>
      <Section narrow>
        <Reveal>
          <SectionHeading as="h1" eyebrow={t("eyebrow")} title={t("title")} subtitle={t("subtitle")} />
        </Reveal>

        <Reveal className="mt-8 rounded-xl border border-accent-400/30 bg-accent-400/5 p-4 text-sm leading-relaxed text-text-2">
          {t("promoNote")}
        </Reveal>

        <Reveal className="mt-6 overflow-hidden rounded-xl border border-border">
          <table className="w-full text-sm">
            <tbody className="divide-y divide-border">
              {ROWS.map((k) => (
                <tr key={k}>
                  <td className="px-4 py-4">
                    <p className="font-medium text-text-1">{t(`${k}Label`)}</p>
                    <p className="mt-0.5 text-xs text-text-3">{t(`${k}Note`)}</p>
                  </td>
                  <td className="whitespace-nowrap px-4 py-4 text-right font-money text-base font-semibold text-accent-400">
                    {t(`${k}Value`)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Reveal>

        <Reveal className="mt-8">
          <h2 className="font-display text-lg font-semibold">{t("examplesTitle")}</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-3">
            {EXAMPLES.map((k) => (
              <div key={k} className="group rounded-2xl border border-border/80 bg-surface-1/40 p-5 backdrop-blur-md hover:-translate-y-1 hover:border-accent-400/40 hover:bg-surface-2/65 transition-all duration-300 shadow-md hover:shadow-accent-400/5 relative overflow-hidden">
                <p className="font-display text-sm font-bold text-text-1 group-hover:text-accent-400 transition-colors duration-300">{t(`${k}Title`)}</p>
                <p className="mt-2 text-xs leading-relaxed text-text-2">{t(`${k}Body`)}</p>
              </div>
            ))}
          </div>
        </Reveal>

        <Reveal>
          <ul className="mt-8 space-y-2 text-sm text-text-2">
            {NOTES.map((k) => (
              <li key={k} className="flex gap-2">
                <Check size={16} className="mt-0.5 shrink-0 text-success" aria-hidden />
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

      <Section className="border-t border-border">
        <Reveal>
          <FeeCalculator />
        </Reveal>
      </Section>
    </>
  );
}
