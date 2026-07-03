"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { LifeBuoy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BrandMark } from "@/components/brand/logo";

export default function NotFound(): React.JSX.Element {
  const tx = useTranslations("errorPage");
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 px-6 text-center">
      <BrandMark size={48} />
      <p className="font-display text-6xl font-bold tracking-tight text-accent-400">404</p>
      <div>
        <h1 className="font-display text-2xl font-bold">{tx("notFoundTitle")}</h1>
        <p className="mt-2 max-w-md text-text-2">{tx("notFoundBody")}</p>
      </div>
      <div className="flex flex-wrap items-center justify-center gap-3">
        <Link href="/">
          <Button>{tx("backHome")}</Button>
        </Link>
        <Link href="/help">
          <Button variant="secondary">
            <LifeBuoy size={15} /> {tx("getHelp")}
          </Button>
        </Link>
      </div>
    </main>
  );
}
