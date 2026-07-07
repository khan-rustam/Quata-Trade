"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useEffect, useState, type ReactNode, type ComponentType } from "react";
import {
  Activity,
  ArrowUpFromLine,
  BadgeCheck,
  BarChart3,
  Coins,
  FileText,
  Gauge,
  Globe,
  Inbox,
  KeyRound,
  LogOut,
  Menu,
  Scale,
  ScrollText,
  ShieldAlert,
  ShieldX,
  Sliders,
  Repeat,
  UserCog,
  Users,
  X,
} from "lucide-react";
import type { LucideProps } from "lucide-react";
import type { AdminRole } from "@quatatrade/shared";
import { BrandMark } from "@/components/brand/logo";
import { Breadcrumbs } from "@/components/layout/breadcrumbs";
import { Badge } from "@/components/ui/badge";
import { Avatar } from "@/components/ui/avatar";
import { adminLogout } from "@/hooks/use-admin";
import { can, type RBAC } from "@/lib/admin-rbac";
import { cn } from "@/lib/utils";

interface NavItem {
  href: string;
  labelKey: string;
  icon: ComponentType<LucideProps>;
  gate?: keyof typeof RBAC;
}

const NAV: NavItem[] = [
  { href: "/admin", labelKey: "navDashboard", icon: Gauge },
  { href: "/admin/system", labelKey: "navSystem", icon: Activity },
  { href: "/admin/reports", labelKey: "navReports", icon: BarChart3 },
  { href: "/admin/withdrawals", labelKey: "navWithdrawals", icon: ArrowUpFromLine, gate: "approveWithdrawal" },
  { href: "/admin/disputes", labelKey: "navDisputes", icon: ShieldAlert, gate: "resolveDispute" },
  { href: "/admin/kyc", labelKey: "navKyc", icon: BadgeCheck, gate: "kycReview" },
  { href: "/admin/screening", labelKey: "navScreening", icon: ShieldX, gate: "kycReview" },
  { href: "/admin/users", labelKey: "navUsers", icon: Users },
  { href: "/admin/trades", labelKey: "navTrades", icon: Repeat },
  { href: "/admin/treasury", labelKey: "navTreasury", icon: Coins },
  { href: "/admin/ledger-adjustment", labelKey: "navLedgerAdjustment", icon: Scale, gate: "ledgerAdjustment" },
  { href: "/admin/wallet-config", labelKey: "navWalletConfig", icon: KeyRound, gate: "manageWalletConfig" },
  { href: "/admin/settings", labelKey: "navSettings", icon: Sliders, gate: "editSettings" },
  { href: "/admin/countries", labelKey: "navCountries", icon: Globe, gate: "manageCountries" },
  { href: "/admin/content", labelKey: "navContent", icon: FileText, gate: "editSettings" },
  { href: "/admin/enquiries", labelKey: "navEnquiries", icon: Inbox, gate: "editSettings" },
  { href: "/admin/audit", labelKey: "navAudit", icon: ScrollText, gate: "viewAudit" },
  { href: "/admin/profile", labelKey: "navProfile", icon: UserCog },
];

export function AdminShell({
  role,
  email,
  children,
}: {
  role: AdminRole;
  email: string;
  children: ReactNode;
}): React.JSX.Element {
  const tx = useTranslations("adminShell");
  const pathname = usePathname();
  const router = useRouter();
  const qc = useQueryClient();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  const items = NAV.filter((n) => !n.gate || can(role, n.gate));
  const isActive = (href: string) => (href === "/admin" ? pathname === href : pathname.startsWith(href));
  const currentItem = items.find((n) => isActive(n.href));
  const current = currentItem ? tx(currentItem.labelKey) : tx("admin");
  const roleLabel = role.replace("_", " ").toLowerCase();

  // Close the mobile drawer on Escape (nav links close it on click themselves).
  useEffect(() => {
    if (!mobileNavOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setMobileNavOpen(false);
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [mobileNavOpen]);

  const navLinks = (onNavigate?: () => void) =>
    items.map((item) => {
      const active = isActive(item.href);
      return (
        <Link
          key={item.href}
          href={item.href}
          aria-current={active ? "page" : undefined}
          onClick={onNavigate}
          className={cn(
            "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
            active ? "bg-surface-2 text-text-1" : "text-text-2 hover:bg-surface-2/60 hover:text-text-1",
          )}
        >
          <item.icon size={17} className={active ? "text-accent-400" : ""} aria-hidden />
          {tx(item.labelKey)}
        </Link>
      );
    });

  return (
    // Fixed to the viewport: the sidebar + header stay put, only <main> scrolls.
    <div className="flex h-screen overflow-hidden">
      <aside className="hidden h-full w-56 shrink-0 flex-col border-r border-border bg-surface-1 md:flex">
        <div className="flex h-14 shrink-0 items-center gap-2 border-b border-border px-4">
          <BrandMark size={22} />
          <span className="font-display text-sm font-bold">Quata Admin</span>
        </div>
        <nav aria-label={tx("navLabel")} className="flex-1 space-y-1 overflow-y-auto p-3">
          {navLinks()}
        </nav>
        <div className="shrink-0 border-t border-border p-3">
          <Link
            href="/admin/profile"
            className="mb-2 flex items-center gap-2.5 rounded-lg px-1.5 py-1.5 transition-colors hover:bg-surface-2/60"
          >
            <Avatar seed={email} size={32} />
            <div className="min-w-0">
              <p className="truncate text-xs font-medium text-text-1">{email}</p>
              <Badge tone="accent" className="mt-0.5">
                {roleLabel}
              </Badge>
            </div>
          </Link>
          <button
            type="button"
            onClick={() => {
              adminLogout(() => qc.clear());
              router.replace("/admin/login");
            }}
            className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-danger transition-colors hover:bg-surface-2"
          >
            <LogOut size={16} /> {tx("logout")}
          </button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* sticky header — stays fixed while the content below scrolls */}
        <header className="flex h-14 shrink-0 items-center justify-between gap-3 border-b border-border bg-surface-1/80 px-4 backdrop-blur md:px-8">
          <span className="flex items-center gap-2 md:hidden">
            <button
              type="button"
              onClick={() => setMobileNavOpen(true)}
              aria-label={tx("openMenu")}
              aria-expanded={mobileNavOpen}
              aria-controls="admin-mobile-nav"
              className="-ml-1 flex h-9 w-9 items-center justify-center rounded-lg text-text-1 hover:bg-surface-2"
            >
              <Menu size={20} />
            </button>
            <BrandMark size={22} />
            <span className="font-display text-sm font-bold">Quata Admin</span>
          </span>
          <h1 className="hidden font-display text-base font-semibold md:block">{current}</h1>
          <Link
            href="/admin/profile"
            aria-label={tx("profileAria")}
            className="flex items-center gap-2.5 rounded-lg px-1.5 py-1 transition-colors hover:bg-surface-2"
          >
            <Badge tone="accent" className="hidden sm:inline-flex">
              {roleLabel}
            </Badge>
            <Avatar seed={email} size={30} />
          </Link>
        </header>
        <Breadcrumbs />
        <main id="main-content" className="flex-1 overflow-y-auto px-4 py-6 md:px-8">
          {children}
        </main>
      </div>

      {/* Mobile nav drawer — the sidebar is hidden below md, so admins on phones
          reach every section through this slide-over. */}
      {mobileNavOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div
            className="absolute inset-0 bg-black/60"
            onClick={() => setMobileNavOpen(false)}
            aria-hidden
          />
          <div
            id="admin-mobile-nav"
            className="absolute left-0 top-0 flex h-full w-64 max-w-[80%] flex-col border-r border-border bg-surface-1"
          >
            <div className="flex h-14 shrink-0 items-center justify-between border-b border-border px-4">
              <span className="flex items-center gap-2">
                <BrandMark size={22} />
                <span className="font-display text-sm font-bold">Quata Admin</span>
              </span>
              <button
                type="button"
                onClick={() => setMobileNavOpen(false)}
                aria-label={tx("closeMenu")}
                className="-mr-1 flex h-9 w-9 items-center justify-center rounded-lg text-text-2 hover:bg-surface-2 hover:text-text-1"
              >
                <X size={20} />
              </button>
            </div>
            <nav aria-label={tx("navLabel")} className="flex-1 space-y-1 overflow-y-auto p-3">
              {navLinks(() => setMobileNavOpen(false))}
            </nav>
          </div>
        </div>
      )}
    </div>
  );
}
