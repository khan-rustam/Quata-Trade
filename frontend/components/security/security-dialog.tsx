"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { ShieldCheck } from "lucide-react";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { OtpInput } from "@/components/ui/otp-input";
import { Alert } from "@/components/ui/alert";
import { Spinner } from "@/components/ui/spinner";

/**
 * Step-up confirmation for money actions (withdraw, transfer, seller confirm).
 * Collects the transaction PIN and, when required, a 2FA code. The button
 * states the exact action (Documents/11: "Release 150.00 USDT").
 */
export function SecurityDialog({
  open,
  onClose,
  title,
  description,
  actionLabel,
  requirePin = true,
  requireTotp = false,
  busy = false,
  error,
  onConfirm,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  actionLabel: string;
  requirePin?: boolean;
  requireTotp?: boolean;
  busy?: boolean;
  error?: string | null;
  onConfirm: (creds: { pin?: string; totpCode?: string }) => void;
}): React.JSX.Element {
  const tx = useTranslations("securityDialog");
  const [pin, setPin] = useState("");
  const [totp, setTotp] = useState("");

  // Every call site keeps this mounted and toggles `open`, so only the inner
  // Dialog unmounts and the credentials survived between confirmations. On
  // withdraw that means: enter PIN + 2FA for 500 USDT to address A, cancel, edit
  // the amount or the address, press Review — and the dialog returns with both
  // still filled and the button ALREADY enabled. One click moves real funds to
  // terms the user never re-authorised. Same on internal transfer and on escrow
  // release in the trade room.
  //
  // Reset during render (React's "adjusting state when a prop changes") so the
  // stale credentials never reach the DOM.
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setPin("");
      setTotp("");
    }
  }

  const pinOk = !requirePin || pin.length === 6;
  const totpOk = !requireTotp || totp.length === 6;

  return (
    <Dialog open={open} onClose={onClose} title={title} description={description}>
      <div className="space-y-4">
        {error && (
          <Alert tone="danger">{error}</Alert>
        )}
        {requireTotp && (
          <div className="space-y-2">
            <label className="flex items-center gap-1.5 text-sm font-medium text-text-1">
              <ShieldCheck size={14} className="text-accent-400" /> {tx("authenticatorCode")}
            </label>
            <OtpInput value={totp} onChange={setTotp} aria-label={tx("authenticatorCode")} invalid={Boolean(error)} />
          </div>
        )}
        {requirePin && (
          <div className="space-y-2">
            <label className="text-sm font-medium text-text-1">{tx("transactionPin")}</label>
            <OtpInput value={pin} onChange={setPin} aria-label={tx("transactionPin")} invalid={Boolean(error)} />
          </div>
        )}
        <div className="flex gap-2 pt-1">
          <Button variant="secondary" className="flex-1" onClick={onClose} disabled={busy}>
            {tx("cancel")}
          </Button>
          <Button
            className="flex-1"
            disabled={busy || !pinOk || !totpOk}
            onClick={() =>
              onConfirm({
                pin: requirePin ? pin : undefined,
                totpCode: requireTotp ? totp : undefined,
              })
            }
          >
            {busy ? <Spinner /> : actionLabel}
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
