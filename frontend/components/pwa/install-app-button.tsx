"use client";

import { useSyncExternalStore } from "react";
import { useTranslations } from "next-intl";
import { Download, Share, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { clearInstallPrompt, getInstallPrompt, onInstallChange } from "@/lib/pwa-install";

/** No-op subscribe for one-shot client reads (UA / display-mode never change mid-session). */
const noSubscribe = (): (() => void) => () => {};

function isStandalone(): boolean {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

/** iOS Safari only — installing from Chrome/Firefox on iOS isn't supported by the OS. */
function isIosSafari(): boolean {
  const ua = window.navigator.userAgent;
  return /iphone|ipad|ipod/i.test(ua) && !/crios|fxios/i.test(ua);
}

/**
 * Renders the right install affordance for the visitor's platform:
 *  - Chrome/Edge (Android + desktop): a real "Install app" button (native prompt).
 *  - iOS Safari: "Add to Home Screen" steps (iOS has no install API).
 *  - Already installed: a confirmation.
 *  - Otherwise: a hint to use the browser menu.
 *
 * Browser/install state is read via useSyncExternalStore (no setState-in-effect):
 * SSR/first paint sees the fallbacks, then it reconciles on the client.
 */
export function InstallAppButton(): React.JSX.Element {
  const t = useTranslations("download");
  const prompt = useSyncExternalStore(onInstallChange, getInstallPrompt, () => null);
  const installed = useSyncExternalStore(onInstallChange, isStandalone, () => false);
  const isIos = useSyncExternalStore(noSubscribe, isIosSafari, () => false);

  if (installed) {
    return (
      <p className="inline-flex items-center gap-2 text-sm font-medium text-success">
        <Check size={16} aria-hidden /> {t("alreadyInstalled")}
      </p>
    );
  }

  if (prompt) {
    return (
      <Button
        size="lg"
        onClick={async () => {
          await prompt.prompt();
          await prompt.userChoice;
          clearInstallPrompt();
        }}
      >
        <Download size={18} aria-hidden /> {t("installButton")}
      </Button>
    );
  }

  if (isIos) {
    return (
      <div className="max-w-sm rounded-card border border-border bg-surface-2 p-4 text-left text-sm">
        <p className="flex items-center gap-2 font-medium text-text-1">
          <Share size={16} className="text-accent-400" aria-hidden /> {t("iosTitle")}
        </p>
        <p className="mt-1.5 text-text-2">{t("iosSteps")}</p>
      </div>
    );
  }

  return <p className="max-w-sm text-sm text-text-2">{t("manualHint")}</p>;
}
