"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { MailWarning, X } from "lucide-react";
import { Button, buttonClassName } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { api } from "@/lib/api/client";
import { apiErrorMessage } from "@/lib/api/errors";
import { useMe } from "@/hooks/use-auth";

/** Same 60s cooldown the standalone verify page uses — one resend rhythm everywhere. */
const RESEND_COOLDOWN_SEC = 60;
const DISMISS_KEY = "qt.verifyEmailBannerDismissed";

/**
 * Persistent "verify your email" notice for signed-in but unverified accounts.
 *
 * The owner's rule is that every sign-up is verified by email; the counter-pressure
 * is that no sign-up should hit friction. So login stays open and this banner —
 * not a hard block — carries the ask, while EmailVerifiedGuard refuses the actions
 * that actually matter (KYC, deposits, trading, transfers).
 *
 * Dismissal is per-tab (sessionStorage), NOT permanent: a user who dismisses it
 * still needs to verify before they can transact, so it must come back rather
 * than leave them wondering why their first deposit is refused.
 */
export function VerifyEmailBanner(): React.JSX.Element | null {
  const tx = useTranslations("verifyEmailBanner");
  const toast = useToast();
  const { data: me } = useMe();
  // Lazy initializer, window-guarded: sessionStorage does not exist during SSR.
  // No hydration mismatch — `me` is undefined on the server and on the first
  // client render, so this component renders null in both.
  const [dismissed, setDismissed] = useState(
    () => typeof window !== "undefined" && sessionStorage.getItem(DISMISS_KEY) === "1",
  );
  const [cooldown, setCooldown] = useState(0);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  if (!me || me.emailVerified || dismissed) return null;

  const dismiss = (): void => {
    sessionStorage.setItem(DISMISS_KEY, "1");
    setDismissed(true);
  };

  const resend = async (): Promise<void> => {
    if (cooldown > 0 || sending) return;
    setSending(true);
    try {
      await api.resendEmailVerification({ email: me.email });
      // Deliberately opaque server response (no address enumeration) — so the
      // confirmation stays non-committal too.
      toast.success(tx("resentTitle"), tx("resentBody"));
      setCooldown(RESEND_COOLDOWN_SEC);
    } catch (err) {
      toast.error(apiErrorMessage(err, tx("resendFailed")));
    } finally {
      setSending(false);
    }
  };

  return (
    <div
      role="note"
      className="mb-4 flex flex-col gap-3 rounded-xl border border-warning/30 bg-warning/10 px-4 py-3 text-sm text-warning sm:flex-row sm:items-center"
    >
      <MailWarning size={18} aria-hidden className="mt-0.5 shrink-0 sm:mt-0" />
      <div className="min-w-0 flex-1 space-y-0.5">
        <p className="font-medium">{tx("title")}</p>
        <p className="text-text-1/90">{tx("body", { email: me.email })}</p>
      </div>
      <div className="flex shrink-0 flex-wrap items-center gap-2">
        <Link
          href={`/verify-email?email=${encodeURIComponent(me.email)}`}
          className={buttonClassName({ variant: "secondary", size: "sm" })}
        >
          {tx("enterCode")}
        </Link>
        <Button variant="ghost" size="sm" onClick={() => void resend()} disabled={sending || cooldown > 0}>
          {cooldown > 0 ? tx("resendIn", { seconds: cooldown }) : tx("resend")}
        </Button>
        {/* 44px touch target (Documents/11 §11.11) even though the glyph is 16px. */}
        <button
          type="button"
          onClick={dismiss}
          aria-label={tx("dismiss")}
          className="inline-flex h-11 w-11 items-center justify-center rounded-btn text-text-2 hover:bg-surface-2"
        >
          <X size={16} aria-hidden />
        </button>
      </div>
    </div>
  );
}
