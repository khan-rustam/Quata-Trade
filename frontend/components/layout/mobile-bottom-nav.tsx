"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { Home, LineChart, Repeat, User, Wallet } from "lucide-react";
import type { LucideProps } from "lucide-react";
import type { ComponentType } from "react";
import { Keyhole } from "@/components/brand/keyhole";
import { cn } from "@/lib/utils";

/**
 * The primary mobile navigation.
 *
 * Extracted from `AppShell` because it is needed in two shells, not one.
 *
 * `/markets` lives in the `(public)` route group — it is informational, indexed,
 * and deliberately readable by logged-out visitors. But it is also the second
 * item in this bar, so a signed-in user tapping "Markets" left the `(app)`
 * layout and the bar vanished under them. From there the only visible way out
 * was the marketing header, which offered "Log in" — so the app appeared to
 * have signed them out mid-session.
 *
 * Next.js will not let the same path exist in two route groups, so the fix is
 * the nav travelling to the page rather than the page moving into the app.
 */

interface NavItem {
  href: string;
  labelKey: "home" | "markets" | "trade" | "wallet" | "account";
  icon: ComponentType<LucideProps>;
}

export const NAV_ITEMS: NavItem[] = [
  { href: "/home", labelKey: "home", icon: Home },
  { href: "/markets", labelKey: "markets", icon: LineChart },
  { href: "/trade", labelKey: "trade", icon: Repeat },
  { href: "/wallet", labelKey: "wallet", icon: Wallet },
  { href: "/account", labelKey: "account", icon: User },
];

export function isNavActive(href: string, pathname: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function MobileBottomNav(): React.JSX.Element {
  const t = useTranslations("nav");
  const tx = useTranslations("appShell");
  const pathname = usePathname();

  return (
    <nav
      aria-label={tx("primaryNav")}
      className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t border-border bg-bg/95 backdrop-blur md:hidden"
    >
      {NAV_ITEMS.map((item) => {
        const active = isNavActive(item.href, pathname);
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
  );
}
