"use client";

import { useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { CheckCircle2, Send } from "lucide-react";
import { fromDisplay, zEmail } from "@quatatrade/shared";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { Usdt } from "@/components/ui/amount";
import { SecurityDialog } from "@/components/security/security-dialog";
import { useToast } from "@/components/ui/toast";
import { useBalances } from "@/hooks/use-wallet";
import { api } from "@/lib/api/client";
import { apiErrorMessage } from "@/lib/api/errors";

export default function TransferPage(): React.JSX.Element {
  const tx = useTranslations("walletTransfer");
  const toast = useToast();
  const { data: balances } = useBalances();
  const available = balances?.balances.find((b) => b.asset === "USDT_TRC20")?.available ?? "0";

  const [email, setEmail] = useState("");
  const [amount, setAmount] = useState("");
  const [emailError, setEmailError] = useState<string>();
  const [amountError, setAmountError] = useState<string>();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [dialogError, setDialogError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const validate = (): boolean => {
    let ok = true;
    if (!zEmail.safeParse(email).success) {
      setEmailError(tx("emailInvalid"));
      ok = false;
    } else setEmailError(undefined);
    try {
      const units = fromDisplay(amount || "0");
      if (units <= 0n || units > BigInt(available)) throw new Error();
      setAmountError(undefined);
    } catch {
      setAmountError(tx("amountInvalid"));
      ok = false;
    }
    return ok;
  };

  const submit = async (creds: { pin?: string }) => {
    setBusy(true);
    setDialogError(null);
    try {
      await api.internalTransfer({
        toEmail: email,
        asset: "USDT_TRC20",
        amount: fromDisplay(amount).toString(),
        pin: creds.pin ?? "",
        idempotencyKey: crypto.randomUUID(),
      });
      setConfirmOpen(false);
      setDone(true);
      toast.success(tx("toastTitle"), tx("toastDetail", { amount }));
    } catch (err) {
      setDialogError(apiErrorMessage(err, tx("transferFailed")));
    } finally {
      setBusy(false);
    }
  };

  if (done) {
    return (
      <div className="mx-auto max-w-md space-y-5">
        <PageHeader title={tx("sentTitle")} backHref="/wallet" />
        <Card className="flex flex-col items-center gap-3 py-8 text-center">
          <CheckCircle2 size={40} className="text-success" />
          <p className="font-medium">
            <Usdt value={fromDisplay(amount).toString()} /> {tx("sentTo", { email })}
          </p>
          <Link href="/wallet">
            <Button>{tx("backToWallet")}</Button>
          </Link>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-md space-y-5">
      <PageHeader title={tx("title")} subtitle={tx("subtitle")} backHref="/wallet" />
      <Card className="space-y-4">
        <div className="flex items-center justify-between rounded-lg bg-surface-2 px-3 py-2 text-sm">
          <span className="text-text-2">{tx("available")}</span>
          <Usdt value={available} size="sm" />
        </div>
        <Field label={tx("recipientEmail")} error={emailError} required>
          {(p) => <Input type="email" placeholder={tx("emailPlaceholder")} value={email} onChange={(e) => setEmail(e.target.value.trim())} {...p} />}
        </Field>
        <Field label={tx("amountLabel")} error={amountError} required>
          {(p) => (
            <Input inputMode="decimal" mono suffix="USDT" placeholder="0.00" value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^\d.]/g, ""))} {...p} />
          )}
        </Field>
        <Alert tone="info">{tx("infoAlert")}</Alert>
        <Button className="w-full" onClick={() => validate() && setConfirmOpen(true)} disabled={!email || !amount}>
          <Send size={16} /> {tx("reviewTransfer")}
        </Button>
      </Card>

      <SecurityDialog
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        title={tx("confirmTransfer")}
        description={tx("dialogDescription", { amount: amount || "0", email })}
        actionLabel={tx("dialogAction", { amount: amount || "0" })}
        requirePin
        busy={busy}
        error={dialogError}
        onConfirm={submit}
      />
    </div>
  );
}
