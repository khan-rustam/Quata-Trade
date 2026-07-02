import Link from "next/link";
import { useTranslations } from "next-intl";
import { Logo } from "@/components/brand/logo";

type FooterLink = { key: string; href: string; soon?: boolean };

const COLUMNS: { titleKey: string; links: FooterLink[] }[] = [
  {
    titleKey: "product",
    links: [
      { key: "howItWorks", href: "/how-it-works" },
      { key: "fees", href: "/fees" },
      { key: "security", href: "/security" },
      { key: "markets", href: "/markets", soon: true },
    ],
  },
  {
    titleKey: "support",
    links: [
      { key: "help", href: "/help" },
      { key: "contact", href: "/contact" },
      { key: "status", href: "/status" },
      { key: "complaints", href: "/legal/complaints" },
    ],
  },
  {
    titleKey: "legal",
    links: [
      { key: "terms", href: "/legal/terms" },
      { key: "privacy", href: "/legal/privacy" },
      { key: "aml", href: "/legal/aml" },
      { key: "risk", href: "/legal/risk" },
      { key: "tradeRules", href: "/legal/trade-rules" },
      { key: "prohibited", href: "/legal/prohibited-use" },
      { key: "cookies", href: "/legal/cookies" },
      { key: "imprint", href: "/legal/imprint" },
    ],
  },
  {
    titleKey: "company",
    links: [
      { key: "about", href: "/about" },
      { key: "blog", href: "/blog", soon: true },
      { key: "careers", href: "/careers", soon: true },
    ],
  },
];

/** Marketing + legal footer, fully localized (Documents/14 §13.C). */
export function PublicFooter(): React.JSX.Element {
  const t = useTranslations("footer");
  const year = 2026;

  return (
    <footer className="border-t border-border bg-surface-1">
      <div className="mx-auto max-w-6xl px-4 py-10 md:px-6">
        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-5">
          <div className="lg:col-span-1">
            <Logo size={18} />
            <p className="mt-3 max-w-xs text-sm text-text-2">{t("tagline")}</p>
          </div>
          {COLUMNS.map((col) => (
            <div key={col.titleKey}>
              <h3 className="text-xs font-semibold uppercase tracking-wide text-text-3">{t(col.titleKey)}</h3>
              <ul className="mt-3 space-y-2">
                {col.links.map((l) => (
                  <li key={l.href}>
                    {l.soon ? (
                      <span className="text-sm text-text-3">
                        {t(`links.${l.key}`)} <span className="text-[10px]">{t("soon")}</span>
                      </span>
                    ) : (
                      <Link href={l.href} className="text-sm text-text-2 transition-colors hover:text-text-1">
                        {t(`links.${l.key}`)}
                      </Link>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-10 flex flex-col items-start justify-between gap-3 border-t border-border pt-6 text-sm text-text-3 sm:flex-row sm:items-center">
          <p>{t("rights", { year })}</p>
          <p className="text-xs">{t("disclaimer")}</p>
        </div>
      </div>
    </footer>
  );
}
