"use client";

import { useRouter } from "next/navigation";
import { useLocale } from "next-intl";
import { Languages } from "lucide-react";

/** EN ⇄ FR toggle. Persists to qt_locale cookie (SSR request config reads it). */
export function LanguageToggle(): React.JSX.Element {
  const locale = useLocale();
  const router = useRouter();

  const switchTo = (next: "en" | "fr") => {
    document.cookie = `qt_locale=${next};path=/;max-age=31536000;samesite=lax`;
    router.refresh();
  };

  const next = locale === "fr" ? "en" : "fr";
  return (
    <button
      type="button"
      onClick={() => switchTo(next)}
      aria-label={`Switch language to ${next === "fr" ? "French" : "English"}`}
      className="flex h-9 items-center gap-1.5 rounded-lg px-2 text-sm font-medium text-text-2 transition-colors hover:bg-surface-2 hover:text-text-1"
    >
      <Languages size={16} aria-hidden />
      <span className="uppercase">{locale}</span>
    </button>
  );
}
