"use client";

import { useTranslations } from "next-intl";

import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { cn } from "@/lib/utils";

/** Copy-to-clipboard button with a brief confirmation state. */
export function CopyButton({
  value,
  label,
  className,
}: {
  value: string;
  label?: string;
  className?: string;
}): React.JSX.Element {
  const t = useTranslations("common");
  // A default parameter cannot call the hook, so the fallback is resolved here.
  const text = label ?? t("copy");
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
      // Compose rather than replace: swapping the accessible name to just
      // "Copied" threw away what the caller said this button copies — on the
      // trade-room payment reference and the wallet receipt, that IS the context.
      aria-label={copied ? `${text} — ${t("copied")}` : text}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-sm text-text-2 transition-colors hover:bg-surface-3 hover:text-text-1",
        className,
      )}
    >
      {copied ? <Check size={14} className="text-success" /> : <Copy size={14} />}
      {/* Focus stays on this button, and several SR/browser pairs do not
          re-announce a changed name — announce the confirmation separately. */}
      <span className="sr-only" role="status" aria-live="polite">
        {copied ? t("copied") : ""}
      </span>
      {copied ? t("copied") : text}
    </button>
  );
}
