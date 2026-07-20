"use client";

import { useTranslations } from "next-intl";

import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { cn } from "@/lib/utils";

/** Copy-to-clipboard button with a brief confirmation state. */
export function CopyButton({
  value,
  label = "Copy",
  className,
}: {
  value: string;
  label?: string;
  className?: string;
}): React.JSX.Element {
  const t = useTranslations("common");
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard blocked — no-op */
    }
  };
  return (
    <button
      type="button"
      onClick={copy}
      aria-label={copied ? t("copied") : label}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-sm text-text-2 transition-colors hover:bg-surface-3 hover:text-text-1",
        className,
      )}
    >
      {copied ? <Check size={14} className="text-success" /> : <Copy size={14} />}
      {copied ? t("copied") : label}
    </button>
  );
}
