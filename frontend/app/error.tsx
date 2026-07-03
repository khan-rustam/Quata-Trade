"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { AlertTriangle, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BrandMark } from "@/components/brand/logo";

/** Route-level error boundary. Renders within the root layout, so i18n + theme apply. */
export default function Error({ reset }: { error: Error & { digest?: string }; reset: () => void }): React.JSX.Element {
  const tx = useTranslations("errorPage");
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 px-6 text-center">
      <BrandMark size={44} />
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-danger/10 text-danger">
        <AlertTriangle size={28} />
      </div>
      <div>
        <h1 className="font-display text-2xl font-bold">{tx("errorTitle")}</h1>
        <p className="mt-2 max-w-md text-text-2">{tx("errorBody")}</p>
      </div>
      <div className="flex flex-wrap items-center justify-center gap-3">
        <Button onClick={reset}>
          <RotateCcw size={15} /> {tx("tryAgain")}
        </Button>
        <Link href="/">
          <Button variant="secondary">{tx("backHome")}</Button>
        </Link>
      </div>
    </main>
  );
}
