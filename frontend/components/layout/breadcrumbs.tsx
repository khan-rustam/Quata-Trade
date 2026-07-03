"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { ChevronRight, Home, LayoutDashboard } from "lucide-react";
import { cn } from "@/lib/utils";

/** Path segment → key in the `breadcrumbs` i18n namespace. Unknown segments are prettified. */
const LABELS: Record<string, string> = {
  "how-it-works": "howItWorks",
  fees: "fees",
  security: "security",
  help: "help",
  contact: "contact",
  about: "about",
  markets: "markets",
  status: "status",
  legal: "legal",
  complaints: "complaints",
  terms: "terms",
  privacy: "privacy",
  aml: "aml",
  risk: "risk",
  "trade-rules": "tradeRules",
  "prohibited-use": "prohibited",
  cookies: "cookies",
  imprint: "imprint",
  blog: "blog",
  careers: "careers",
  users: "users",
  trades: "trades",
  withdrawals: "withdrawals",
  disputes: "disputes",
  kyc: "kyc",
  treasury: "treasury",
  settings: "settings",
  content: "content",
  enquiries: "enquiries",
  audit: "audit",
  reports: "reports",
  profile: "profile",
  trade: "trade",
  wallet: "wallet",
  account: "account",
  offers: "offers",
  new: "newOffer",
  notifications: "notifications",
};

/** Parents with no index page — shown as plain text, not links. */
const NON_LINK = new Set(["legal"]);

/** A dynamic id segment (UUID or numeric) → shown as a generic "Details". */
const isDynamic = (seg: string): boolean => /^[0-9a-f]{8}-[0-9a-f-]{8,}$/i.test(seg) || /^\d+$/.test(seg);

const prettify = (seg: string): string => seg.replace(/-/g, " ").replace(/^\w/, (c) => c.toUpperCase());

export function Breadcrumbs({ contained = false }: { contained?: boolean }): React.JSX.Element | null {
  const tx = useTranslations("breadcrumbs");
  const pathname = usePathname();
  const segments = pathname.split("/").filter(Boolean);
  const isAdmin = segments[0] === "admin";
  const trail = isAdmin ? segments.slice(1) : segments;
  if (trail.length === 0) return null; // home / section root — no breadcrumbs

  const label = (seg: string): string => {
    if (isDynamic(seg)) return tx("details");
    const key = LABELS[seg];
    return key ? tx(key) : prettify(seg);
  };

  const base = isAdmin ? "/admin" : "";
  const crumbs = trail.map((seg, i) => ({
    key: seg + i,
    label: label(seg),
    href: `${base}/${trail.slice(0, i + 1).join("/")}`,
    isLast: i === trail.length - 1,
    nonLink: NON_LINK.has(seg),
  }));

  return (
    <nav aria-label="Breadcrumb" className="shrink-0 border-b border-border bg-surface-1/50">
      <ol className={cn("flex flex-wrap items-center gap-1.5 px-4 py-2.5 text-sm md:px-6", contained && "mx-auto max-w-6xl")}>
        <li>
          <Link
            href={isAdmin ? "/admin" : "/"}
            className="flex items-center gap-1 text-text-3 transition-colors hover:text-text-1"
          >
            {isAdmin ? <LayoutDashboard size={13} /> : <Home size={13} />}
            <span>{isAdmin ? tx("admin") : tx("home")}</span>
          </Link>
        </li>
        {crumbs.map((c) => (
          <li key={c.key} className="flex items-center gap-1.5">
            <ChevronRight size={13} className="text-text-3" aria-hidden />
            {c.isLast || c.nonLink ? (
              <span className={c.isLast ? "font-medium text-text-1" : "text-text-3"}>{c.label}</span>
            ) : (
              <Link href={c.href} className="text-text-3 transition-colors hover:text-text-1">
                {c.label}
              </Link>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}
