"use client";

import { useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { CheckCircle2 } from "lucide-react";
import { fromDisplay, zTronAddress, type Withdrawal } from "@quatatrade/shared";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { Usdt } from "@/components/ui/amount";
import { WithdrawalStatusBadge } from "@/components/ui/status-badge";
import { SecurityDialog } from "@/components/security/security-dialog";
import { useToast } from "@/components/ui/toast";
import { useBalances } from "@/hooks/use-wallet";
import { api } from "@/lib/api/client";
import { apiErrorMessage } from "@/lib/api/errors";
import { shortHash } from "@/lib/format";

export default function WithdrawPage(): React.JSX.Element {
  const tx = useTranslations("walletWithdraw");
  const toast = useToast();
  const { data: balances } = useBalances();
  const available = balances?.balances.find((b) => b.asset === "USDT_TRC20")?.available ?? "0";

  const [address, setAddress] = useState("");
  const [amount, setAmount] = useState("");
  const [addrError, setAddrError] = useState<string>();
  const [amountError, setAmountError] = useState<string>();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [dialogError, setDialogError] = useState<string | null>(null);
  const [result, setResult] = useState<Withdrawal | null>(null);

  const validate = (): boolean => {
    let ok = true;
    if (!zTronAddress.safeParse(address).success) {
      setAddrError(tx("addressError"));
      ok = false;
    } else setAddrError(undefined);
    try {
      const units = fromDisplay(amount || "0");
      if (units <= 0n) throw new Error();
      if (units > BigInt(available)) {
        setAmountError(tx("amountExceeds"));
        ok = false;
      } else setAmountError(undefined);
    } catch {
      setAmountError(tx("amountInvalid"));
      ok = false;
    }
    return ok;
  };

  const openConfirm = () => {
    if (validate()) setConfirmOpen(true);
  };

  const submit = async (creds: { pin?: string; totpCode?: string }) => {
    setBusy(true);
    setDialogError(null);
    try {
      const w = await api.requestWithdrawal({
        asset: "USDT_TRC20",
        toAddress: address,
        amount: fromDisplay(amount).toString(),
        pin: creds.pin ?? "",
        totpCode: creds.totpCode ?? "",
        idempotencyKey: crypto.randomUUID(),
      });
      setConfirmOpen(false);
      setResult(w);
      toast.success(tx("toastSuccessTitle"), tx("toastSuccessBody"));
    } catch (err) {
      setDialogError(apiErrorMessage(err, tx("withdrawalFailed")));
    } finally {
      setBusy(false);
    }
  };

  if (result) {
    return (
      <div className="mx-auto max-w-md space-y-5">
        <PageHeader title={tx("resultTitle")} backHref="/wallet" />
        <Card className="space-y-4">
          <div className="flex items-center gap-3">
            <CheckCircle2 className="text-success" size={28} />
            <div>
              <p className="font-medium">{tx("requestSubmitted")}</p>
              <p className="text-sm text-text-2">{tx("toAddress", { address: shortHash(result.toAddress) })}</p>
            </div>
          </div>
          <div className="space-y-2 rounded-lg bg-surface-2 p-3 text-sm">
            <Row label={tx("rowAmount")} value={<Usdt value={result.amount} size="sm" />} />
            <Row label={tx("rowNetworkFee")} value={<Usdt value={result.fee} size="sm" />} />
            <Row
              label={tx("rowTotalDebited")}
              value={<Usdt value={(BigInt(result.amount) + BigInt(result.fee)).toString()} size="sm" />}
            />
            <Row label={tx("rowStatus")} value={<WithdrawalStatusBadge status={result.status} />} />
          </div>
          <Link href="/wallet">
            <Button className="w-full">{tx("backToWallet")}</Button>
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

        <Field label={tx("destinationAddress")} error={addrError} required>
          {(p) => (
            <Input
              placeholder="T..."
              value={address}
              onChange={(e) => setAddress(e.target.value.trim())}
              {...p}
            />
          )}
        </Field>

        <Field label={tx("amountLabel")} error={amountError} required>
          {(p) => (
            <Input
              inputMode="decimal"
              mono
              suffix="USDT"
              placeholder="0.00"
              value={amount}
              onChange={(e) => setAmount(e.target.value.replace(/[^\d.]/g, ""))}
              {...p}
            />
          )}
        </Field>

        <Alert tone="info">{tx("feeNotice")}</Alert>

        <Button className="w-full" onClick={openConfirm} disabled={!address || !amount}>
          {tx("reviewWithdrawal")}
        </Button>
      </Card>

      <SecurityDialog
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        title={tx("confirmTitle")}
        description={tx("confirmDescription", { amount: amount || "0", address: shortHash(address) })}
        actionLabel={tx("confirmAction", { amount: amount || "0" })}
        requirePin
        requireTotp
        busy={busy}
        error={dialogError}
        onConfirm={submit}
      />
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }): React.JSX.Element {
  return (
    <div className="flex items-center justify-between">
      <span className="text-text-2">{label}</span>
      <span className="font-medium text-text-1">{value}</span>
    </div>
  );
}
