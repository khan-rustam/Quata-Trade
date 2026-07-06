import type { Metadata } from "next";
import type { ComponentType } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { Fingerprint, KeyRound, Lock, Server, ShieldCheck, Snowflake, type LucideProps } from "lucide-react";
import { Section, SectionHeading, FeatureCard } from "@/components/public/marketing";
import { buttonClassName } from "@/components/ui/button";
import { Reveal } from "@/components/motion/reveal";

export const metadata: Metadata = {
  title: "Security & Trust — QuataTrade",
  description: "How QuataTrade protects your account and your funds: escrow, 2FA, cold storage, KYC, and dispute protection.",
};

const CARDS: { icon: ComponentType<LucideProps>; titleKey: string; bodyKey: string }[] = [
  { icon: Lock, titleKey: "card1Title", bodyKey: "card1Body" },
  { icon: ShieldCheck, titleKey: "card2Title", bodyKey: "card2Body" },
  { icon: Snowflake, titleKey: "card3Title", bodyKey: "card3Body" },
  { icon: KeyRound, titleKey: "card4Title", bodyKey: "card4Body" },
  { icon: Fingerprint, titleKey: "card5Title", bodyKey: "card5Body" },
  { icon: Server, titleKey: "card6Title", bodyKey: "card6Body" },
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

      <div className="border-y border-border bg-surface-1">
        <Section>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {CARDS.map((card, i) => (
              <Reveal key={card.titleKey} delay={i * 0.07}>
                <FeatureCard icon={card.icon} title={t(card.titleKey)}>
                  {t(card.bodyKey)}
                </FeatureCard>
              </Reveal>
            ))}
          </div>
        </Section>
      </div>

      <Section narrow>
        <Reveal>
          <div className="rounded-xl border border-border bg-surface-1 p-5">
            <h3 className="font-display text-lg font-medium">{t("staySafeTitle")}</h3>
            <ul className="mt-3 space-y-2 text-sm text-text-2">
              {STAY_SAFE.map((key) => (
                <li key={key}>• {t(key)}</li>
              ))}
            </ul>
          </div>
        </Reveal>
        <Reveal>
          <div className="mt-6 rounded-xl border border-accent-400/30 bg-accent-400/5 p-5">
            <h3 className="font-display text-lg font-medium">{t("reportTitle")}</h3>
            <p className="mt-2 text-sm leading-relaxed text-text-2">{t("reportBody")}</p>
            <a
              href="mailto:support@quatatrade.com"
              className="mt-2 inline-block text-sm font-medium text-accent-400 hover:underline"
            >
              support@quatatrade.com
            </a>
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
