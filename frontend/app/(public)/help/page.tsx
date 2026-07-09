import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
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
  ChevronDown,
} from "lucide-react";
import type { Faq } from "@quatatrade/shared";
import { Section, SectionHeading } from "@/components/public/marketing";
import { Reveal } from "@/components/motion/reveal";
import { getFaqs } from "@/lib/content-server";
import { buildMetadata } from "@/lib/seo-engine";

export function generateMetadata(): Promise<Metadata> {
  return buildMetadata("/help", {
    title: "Help Center — QuataTrade",
    description: "Guides for getting started, verification, buying, selling, payments, wallet, disputes, and security.",
  });
}

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

/** Preserve API order (sortOrder) while bucketing FAQs under their category. */
function groupByCategory(faqs: Faq[]): { category: string; items: Faq[] }[] {
  const groups: { category: string; items: Faq[] }[] = [];
  for (const faq of faqs) {
    const key = faq.category || "";
    let group = groups.find((g) => g.category === key);
    if (!group) {
      group = { category: key, items: [] };
      groups.push(group);
    }
    group.items.push(faq);
  }
  return groups;
}

export default async function HelpPage(): Promise<React.JSX.Element> {
  const t = await getTranslations("help");
  const faqs = await getFaqs();
  const groups = groupByCategory(faqs);

  return (
    <>
      <Section narrow>
        <Reveal>
          <SectionHeading as="h1" eyebrow={t("heroEyebrow")} title={t("heroTitle")} subtitle={t("heroSubtitle")} />
        </Reveal>
        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          {CATEGORIES.map((c, i) => (
            <Reveal key={c.key} delay={i * 0.05}>
              <div className="group flex items-start gap-4 rounded-2xl border border-border/80 bg-surface-1/40 p-5 backdrop-blur-md hover:-translate-y-0.5 hover:border-accent-400/40 hover:bg-surface-2/65 transition-all duration-300 relative overflow-hidden shadow-md">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent-400/10 text-accent-400 border border-accent-400/20 group-hover:scale-105 transition-transform duration-300">
                  <c.icon size={18} aria-hidden />
                </div>
                <div>
                  <p className="font-display font-semibold text-text-1 group-hover:text-accent-400 transition-colors duration-300">{t(`${c.key}Title`)}</p>
                  <p className="mt-1 text-xs leading-relaxed text-text-2">{t(`${c.key}Desc`)}</p>
                </div>
              </div>
            </Reveal>
          ))}
        </div>
      </Section>

      <div className="border-t border-border bg-surface-1">
        <Section narrow>
          <Reveal>
            <h2 className="flex items-center gap-2 font-display text-xl font-semibold">
              <HelpCircle size={20} className="text-accent-400" /> {t("faqHeading")}
            </h2>
          </Reveal>
          {groups.length === 0 ? (
            <p className="mt-5 rounded-xl border border-border bg-bg p-4 text-sm text-text-2">{t("faqEmpty")}</p>
          ) : (
            <div className="mt-5 space-y-6">
              {groups.map((group) => (
                <div key={group.category || "general"}>
                  {group.category && (
                    <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-text-3">
                      {group.category.replace(/[_-]+/g, " ")}
                    </h3>
                  )}
                  <div className="space-y-3">
                    {group.items.map((faq, i) => (
                      <Reveal key={faq.id} delay={i * 0.04}>
                        <details className="group rounded-xl border border-border bg-surface-1/30 p-4 transition-all duration-300 hover:border-accent-400/30 hover:bg-surface-1/65">
                          <summary className="flex items-center justify-between cursor-pointer list-none font-semibold text-text-1 [&::-webkit-details-marker]:hidden">
                            <span>{faq.question}</span>
                            <ChevronDown size={16} className="text-text-3 group-open:rotate-180 group-hover:text-accent-400 transition-all duration-300" />
                          </summary>
                          <p className="mt-3 border-t border-border/40 pt-3 whitespace-pre-line text-xs leading-relaxed text-text-2">{faq.answer}</p>
                        </details>
                      </Reveal>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
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
