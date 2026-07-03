"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, type ComponentType, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { BadgeCheck, Bell, Home, LineChart, LogOut, Repeat, Settings, ShieldCheck, User, Wallet } from "lucide-react";
import type { LucideProps } from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { Keyhole } from "@/components/brand/keyhole";
import { Avatar } from "@/components/ui/avatar";
import { useToast } from "@/components/ui/toast";
import { ThemeToggle } from "./theme-toggle";
import { LanguageToggle } from "./language-toggle";
import { useLogout, useMe } from "@/hooks/use-auth";
import { cn } from "@/lib/utils";

interface NavItem {
  href: string;
  labelKey: "home" | "markets" | "trade" | "wallet" | "account";
  icon: ComponentType<LucideProps>;
}

const NAV: NavItem[] = [
  { href: "/home", labelKey: "home", icon: Home },
  { href: "/markets", labelKey: "markets", icon: LineChart },
  { href: "/trade", labelKey: "trade", icon: Repeat },
  { href: "/wallet", labelKey: "wallet", icon: Wallet },
  { href: "/account", labelKey: "account", icon: User },
];

const MENU: { href: string; icon: ComponentType<LucideProps>; key: "profile" | "security" | "verification" | "account" }[] = [
  { href: "/account/profile", icon: User, key: "profile" },
  { href: "/account/security", icon: ShieldCheck, key: "security" },
  { href: "/account/kyc", icon: BadgeCheck, key: "verification" },
  { href: "/account", icon: Settings, key: "account" },
];

function isActive(href: string, pathname: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function AppShell({ children }: { children: ReactNode }): React.JSX.Element {
  const t = useTranslations("nav");
  const tx = useTranslations("appShell");
  const pathname = usePathname();
  const router = useRouter();
  const logout = useLogout();
  const { data: me } = useMe();
  const toast = useToast();
  const [menuOpen, setMenuOpen] = useState(false);

  const displayLabel =
    me?.displayName || (me?.firstName ? `${me.firstName} ${me.lastName ?? ""}`.trim() : me?.email) || "";

  const onLogout = (): void => {
    setMenuOpen(false);
    logout.mutate(undefined, {
      onSettled: () => {
        toast.success(t("signedOut"));
        router.replace("/login");
      },
    });
  };

  return (
    <div className="flex min-h-screen flex-col">
      {/* top bar */}
      <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-border bg-bg/80 px-4 backdrop-blur md:px-6">
        <Link href="/home" aria-label={tx("homeAria")} className="flex items-center">
          <Logo size={20} />
        </Link>
        <div className="flex items-center gap-1">
          <LanguageToggle />
          <ThemeToggle />
          <Link
            href="/account/notifications"
            aria-label={tx("notificationsAria")}
            className="flex h-9 w-9 items-center justify-center rounded-lg text-text-2 transition-colors hover:bg-surface-2 hover:text-text-1"
          >
            <Bell size={18} />
          </Link>
          <div className="relative">
            <button
              type="button"
              onClick={() => setMenuOpen((o) => !o)}
              aria-haspopup="menu"
              aria-expanded={menuOpen}
              aria-label={tx("accountMenuAria")}
              className={cn(
                "flex h-9 items-center gap-2 rounded-full py-0.5 pl-0.5 pr-2 transition-colors hover:bg-surface-2",
                menuOpen && "bg-surface-2",
              )}
            >
              {me ? (
                <Avatar seed={me.avatarSeed ?? me.id} style={me.avatarStyle} size={32} className="ring-0" />
              ) : (
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-surface-2 text-text-2">
                  <User size={16} />
                </span>
              )}
              {displayLabel && (
                <span className="hidden max-w-[9rem] truncate text-sm font-medium text-text-1 sm:block">
                  {displayLabel}
                </span>
              )}
            </button>
            {menuOpen && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} aria-hidden />
                <div
                  role="menu"
                  className="qt-animate-dialog absolute right-0 top-12 z-20 w-60 overflow-hidden rounded-xl border border-border bg-surface-1 shadow-lg shadow-black/30"
                >
                  {me && (
                    <div className="flex items-center gap-3 border-b border-border px-3.5 py-3">
                      <Avatar seed={me.avatarSeed ?? me.id} style={me.avatarStyle} size={40} />
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-text-1">{displayLabel}</p>
                        <p className="truncate text-xs text-text-3">{me.email}</p>
                      </div>
                    </div>
                  )}
                  <div className="p-1">
                    {MENU.map((item) => (
                      <Link
                        key={item.href}
                        href={item.href}
                        role="menuitem"
                        onClick={() => setMenuOpen(false)}
                        className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-text-1 transition-colors hover:bg-surface-2"
                      >
                        <item.icon size={16} className="text-text-3" /> {t(item.key)}
                      </Link>
                    ))}
                  </div>
                  <div className="border-t border-border p-1">
                    <button
                      role="menuitem"
                      type="button"
                      onClick={onLogout}
                      className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium text-danger transition-colors hover:bg-danger/10"
                    >
                      <LogOut size={16} /> {t("signOut")}
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </header>

      <div className="mx-auto flex w-full max-w-6xl flex-1">
        {/* desktop sidebar */}
        <nav
          aria-label={tx("primaryNav")}
          className="sticky top-14 hidden h-[calc(100vh-3.5rem)] w-52 shrink-0 border-r border-border px-3 py-4 md:block"
        >
          <ul className="space-y-1">
            {NAV.map((item) => {
              const active = isActive(item.href, pathname);
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                      active ? "bg-surface-2 text-text-1" : "text-text-2 hover:bg-surface-2/60 hover:text-text-1",
                    )}
                  >
                    <item.icon size={18} aria-hidden className={active ? "text-accent-400" : ""} />
                    {t(item.labelKey)}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        {/* content */}
        <main className="min-w-0 flex-1 px-4 py-5 pb-24 md:px-8 md:pb-8">{children}</main>
      </div>

      {/* mobile bottom nav */}
      <nav
        aria-label={tx("primaryNav")}
        className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t border-border bg-bg/95 backdrop-blur md:hidden"
      >
        {NAV.map((item) => {
          const active = isActive(item.href, pathname);
          const Icon = item.href === "/trade" ? Keyhole : item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex min-h-14 flex-col items-center justify-center gap-0.5 text-[11px] font-medium transition-colors",
                active ? "text-accent-400" : "text-text-2",
              )}
            >
              <Icon size={20} aria-hidden />
              {t(item.labelKey)}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
