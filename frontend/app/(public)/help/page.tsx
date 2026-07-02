import type { Metadata } from "next";
import Link from "next/link";
import { useTranslations } from "next-intl";
import {
  ArrowUpFromLine,
  BadgeCheck,
  CreditCard,
  HelpCircle,
  Rocket,
  ShieldAlert,
  ShieldCheck,
  ShoppingCart,
  Tag,
} from "lucide-react";
import { Section, SectionHeading } from "@/components/public/marketing";
import { Reveal } from "@/components/motion/reveal";

export const metadata: Metadata = {
  title: "Help Center — QuataTrade",
  description: "Guides for getting started, verification, buying, selling, payments, wallet, disputes, and security.",
};

const CATEGORIES = [
  { icon: Rocket, key: "cat1" },
  { icon: BadgeCheck, key: "cat2" },
  { icon: ShoppingCart, key: "cat3" },
  { icon: Tag, key: "cat4" },
  { icon: CreditCard, key: "cat5" },
  { icon: ArrowUpFromLine, key: "cat6" },
  { icon: ShieldAlert, key: "cat7" },
  { icon: ShieldCheck, key: "cat8" },
] as const;

const STARTERS = ["faq1", "faq2", "faq3", "faq4", "faq5"] as const;

export default function HelpPage(): React.JSX.Element {
  const t = useTranslations("help");

  return (
    <>
      <Section narrow>
        <Reveal>
          <SectionHeading eyebrow={t("heroEyebrow")} title={t("heroTitle")} subtitle={t("heroSubtitle")} />
        </Reveal>
        <div className="mt-8 grid gap-3 sm:grid-cols-2">
          {CATEGORIES.map((c, i) => (
            <Reveal key={c.key} delay={i * 0.05}>
              <div className="flex items-start gap-3 rounded-xl border border-border bg-surface-1 p-4">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-accent-400/15 text-accent-400">
                  <c.icon size={18} aria-hidden />
                </div>
                <div>
                  <p className="font-medium">{t(`${c.key}Title`)}</p>
                  <p className="mt-0.5 text-sm text-text-2">{t(`${c.key}Desc`)}</p>
                </div>
              </div>
            </Reveal>
          ))}
        </div>
        <Reveal>
          <p className="mt-4 rounded-lg border border-dashed border-accent-400/40 bg-accent-400/5 px-3 py-2 text-sm text-text-2">
            <span className="font-semibold text-accent-400">{t("noteLabel")}</span>
            {t("noteBody")}
          </p>
        </Reveal>
      </Section>

      <div className="border-t border-border bg-surface-1">
        <Section narrow>
          <Reveal>
            <h2 className="flex items-center gap-2 font-display text-xl font-semibold">
              <HelpCircle size={20} className="text-accent-400" /> {t("faqHeading")}
            </h2>
          </Reveal>
          <div className="mt-5 space-y-3">
            {STARTERS.map((k, i) => (
              <Reveal key={k} delay={i * 0.06}>
                <details className="group rounded-xl border border-border bg-bg p-4">
                  <summary className="cursor-pointer list-none font-medium text-text-1 [&::-webkit-details-marker]:hidden">
                    {t(`${k}Q`)}
                  </summary>
                  <p className="mt-2 text-sm leading-relaxed text-text-2">{t(`${k}A`)}</p>
                </details>
              </Reveal>
            ))}
          </div>
          <Reveal>
            <p className="mt-6 text-sm text-text-2">
              {t("stuckPrefix")}{" "}
              <Link href="/contact" className="text-accent-400 hover:underline">
                {t("stuckLink")}
              </Link>
              .
            </p>
          </Reveal>
        </Section>
      </div>
    </>
  );
}
