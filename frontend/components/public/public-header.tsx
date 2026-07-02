"use client";

import Link from "next/link";
import { useState } from "react";
import { Menu, X } from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { LanguageToggle } from "@/components/layout/language-toggle";

const LINKS = [
  { href: "/how-it-works", label: "How it works" },
  { href: "/fees", label: "Fees" },
  { href: "/security", label: "Security" },
  { href: "/help", label: "Help" },
];

export function PublicHeader(): React.JSX.Element {
  const [open, setOpen] = useState(false);
  return (
    <header className="sticky top-0 z-40 border-b border-border bg-bg/80 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4 md:px-6">
        <Link href="/" aria-label="QuataTrade home">
          <Logo size={20} />
        </Link>

        <nav aria-label="Main" className="hidden items-center gap-1 md:flex">
          {LINKS.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="rounded-lg px-3 py-2 text-sm font-medium text-text-2 transition-colors hover:text-text-1"
            >
              {l.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-1">
          <div className="hidden md:flex">
            <LanguageToggle />
            <ThemeToggle />
          </div>
          <Link href="/login" className="hidden md:block">
            <Button variant="ghost" size="sm">
              Log in
            </Button>
          </Link>
          <Link href="/register" className="hidden md:block">
            <Button size="sm">Get started</Button>
          </Link>
          <button
            type="button"
            className="flex h-9 w-9 items-center justify-center rounded-lg text-text-1 md:hidden"
            aria-label={open ? "Close menu" : "Open menu"}
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
                className="rounded-lg px-3 py-2 text-sm font-medium text-text-1 hover:bg-surface-2"
              >
                {l.label}
              </Link>
            ))}
            <div className="mt-2 flex items-center gap-2">
              <Link href="/login" className="flex-1" onClick={() => setOpen(false)}>
                <Button variant="secondary" className="w-full" size="sm">
                  Log in
                </Button>
              </Link>
              <Link href="/register" className="flex-1" onClick={() => setOpen(false)}>
                <Button className="w-full" size="sm">
                  Get started
                </Button>
              </Link>
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
