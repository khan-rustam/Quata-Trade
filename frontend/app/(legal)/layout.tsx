import type { ReactNode } from "react";
import Link from "next/link";
import { Logo } from "@/components/brand/logo";

export default function LegalLayout({ children }: { children: ReactNode }): React.JSX.Element {
  return (
    <div className="min-h-screen">
      <header className="border-b border-border px-5 py-4">
        <Link href="/" aria-label="QuataTrade home">
          <Logo size={20} />
        </Link>
      </header>
      <main className="mx-auto max-w-2xl px-5 py-8">{children}</main>
    </div>
  );
}
