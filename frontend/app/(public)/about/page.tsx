import type { Metadata } from "next";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { Section, SectionHeading } from "@/components/public/marketing";
import { Reveal } from "@/components/motion/reveal";
import { buttonClassName } from "@/components/ui/button";
import { BrandMark } from "@/components/brand/logo";
import { CameroonMap } from "@/components/public/cameroon-map";

export const metadata: Metadata = {
  title: "About — QuataTrade",
  description: "QuataTrade is a Cameroon-first P2P crypto marketplace built on trust and escrow protection.",
};

const VALUES: { titleKey: string; bodyKey: string }[] = [
  { titleKey: "value1Title", bodyKey: "value1Body" },
  { titleKey: "value2Title", bodyKey: "value2Body" },
  { titleKey: "value3Title", bodyKey: "value3Body" },
];

export default function AboutPage(): React.JSX.Element {
  const t = useTranslations("about");

  return (
    <>
      <Section narrow>
        <Reveal>
          <SectionHeading as="h1" eyebrow={t("eyebrow")} title={t("heroTitle")} />
          <div className="mt-6 space-y-4 text-text-2">
            <p>{t("intro1")}</p>
            <p>{t("intro2")}</p>
            <p>
              {t("intro3")}{" "}
              <a
                href="https://quatadigital.com"
                target="_blank"
                rel="noreferrer noopener"
                className="text-accent-400 hover:underline"
              >
                quatadigital.com
              </a>
              .
            </p>
          </div>
        </Reveal>
      </Section>

      <div className="border-y border-border bg-surface-1">
        <Section narrow>
          <Reveal>
            <h2 className="font-display text-xl font-semibold">{t("valuesTitle")}</h2>
          </Reveal>
          <div className="mt-5 grid gap-4 sm:grid-cols-3">
            {VALUES.map((v, i) => (
              <Reveal key={v.titleKey} delay={i * 0.07} className="h-full">
                <div className="h-full rounded-xl border border-border bg-bg p-4">
                  <p className="font-display font-medium">{t(v.titleKey)}</p>
                  <p className="mt-1 text-sm text-text-2">{t(v.bodyKey)}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </Section>
      </div>

      <Section className="border-b border-border">
        <Reveal>
          <CameroonMap />
        </Reveal>
      </Section>

      <Section className="text-center">
        <Reveal>
          <div className="mx-auto flex max-w-lg flex-col items-center gap-4">
            <BrandMark size={40} />
            <p className="text-text-2">
              {t("legalPrefix")}{" "}
              <Link href="/legal/imprint" className="text-accent-400 hover:underline">
                {t("legalLink")}
              </Link>
              .
            </p>
            <Link href="/register" className={buttonClassName()}>
              {t("ctaButton")}
            </Link>
          </div>
        </Reveal>
      </Section>
    </>
  );
}
