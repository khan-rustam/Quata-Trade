import Link from "next/link";
import { Logo } from "@/components/brand/logo";

/** Footer structure from Documents/14 §13.C. (* = Phase 2, shown disabled.) */
const COLUMNS: { title: string; links: { label: string; href: string; soon?: boolean }[] }[] = [
  {
    title: "Product",
    links: [
      { label: "How it works", href: "/how-it-works" },
      { label: "Fees", href: "/fees" },
      { label: "Security", href: "/security" },
      { label: "Markets", href: "/markets", soon: true },
    ],
  },
  {
    title: "Support",
    links: [
      { label: "Help Center", href: "/help" },
      { label: "Contact", href: "/contact" },
      { label: "System status", href: "/status" },
      { label: "Complaints", href: "/legal/complaints" },
    ],
  },
  {
    title: "Legal",
    links: [
      { label: "Terms", href: "/legal/terms" },
      { label: "Privacy", href: "/legal/privacy" },
      { label: "AML / KYC", href: "/legal/aml" },
      { label: "Risk disclosure", href: "/legal/risk" },
      { label: "Trade rules", href: "/legal/trade-rules" },
      { label: "Prohibited use", href: "/legal/prohibited-use" },
      { label: "Cookies", href: "/legal/cookies" },
      { label: "Imprint", href: "/legal/imprint" },
    ],
  },
  {
    title: "Company",
    links: [
      { label: "About", href: "/about" },
      { label: "Blog", href: "/blog", soon: true },
      { label: "Careers", href: "/careers", soon: true },
    ],
  },
];

export function PublicFooter(): React.JSX.Element {
  const year = 2026;
  return (
    <footer className="border-t border-border bg-surface-1">
      <div className="mx-auto max-w-6xl px-4 py-10 md:px-6">
        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-5">
          <div className="lg:col-span-1">
            <Logo size={18} />
            <p className="mt-3 max-w-xs text-sm text-text-2">
              Crypto to cash. Protected. A P2P USDT marketplace with escrow, built for Central Africa.
            </p>
          </div>
          {COLUMNS.map((col) => (
            <div key={col.title}>
              <h3 className="text-xs font-semibold uppercase tracking-wide text-text-3">{col.title}</h3>
              <ul className="mt-3 space-y-2">
                {col.links.map((l) => (
                  <li key={l.href}>
                    {l.soon ? (
                      <span className="text-sm text-text-3">
                        {l.label} <span className="text-[10px]">soon</span>
                      </span>
                    ) : (
                      <Link href={l.href} className="text-sm text-text-2 transition-colors hover:text-text-1">
                        {l.label}
                      </Link>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-10 flex flex-col items-start justify-between gap-3 border-t border-border pt-6 text-sm text-text-3 sm:flex-row sm:items-center">
          <p>© {year} QuataTrade. Cameroon.</p>
          <p className="text-xs">Crypto assets are volatile. Trade responsibly.</p>
        </div>
      </div>
    </footer>
  );
}
