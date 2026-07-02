"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
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
import { adminLogout } from "@/hooks/use-admin";
import { can, type RBAC } from "@/lib/admin-rbac";
import { cn } from "@/lib/utils";

interface NavItem {
  href: string;
  label: string;
  icon: ComponentType<LucideProps>;
  gate?: keyof typeof RBAC;
}

const NAV: NavItem[] = [
  { href: "/admin", label: "Dashboard", icon: Gauge },
  { href: "/admin/withdrawals", label: "Withdrawals", icon: ArrowUpFromLine, gate: "approveWithdrawal" },
  { href: "/admin/disputes", label: "Disputes", icon: ShieldAlert, gate: "resolveDispute" },
  { href: "/admin/kyc", label: "KYC review", icon: BadgeCheck, gate: "kycReview" },
  { href: "/admin/users", label: "Users", icon: Users },
  { href: "/admin/trades", label: "Trades", icon: Repeat },
  { href: "/admin/treasury", label: "Treasury", icon: Coins },
  { href: "/admin/settings", label: "Settings", icon: Sliders, gate: "editSettings" },
  { href: "/admin/audit", label: "Audit log", icon: ScrollText, gate: "viewAudit" },
  { href: "/admin/profile", label: "My profile", icon: UserCog },
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
  const pathname = usePathname();
  const router = useRouter();
  const qc = useQueryClient();

  const items = NAV.filter((n) => !n.gate || can(role, n.gate));
  const isActive = (href: string) => (href === "/admin" ? pathname === href : pathname.startsWith(href));

  return (
    <div className="flex min-h-screen">
      <aside className="sticky top-0 hidden h-screen w-56 shrink-0 flex-col border-r border-border bg-surface-1 md:flex">
        <div className="flex h-14 items-center gap-2 border-b border-border px-4">
          <BrandMark size={22} />
          <span className="font-display text-sm font-bold">Quata Admin</span>
        </div>
        <nav aria-label="Admin" className="flex-1 space-y-1 overflow-y-auto p-3">
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
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="border-t border-border p-3">
          <Link
            href="/admin/profile"
            className="mb-2 block rounded-lg px-1 py-1 transition-colors hover:bg-surface-2/60"
          >
            <p className="truncate text-xs font-medium text-text-1">{email}</p>
            <Badge tone="accent" className="mt-1">
              {role.replace("_", " ").toLowerCase()}
            </Badge>
          </Link>
          <button
            type="button"
            onClick={() => {
              adminLogout(() => qc.clear());
              router.replace("/admin/login");
            }}
            className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-danger transition-colors hover:bg-surface-2"
          >
            <LogOut size={16} /> Log out
          </button>
        </div>
      </aside>

      <div className="min-w-0 flex-1">
        {/* mobile top bar */}
        <header className="flex h-14 items-center justify-between border-b border-border px-4 md:hidden">
          <span className="flex items-center gap-2">
            <BrandMark size={22} />
            <span className="font-display text-sm font-bold">Quata Admin</span>
          </span>
          <Badge tone="accent">{role.replace("_", " ").toLowerCase()}</Badge>
        </header>
        <main className="px-4 py-6 md:px-8">{children}</main>
      </div>
    </div>
  );
}
