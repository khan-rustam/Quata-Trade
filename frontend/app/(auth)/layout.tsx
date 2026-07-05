import type { ReactNode } from "react";
import Link from "next/link";
import { Logo } from "@/components/brand/logo";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { LanguageToggle } from "@/components/layout/language-toggle";

/** Centered-card auth layout with a calm gradient wash (marketing surface). */
export default function AuthLayout({ children }: { children: ReactNode }): React.JSX.Element {
  return (
    <div className="relative flex min-h-screen flex-col">
      <div
        className="pointer-events-none absolute inset-0 -z-10 opacity-20"
        style={{
          background:
            "radial-gradient(50% 40% at 20% 0%, #0e5f55 0%, transparent 60%), radial-gradient(45% 45% at 90% 10%, #2fd4a7 0%, transparent 55%)",
        }}
      />
      <header className="flex items-center justify-between px-5 py-4">
        <Link href="/" aria-label="QuataTrade home">
          <Logo size={20} />
        </Link>
        <div className="flex items-center gap-1">
          <LanguageToggle />
          <ThemeToggle />
        </div>
      </header>
      <main id="main-content" className="flex flex-1 items-center justify-center px-4 py-8">
        <div className="w-full max-w-sm">{children}</div>
      </main>
    </div>
  );
}
