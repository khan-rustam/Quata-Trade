"use client";

import Link from "next/link";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { LayoutGrid, Menu, X } from "lucide-react";
import { useAuthBootstrap, useMe } from "@/hooks/use-auth";
import { Logo } from "@/components/brand/logo";
import { buttonClassName } from "@/components/ui/button";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { LanguageToggle } from "@/components/layout/language-toggle";

const LINKS = [
  { href: "/how-it-works", key: "howItWorks" },
  { href: "/fees", key: "fees" },
  { href: "/security", key: "security" },
  { href: "/help", key: "help" },
] as const;

export function PublicHeader(): React.JSX.Element {
  const t = useTranslations("nav");
  const [open, setOpen] = useState(false);
  // Resolve the session from the httpOnly refresh cookie. The access token
  // lives in memory only, so a signed-in user arriving on a public page has no
  // token yet — without this bootstrap the header would ALWAYS render the
  // logged-out state, which is exactly the bug this fixes.
  const ready = useAuthBootstrap();
  const { data: me } = useMe(ready);
  const signedIn = Boolean(me && me.status === "active");


  return (
    <header className="sticky top-0 z-40 border-b border-border bg-bg/80 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4 md:px-6">
        <Link href="/" aria-label="QuataTrade home" className="inline-flex min-h-11 items-center">
          <Logo size={20} />
        </Link>

        <nav aria-label="Main" className="hidden items-center gap-1 md:flex">
          {LINKS.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="inline-flex min-h-11 items-center rounded-lg px-3 text-sm font-medium text-text-2 transition-colors hover:text-text-1"
            >
              {t(l.key)}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-1">
          <div className="hidden md:flex">
            <LanguageToggle />
            <ThemeToggle />
          </div>
          {signedIn ? (
            // A signed-in visitor on a public page was shown "Log in / Register"
            // with no way back into the app, which reads as having been signed
            // out. Clicking Markets from the bottom nav lands here, so this was
            // the single most alarming thing a live user could hit.
            <Link href="/home" className={buttonClassName({ size: "sm", className: "max-md:hidden gap-1.5" })}>
              <LayoutGrid size={15} /> {t("openApp")}
            </Link>
          ) : (
            <>
              <Link
                href="/login"
                className={buttonClassName({ variant: "ghost", size: "sm", className: "max-md:hidden" })}
              >
                {t("login")}
              </Link>
              <Link href="/register" className={buttonClassName({ size: "sm", className: "max-md:hidden" })}>
                {t("register")}
              </Link>
            </>
          )}
          <button
            type="button"
            className="flex h-11 w-11 items-center justify-center rounded-lg text-text-1 md:hidden"
            aria-label={open ? t("closeMenu") : t("openMenu")}
            aria-expanded={open}
            onClick={() => setOpen((o) => !o)}
          >
            {open ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </div>

      {open && (
        <div className="border-t border-border px-4 py-3 md:hidden">
          <nav aria-label="Mobile" className="flex flex-col gap-1">
            {LINKS.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                onClick={() => setOpen(false)}
                className="inline-flex min-h-11 items-center rounded-lg px-3 text-sm font-medium text-text-1 hover:bg-surface-2"
              >
                {t(l.key)}
              </Link>
            ))}
            <div className="mt-2 flex items-center gap-2">
              {signedIn ? (
                <Link
                  href="/home"
                  onClick={() => setOpen(false)}
                  className={buttonClassName({ size: "sm", className: "flex-1 gap-1.5" })}
                >
                  <LayoutGrid size={15} /> {t("openApp")}
                </Link>
              ) : (
                <>
                  <Link
                    href="/login"
                    onClick={() => setOpen(false)}
                    className={buttonClassName({ variant: "secondary", size: "sm", className: "flex-1" })}
                  >
                    {t("login")}
                  </Link>
                  <Link
                    href="/register"
                    onClick={() => setOpen(false)}
                    className={buttonClassName({ size: "sm", className: "flex-1" })}
                  >
                    {t("register")}
                  </Link>
                </>
              )}
            </div>
            <div className="mt-2 flex">
              <LanguageToggle />
              <ThemeToggle />
            </div>
          </nav>
        </div>
      )}
    </header>
  );
}
