"use client";

import { useState, useSyncExternalStore } from "react";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { ArrowUpCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { applyUpdate, getWaitingWorker, onUpdateChange } from "@/lib/pwa-update";

/**
 * Money/security flows that must NEVER be interrupted by an update prompt
 * (Documents/12 §13): active trades + escrow, wallet movements, KYC, auth and
 * credential changes, and the admin screens that move funds or resolve disputes.
 * The prompt reappears automatically once the user leaves these routes.
 */
const BUSY_PREFIXES = [
  "/trade/", // trade detail, trade room, new trade (the /trade list is fine)
  "/wallet/deposit",
  "/wallet/withdraw",
  "/wallet/transfer",
  "/account/kyc",
  "/account/security",
  "/login",
  "/register",
  "/verify-email",
  "/reset",
  "/forgot",
  "/admin/withdrawals",
  "/admin/disputes",
  "/admin/kyc",
  "/admin/ledger-adjustment",
];

function isBusyRoute(pathname: string): boolean {
  return BUSY_PREFIXES.some((p) => pathname.startsWith(p));
}

/**
 * "A new version of QuataTrade is available" — shown when a new deploy's service
 * worker is installed and waiting. The app never auto-reloads: the user chooses.
 *
 * - Suppressed entirely during trading/escrow/wallet/KYC/auth flows.
 * - "Later" dismisses THIS version only; a newer deploy prompts again.
 */
export function PwaUpdatePrompt(): React.JSX.Element | null {
  const t = useTranslations("pwaUpdate");
  const pathname = usePathname();
  const waiting = useSyncExternalStore(onUpdateChange, getWaitingWorker, () => null);
  const [dismissed, setDismissed] = useState<ServiceWorker | null>(null);

  if (!waiting || waiting === dismissed) return null;
  if (isBusyRoute(pathname)) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      /* z-40 keeps it BELOW modals (dialogs are z-50) so it can never cover a
         money confirmation / TOTP step-up. */
      className="fixed inset-x-4 bottom-4 z-40 mx-auto max-w-md rounded-card border border-border bg-surface-2 p-4 shadow-lg md:left-auto md:right-6"
    >
      <div className="flex gap-3">
        <ArrowUpCircle size={20} className="mt-0.5 shrink-0 text-accent-400" aria-hidden />
        <div className="min-w-0 flex-1">
          <p className="font-medium text-text-1">{t("title")}</p>
          <p className="mt-1 text-sm text-text-2">{t("body")}</p>
          <div className="mt-3 flex gap-2">
            <Button size="sm" onClick={() => applyUpdate()}>
              {t("updateNow")}
            </Button>
            <Button size="sm" variant="secondary" onClick={() => setDismissed(waiting)}>
              {t("later")}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
