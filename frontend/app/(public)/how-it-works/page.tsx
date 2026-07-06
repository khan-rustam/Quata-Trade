import type { Metadata } from "next";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { Section, SectionHeading } from "@/components/public/marketing";
import { buttonClassName } from "@/components/ui/button";
import { Keyhole } from "@/components/brand/keyhole";
import { Reveal } from "@/components/motion/reveal";
import { TimelinePhone } from "@/components/public/timeline-phone";
import { ArrowRight } from "lucide-react";

export const metadata: Metadata = {
  title: "How it works — QuataTrade",
  description: "Buyer and seller flows on QuataTrade, and how escrow protects every trade.",
};

export default function HowItWorksPage(): React.JSX.Element {
  const t = useTranslations("howItWorks");

  return (
    <>
      <Section narrow>
        <Reveal>
          <SectionHeading as="h1" eyebrow={t("heroEyebrow")} title={t("heroTitle")} subtitle={t("heroSubtitle")} />
        </Reveal>
      </Section>

      <div className="border-y border-border bg-surface-1/40">
        <Section>
          <Reveal>
            <TimelinePhone />
          </Reveal>
        </Section>
      </div>

      <div className="border-b border-border bg-surface-1/25 relative overflow-hidden">
        {/* Subtle grid pattern background */}
        <div className="absolute inset-0 bg-grid-pattern opacity-10 pointer-events-none" />
        <Section narrow>
          <Reveal>
            <div className="flex items-start gap-5 rounded-2xl border border-accent-400/25 bg-surface-1/40 p-6 md:p-8 backdrop-blur-md relative overflow-hidden shadow-lg shadow-accent-400/5">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-accent-400/10 border border-accent-400/25 text-accent-400 relative">
                <span className="absolute inset-0 rounded-xl bg-accent-400/20 animate-ping opacity-75 pointer-events-none" />
                <Keyhole size={20} />
              </div>
              <div className="space-y-2">
                <h3 className="font-display text-lg font-bold text-text-1">{t("escrowTitle")}</h3>
                <p className="text-sm leading-relaxed text-text-2">{t("escrowBody")}</p>
                <div className="pt-1">
                  <Link
                    href="/legal/trade-rules"
                    className="inline-flex items-center gap-1 text-sm font-semibold text-accent-400 hover:underline"
                  >
                    {t("escrowLink")} <ArrowRight size={14} className="ml-0.5" />
                  </Link>
                </div>
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
