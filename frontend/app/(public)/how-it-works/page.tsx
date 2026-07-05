import type { Metadata } from "next";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { Section, SectionHeading, Step } from "@/components/public/marketing";
import { buttonClassName } from "@/components/ui/button";
import { Keyhole } from "@/components/brand/keyhole";
import { Reveal } from "@/components/motion/reveal";

export const metadata: Metadata = {
  title: "How it works — QuataTrade",
  description: "Buyer and seller flows on QuataTrade, and how escrow protects every trade.",
};

const STEP_NUMBERS = [1, 2, 3, 4] as const;

export default function HowItWorksPage(): React.JSX.Element {
  const t = useTranslations("howItWorks");

  return (
    <>
      <Section narrow>
        <Reveal>
          <SectionHeading as="h1" eyebrow={t("heroEyebrow")} title={t("heroTitle")} subtitle={t("heroSubtitle")} />
        </Reveal>
      </Section>

      <div className="border-y border-border bg-surface-1">
        <Section>
          <Reveal>
            <h2 className="font-display text-2xl font-bold">{t("buyHeading")}</h2>
          </Reveal>
          <div className="mt-6 grid gap-4 md:grid-cols-4">
            {STEP_NUMBERS.map((n, i) => (
              <Reveal key={n} delay={i * 0.07}>
                <Step n={n} title={t(`buyStep${n}Title`)}>{t(`buyStep${n}Body`)}</Step>
              </Reveal>
            ))}
          </div>
        </Section>
      </div>

      <Section>
        <Reveal>
          <h2 className="font-display text-2xl font-bold">{t("sellHeading")}</h2>
        </Reveal>
        <div className="mt-6 grid gap-4 md:grid-cols-4">
          {STEP_NUMBERS.map((n, i) => (
            <Reveal key={n} delay={i * 0.07}>
              <Step n={n} title={t(`sellStep${n}Title`)}>{t(`sellStep${n}Body`)}</Step>
            </Reveal>
          ))}
        </div>
      </Section>

      <div className="border-y border-border bg-surface-1">
        <Section narrow>
          <Reveal>
            <div className="flex items-start gap-4 rounded-xl border border-accent-400/30 bg-accent-400/5 p-5">
              <Keyhole size={28} className="mt-0.5 shrink-0 text-accent-400" />
              <div>
                <h3 className="font-display text-lg font-medium">{t("escrowTitle")}</h3>
                <p className="mt-1 text-sm leading-relaxed text-text-2">{t("escrowBody")}</p>
                <Link
                  href="/legal/trade-rules"
                  className="mt-2 inline-block text-sm text-accent-400 hover:underline"
                >
                  {t("escrowLink")}
                </Link>
              </div>
            </div>
          </Reveal>
        </Section>
      </div>

      <Section className="text-center">
        <Reveal>
          <Link href="/register" className={buttonClassName({ size: "lg" })}>
            {t("ctaButton")}
          </Link>
        </Reveal>
      </Section>
    </>
  );
}
