"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { Facebook, Instagram, Linkedin, Mail, Send, Twitter } from "lucide-react";
import type { ComponentType } from "react";
import type { LucideProps } from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { cn } from "@/lib/utils";

// Static data defined client-side for public routing
type FooterLink = { key: string; href: string; soon?: boolean };

const COLUMNS: { titleKey: string; links: FooterLink[] }[] = [
  {
    titleKey: "product",
    links: [
      { key: "howItWorks", href: "/how-it-works" },
      { key: "fees", href: "/fees" },
      { key: "security", href: "/security" },
      { key: "markets", href: "/markets" },
      { key: "download", href: "/download" },
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

const SOCIAL: { key: string; icon: ComponentType<LucideProps>; label: string }[] = [
  { key: "facebook", icon: Facebook, label: "Facebook" },
  { key: "x", icon: Twitter, label: "X" },
  { key: "instagram", icon: Instagram, label: "Instagram" },
  { key: "linkedin", icon: Linkedin, label: "LinkedIn" },
  { key: "telegram", icon: Send, label: "Telegram" },
];

export function PublicFooter(): React.JSX.Element {
  const t = useTranslations("footer");
  const year = 2026;

  // Static company data representation
  const company = {
    email: "support@quatade.com",
    phone: "",
    social: {
      facebook: "https://facebook.com/quatatrade",
      x: "https://x.com/quatatrade",
      instagram: "https://instagram.com/quatatrade",
      linkedin: "https://linkedin.com/company/quatatrade",
      telegram: "https://t.me/quatatrade",
    },
  };

  return (
    <footer className="relative overflow-hidden border-t border-border bg-surface-1/40 py-20 backdrop-blur-xl">
      {/* 1. Neon light-bar separator at the very top of footer */}
      <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-accent-400 to-transparent shadow-[0_0_20px_var(--color-accent-400)] opacity-70" />

      {/* 2. Massive Watermark spanning background of the whole link block */}
      <div className="pointer-events-none absolute inset-x-0 bottom-10 z-0 select-none overflow-hidden text-center leading-none opacity-[0.03]">
        <span className="font-display text-[22vw] font-black tracking-[0.15em] text-text-1">
          QUATA
        </span>
      </div>

      {/* 3. Decorative background glow spots */}
      <div className="pointer-events-none absolute -bottom-40 left-[10%] h-[350px] w-[350px] rounded-full bg-accent-400/5 blur-[120px]" />
      <div className="pointer-events-none absolute -top-40 right-[15%] h-[400px] w-[400px] rounded-full bg-brand-700/5 blur-[150px]" />

      <div className="relative z-10 mx-auto max-w-6xl px-4 md:px-6">
        <div className="grid gap-12 sm:grid-cols-2 lg:grid-cols-5">
          
          {/* Left Column: Branding Section */}
          <div className="lg:col-span-1 space-y-6">
            <div className="flex items-center gap-3">
              <Logo size={24} />
            </div>

            {/* Glassmorphic tagline badge */}
            <div className="inline-block rounded-xl border border-accent-400/20 bg-accent-400/5 px-3 py-1.5 text-xs font-semibold text-accent-400 shadow-sm shadow-accent-400/5">
              {t("tagline")}
            </div>

            <p className="text-xs leading-relaxed text-text-2">
              A peer-to-peer USDT marketplace with escrow protection built for Cameroon and Central Africa.
            </p>

            {/* Support contact cards */}
            <div className="space-y-2 pt-2">
              <a
                href={`mailto:${company.email}`}
                className="flex items-center gap-3 rounded-xl border border-border/80 bg-surface-2/40 px-3.5 py-2.5 text-xs text-text-2 transition-all duration-300 hover:border-accent-400/40 hover:bg-surface-2 hover:text-text-1"
              >
                <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-accent-400/10 text-accent-400">
                  <Mail size={12} />
                </div>
                <span className="font-money truncate">{company.email}</span>
              </a>
            </div>

            {/* Social channels */}
            <div className="flex gap-2">
              {SOCIAL.map((s) => (
                <a
                  key={s.key}
                  href={company.social[s.key as keyof typeof company.social]}
                  target="_blank"
                  rel="noreferrer noopener"
                  aria-label={s.label}
                  className="flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-surface-2/20 text-text-2 transition-all duration-300 hover:-translate-y-0.5 hover:border-accent-400/40 hover:bg-surface-2 hover:text-accent-400 shadow-sm"
                >
                  {s.key === "facebook" && <Facebook size={14} />}
                  {s.key === "x" && <Twitter size={14} />}
                  {s.key === "instagram" && <Instagram size={14} />}
                  {s.key === "linkedin" && <Linkedin size={14} />}
                  {s.key === "telegram" && <Send size={14} />}
                </a>
              ))}
            </div>
          </div>

          {/* Links Columns (with vertical partitions and dot sweeps on hover) */}
          {COLUMNS.map((col, idx) => (
            <div key={col.titleKey} className={cn("relative space-y-5", idx >= 0 && "lg:pl-8 lg:border-l lg:border-border/30")}>
              <div className="flex items-center justify-between border-b border-border/40 pb-2">
                <h3 className="text-[10px] font-bold uppercase tracking-widest text-text-3">
                  {/* titleKey is a key, not a label — rendering it raw printed
                      "product" / "support" / "legal" / "company" to every visitor. */}
                  {t(col.titleKey)}
                </h3>
                <span className="h-1 w-1 rounded-full bg-accent-400/30" />
              </div>
              <ul className="space-y-3">
                {col.links.map((l) => (
                  <li key={l.href}>
                    {l.soon ? (
                      <span className="inline-flex items-center gap-1.5 text-xs text-text-3 font-semibold uppercase tracking-wide">
                        {t(`links.${l.key}`)}
                        <span className="rounded-md bg-surface-2 px-1 py-0.5 text-[8px] text-text-3 font-bold">
                          {t("soon")}
                        </span>
                      </span>
                    ) : (
                      <Link
                        href={l.href}
                        className="group inline-flex items-center text-xs text-text-2 font-medium transition-all duration-200 hover:text-accent-400 hover:translate-x-1"
                      >
                        {/* Dot indicator that zips out on hover */}
                        <span className="h-1 w-0 rounded-full bg-accent-400 opacity-0 mr-0 transition-all duration-300 group-hover:w-1.5 group-hover:h-1.5 group-hover:opacity-100 group-hover:mr-2" />
                        {t(`links.${l.key}`)}
                      </Link>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Footer Bottom copyright */}
        <div className="mt-20 flex flex-col items-center justify-between gap-6 border-t border-border/40 pt-8 text-[11px] text-text-3 sm:flex-row">
          <p className="font-semibold order-2 sm:order-1">
            {t("rights", { year })}
          </p>
          <div className="flex items-center gap-2 order-1 sm:order-2">
            <span className="h-1.5 w-1.5 rounded-full bg-accent-400 animate-pulse" />
            <p className="max-w-md text-center sm:text-right font-medium italic">
              {t("disclaimer")}
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
}
