"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import type { ReactNode, ComponentType } from "react";
import {
  ArrowUpFromLine,
  BadgeCheck,
  Coins,
  Gauge,
  LogOut,
  ScrollText,
  ShieldAlert,
  Sliders,
  Repeat,
  UserCog,
  Users,
} from "lucide-react";
import type { LucideProps } from "lucide-react";
import type { AdminRole } from "@quatatrade/shared";
import { BrandMark } from "@/components/brand/logo";
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
  { href: "/admin/withdrawals", labelKey: "navWithdrawals", icon: ArrowUpFromLine, gate: "approveWithdrawal" },
  { href: "/admin/disputes", labelKey: "navDisputes", icon: ShieldAlert, gate: "resolveDispute" },
  { href: "/admin/kyc", labelKey: "navKyc", icon: BadgeCheck, gate: "kycReview" },
  { href: "/admin/users", labelKey: "navUsers", icon: Users },
  { href: "/admin/trades", labelKey: "navTrades", icon: Repeat },
  { href: "/admin/treasury", labelKey: "navTreasury", icon: Coins },
  { href: "/admin/settings", labelKey: "navSettings", icon: Sliders, gate: "editSettings" },
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

  const items = NAV.filter((n) => !n.gate || can(role, n.gate));
  const isActive = (href: string) => (href === "/admin" ? pathname === href : pathname.startsWith(href));
  const currentItem = items.find((n) => isActive(n.href));
  const current = currentItem ? tx(currentItem.labelKey) : tx("admin");
  const roleLabel = role.replace("_", " ").toLowerCase();

  return (
    // Fixed to the viewport: the sidebar + header stay put, only <main> scrolls.
    <div className="flex h-screen overflow-hidden">
      <aside className="hidden h-full w-56 shrink-0 flex-col border-r border-border bg-surface-1 md:flex">
        <div className="flex h-14 shrink-0 items-center gap-2 border-b border-border px-4">
          <BrandMark size={22} />
          <span className="font-display text-sm font-bold">Quata Admin</span>
        </div>
        <nav aria-label={tx("navLabel")} className="flex-1 space-y-1 overflow-y-auto p-3">
          {items.map((item) => {
            const active = isActive(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                  active ? "bg-surface-2 text-text-1" : "text-text-2 hover:bg-surface-2/60 hover:text-text-1",
                )}
              >
                <item.icon size={17} className={active ? "text-accent-400" : ""} aria-hidden />
                {tx(item.labelKey)}
              </Link>
            );
          })}
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
        <main className="flex-1 overflow-y-auto px-4 py-6 md:px-8">{children}</main>
      </div>
    </div>
  );
}
