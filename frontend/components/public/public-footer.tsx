import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { ArrowUpRight, Facebook, Instagram, Linkedin, Mail, Phone, Send, Twitter } from "lucide-react";
import type { ComponentType } from "react";
import type { LucideProps } from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { getCompany } from "@/lib/content-server";

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

const SOCIAL: { key: keyof CompanySocial; icon: ComponentType<LucideProps>; label: string }[] = [
  { key: "facebook", icon: Facebook, label: "Facebook" },
  { key: "x", icon: Twitter, label: "X" },
  { key: "instagram", icon: Instagram, label: "Instagram" },
  { key: "linkedin", icon: Linkedin, label: "LinkedIn" },
  { key: "telegram", icon: Send, label: "Telegram" },
];

type CompanySocial = { facebook: string; x: string; instagram: string; linkedin: string; telegram: string };

/** Marketing + legal footer, fully localized (Documents/14 §13.C). */
export async function PublicFooter(): Promise<React.JSX.Element> {
  const t = await getTranslations("footer");
  const company = await getCompany();
  const year = 2026;
  // Only render links that are non-empty AND http(s) — belt-and-suspenders against a
  // non-http scheme (e.g. javascript:) slipping through to an <a href> (see zSocialLinks).
  const socials = SOCIAL.filter((s) => {
    const v = company.social[s.key]?.trim();
    return !!v && /^https?:\/\//i.test(v);
  });

  return (
    <footer className="border-t border-border bg-surface-1">
      <div className="mx-auto max-w-6xl px-4 py-10 md:px-6">
        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-5">
          <div className="lg:col-span-1">
            <Logo size={18} />
            <p className="mt-3 max-w-xs text-sm text-text-2">{company.tagline || t("tagline")}</p>
            <a
              href="https://quatadigital.com"
              target="_blank"
              rel="noreferrer noopener"
              className="mt-3 inline-flex items-center gap-1 text-xs text-text-3 transition-colors hover:text-accent-400"
            >
              {t("productOf")}
              <ArrowUpRight size={12} aria-hidden />
            </a>
            {(company.email || company.phone) && (
              <div className="mt-4 space-y-1.5">
                {company.email && (
                  <a
                    href={`mailto:${company.email}`}
                    className="flex min-h-6 items-center gap-2 text-sm text-text-2 transition-colors hover:text-text-1"
                  >
                    <Mail size={14} className="text-accent-400" aria-hidden /> {company.email}
                  </a>
                )}
                {company.phone && (
                  <a
                    href={`tel:${company.phone.replace(/\s+/g, "")}`}
                    className="flex min-h-6 items-center gap-2 text-sm text-text-2 transition-colors hover:text-text-1"
                  >
                    <Phone size={14} className="text-accent-400" aria-hidden /> {company.phone}
                  </a>
                )}
              </div>
            )}
            {socials.length > 0 && (
              <div className="mt-4 flex gap-2">
                {socials.map((s) => (
                  <a
                    key={s.key}
                    href={company.social[s.key]}
                    target="_blank"
                    rel="noreferrer noopener"
                    aria-label={s.label}
                    className="flex h-8 w-8 items-center justify-center rounded-lg border border-border text-text-2 transition-colors hover:border-accent-400/50 hover:text-accent-400"
                  >
                    <s.icon size={15} aria-hidden />
                  </a>
                ))}
              </div>
            )}
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
                      <Link
                        href={l.href}
                        className="inline-flex min-h-6 items-center text-sm text-text-2 transition-colors hover:text-text-1"
                      >
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
