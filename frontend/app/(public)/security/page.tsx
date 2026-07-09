import type { Metadata } from "next";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { Section, SectionHeading } from "@/components/public/marketing";
import { buttonClassName } from "@/components/ui/button";
import { Reveal } from "@/components/motion/reveal";
import { Check, ShieldAlert } from "lucide-react";
import {
  EscrowIllustration,
  VerificationIllustration,
  ColdStorageIllustration,
  SecurityKeysIllustration,
  BiometricsIllustration,
  InfrastructureIllustration,
} from "@/components/public/security-illustrations";
import { buildMetadata } from "@/lib/seo-engine";

export function generateMetadata(): Promise<Metadata> {
  return buildMetadata("/security", {
    title: "Security & Trust — QuataTrade",
    description: "How QuataTrade protects your account and your funds: escrow, 2FA, cold storage, KYC, and dispute protection.",
  });
}

const CARDS = [
  { Illustration: EscrowIllustration, titleKey: "card1Title", bodyKey: "card1Body" },
  { Illustration: VerificationIllustration, titleKey: "card2Title", bodyKey: "card2Body" },
  { Illustration: ColdStorageIllustration, titleKey: "card3Title", bodyKey: "card3Body" },
  { Illustration: SecurityKeysIllustration, titleKey: "card4Title", bodyKey: "card4Body" },
  { Illustration: BiometricsIllustration, titleKey: "card5Title", bodyKey: "card5Body" },
  { Illustration: InfrastructureIllustration, titleKey: "card6Title", bodyKey: "card6Body" },
];

const STAY_SAFE = ["staySafe1", "staySafe2", "staySafe3", "staySafe4", "staySafe5", "staySafe6"] as const;

export default function SecurityPage(): React.JSX.Element {
  const t = useTranslations("security");

  return (
    <>
      <Section narrow>
        <Reveal>
          <SectionHeading
            as="h1"
            eyebrow={t("heroEyebrow")}
            title={t("heroTitle")}
            subtitle={t("heroSubtitle")}
          />
        </Reveal>
      </Section>

      <div className="border-y border-border bg-surface-1/40">
        <Section>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {CARDS.map((card, i) => {
              const Visual = card.Illustration;
              return (
                <Reveal key={card.titleKey} delay={i * 0.07}>
                  <div className="rounded-xl border border-border bg-surface-1 p-6 hover:-translate-y-1 hover:border-accent-400/40 transition-all duration-300">
                    <Visual />
                    <h3 className="mt-4 font-display text-lg font-semibold text-text-1">{t(card.titleKey)}</h3>
                    <p className="mt-2 text-sm leading-relaxed text-text-2">{t(card.bodyKey)}</p>
                  </div>
                </Reveal>
              );
            })}
          </div>
        </Section>
      </div>

      <Section narrow className="space-y-6">
        <Reveal>
          <div className="rounded-2xl border border-border/80 bg-surface-1/40 p-6 md:p-8 backdrop-blur-md relative overflow-hidden shadow-lg">
            <h3 className="font-display text-lg font-bold text-text-1">{t("staySafeTitle")}</h3>
            <ul className="mt-4 space-y-3">
              {STAY_SAFE.map((key) => (
                <li key={key} className="flex gap-3 text-xs leading-relaxed text-text-2">
                  <Check size={14} className="mt-0.5 shrink-0 text-accent-400" />
                  <span>{t(key)}</span>
                </li>
              ))}
            </ul>
          </div>
        </Reveal>
        <Reveal>
          <div className="rounded-2xl border border-danger/25 bg-surface-1/40 p-6 md:p-8 backdrop-blur-md relative overflow-hidden shadow-lg shadow-danger/5">
            <div className="flex items-start gap-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-danger/10 text-danger border border-danger/20">
                <ShieldAlert size={18} />
              </div>
              <div className="space-y-2">
                <h3 className="font-display text-lg font-bold text-text-1">{t("reportTitle")}</h3>
                <p className="text-xs leading-relaxed text-text-2">{t("reportBody")}</p>
                <div className="pt-2">
                  <a
                    href="mailto:support@quatatrade.com"
                    className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface-2/60 px-4 py-2 text-xs font-semibold text-text-1 hover:border-accent-400/40 hover:text-accent-400 transition-colors"
                  >
                    support@quatatrade.com
                  </a>
                </div>
              </div>
            </div>
          </div>
        </Reveal>
        <Reveal>
          <div className="mt-6 flex items-center gap-3">
            <Link href="/register" className={buttonClassName()}>
              {t("ctaButton")}
            </Link>
            <Link href="/legal/privacy" className="text-sm text-text-2 hover:text-text-1">
              {t("privacyLink")}
            </Link>
          </div>
        </Reveal>
      </Section>
    </>
  );
}
