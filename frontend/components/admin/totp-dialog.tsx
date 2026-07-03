"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { ShieldCheck } from "lucide-react";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input, Textarea } from "@/components/ui/input";
import { OtpInput } from "@/components/ui/otp-input";
import { Alert } from "@/components/ui/alert";
import { Spinner } from "@/components/ui/spinner";

/**
 * Admin step-up: every money/sensitive admin action re-verifies the admin's
 * OWN TOTP (§08 E). Optionally collects a reason/notes field.
 *
 * `requireTotp` follows the acting admin's own 2FA state: while 2FA is optional
 * (test phase) an admin without it enabled confirms with just the reason — the
 * backend skips code verification for that admin. In production 2FA is
 * mandatory, so this is always true.
 */
export function TotpActionDialog({
  open,
  onClose,
  title,
  description,
  actionLabel,
  destructive,
  reasonLabel,
  reasonRequired,
  requireTotp = true,
  busy,
  error,
  onConfirm,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  actionLabel: string;
  destructive?: boolean;
  reasonLabel?: string;
  reasonRequired?: boolean;
  requireTotp?: boolean;
  busy?: boolean;
  error?: string | null;
  onConfirm: (v: { totpCode: string; reason?: string }) => void;
}): React.JSX.Element {
  const tx = useTranslations("totpDialog");
  const [totp, setTotp] = useState("");
  const [reason, setReason] = useState("");
  const reasonOk = !reasonRequired || reason.trim().length >= 5;
  const totpOk = !requireTotp || totp.length >= 6;

  return (
    <Dialog open={open} onClose={onClose} title={title} description={description}>
      <div className="space-y-4">
        {error && <Alert tone="danger">{error}</Alert>}
        {reasonLabel && (
          <Field label={reasonLabel} required={reasonRequired}>
            {(p) =>
              reasonRequired ? (
                <Textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder={tx("reasonPlaceholder")} {...p} />
              ) : (
                <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder={tx("optionalNote")} {...p} />
              )
            }
          </Field>
        )}
        {requireTotp && (
          <div className="space-y-2">
            <label className="flex items-center gap-1.5 text-sm font-medium">
              <ShieldCheck size={14} className="text-accent-400" /> {tx("authenticatorCode")}
            </label>
            <OtpInput value={totp} onChange={setTotp} aria-label={tx("authenticatorCodeAria")} invalid={Boolean(error)} />
          </div>
        )}
        <div className="flex gap-2">
          <Button variant="secondary" className="flex-1" onClick={onClose} disabled={busy}>
            {tx("cancel")}
          </Button>
          <Button
            variant={destructive ? "danger" : "primary"}
            className="flex-1"
            disabled={busy || !totpOk || !reasonOk}
            onClick={() => onConfirm({ totpCode: requireTotp ? totp : "", reason: reasonLabel ? reason.trim() : undefined })}
          >
            {busy ? <Spinner /> : actionLabel}
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
