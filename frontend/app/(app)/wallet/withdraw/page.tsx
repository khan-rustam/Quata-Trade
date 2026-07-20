"use client";

import { useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, Clock, Plus, ShieldCheck, Trash2 } from "lucide-react";
import { fromDisplay, zTronAddress, type Withdrawal, type WithdrawalAddress } from "@quatatrade/shared";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Button, buttonClassName } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { Usdt } from "@/components/ui/amount";
import { WithdrawalStatusBadge } from "@/components/ui/status-badge";
import { SecurityDialog } from "@/components/security/security-dialog";
import { useToast } from "@/components/ui/toast";
import { useMe } from "@/hooks/use-auth";
import { useDebounced } from "@/hooks/use-debounced";
import { useBalances, useWithdrawalAddresses, withdrawalAddressesKey } from "@/hooks/use-wallet";
import { api } from "@/lib/api/client";
import { qk } from "@/lib/api/query-keys";
import { apiErrorMessage } from "@/lib/api/errors";
import { shortHash, formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";

const ASSET = "USDT_TRC20";

// Ticking clock via an external store so render stays pure (no Date.now() in the
// component body) and there's no setState-in-effect. Re-renders every 30s so an
// address in cooldown flips to usable on its own.
function subscribeClock(onChange: () => void): () => void {
  const id = setInterval(onChange, 30_000);
  return () => clearInterval(id);
}
const getNow = (): number => Date.now();
const getServerNow = (): number => 0;

export default function WithdrawPage(): React.JSX.Element {
  const tx = useTranslations("walletWithdraw");
  const toast = useToast();
  const qc = useQueryClient();
  const { data: balances } = useBalances();
  const { data: me } = useMe();
  const { data: addrData, isLoading: addrLoading } = useWithdrawalAddresses();
  const available = balances?.balances.find((b) => b.asset === ASSET)?.available ?? "0";

  const addresses = (addrData?.addresses ?? []).filter((a) => a.asset === ASSET);

  // The server refuses a withdrawal unless the email is verified, KYC is at least
  // tier 1 and 2FA is on (withdrawals.service). None of that was said anywhere on
  // this screen, so the user picked an address, typed an amount, passed the
  // confirm dialog and only then hit a rejection — with no link to whatever they
  // were missing. Same three checks, stated up front.
  const blockers = me
    ? [
        !me.emailVerified && { key: "blockerEmail", href: "/account" },
        me.kycTier < 1 && { key: "blockerKyc", href: "/account/kyc" },
        !me.pinSet && { key: "blockerPin", href: "/account/security" },
        !me.totpEnabled && { key: "blockerTotp", href: "/account/security" },
      ].filter((b): b is { key: string; href: string } => Boolean(b))
    : [];

  const now = useSyncExternalStore(subscribeClock, getNow, getServerNow);
  const isUsable = (a: WithdrawalAddress): boolean => a.active && new Date(a.usableAt).getTime() <= now;

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [amount, setAmount] = useState("");
  const [amountError, setAmountError] = useState<string>();
  // Quote the real cost as the user types, so the fee is disclosed before they
  // commit and the amount check can use the actual debit (amount + fee).
  const amountUnits = (() => {
    try {
      return fromDisplay(amount || "0");
    } catch {
      return 0n;
    }
  })();
  // Debounced so typing "1000.50" fires one request, not one per keystroke.
  const debouncedUnits = useDebounced(amountUnits.toString(), 300);
  const {
    data: quote,
    isFetching: quoting,
    isError: quoteFailed,
    refetch: refetchQuote,
  } = useQuery({
    queryKey: ["withdrawal-quote", debouncedUnits],
    queryFn: () => api.withdrawalQuote("USDT_TRC20", debouncedUnits),
    enabled: BigInt(debouncedUnits) > 0n,
    // Keep the last quote on screen while the next loads, so the fee panel does
    // not flicker away mid-typing and leave the user with no figure.
    placeholderData: (prev) => prev,
  });
  // The quote is what makes the amount check correct (the ledger debits
  // amount + fee). Falling back to comparing the amount alone reinstates the
  // exact bug this fixes, so an unsettled or failed quote must BLOCK, not
  // silently pass: without this you can paste your full balance, click Review
  // inside the request RTT, pass PIN + TOTP and still get 422 from the server.
  const quoteReady = quote !== undefined && quote.amount === amountUnits.toString();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [dialogError, setDialogError] = useState<string | null>(null);
  const [result, setResult] = useState<Withdrawal | null>(null);

  // add-address form
  const [showAdd, setShowAdd] = useState(false);
  const [newAddr, setNewAddr] = useState("");
  const [newLabel, setNewLabel] = useState("");
  const [addBusy, setAddBusy] = useState(false);
  const [addError, setAddError] = useState<string>();

  const selected = addresses.find((a) => a.id === selectedId) ?? null;
  const invalidateAddresses = () => qc.invalidateQueries({ queryKey: withdrawalAddressesKey });

  const addAddress = async () => {
    if (!zTronAddress.safeParse(newAddr).success) {
      setAddError(tx("addressError"));
      return;
    }
    setAddBusy(true);
    setAddError(undefined);
    try {
      await api.addWithdrawalAddress({ asset: ASSET, address: newAddr, label: newLabel.trim() || undefined });
      toast.success(tx("addressAddedTitle"), tx("addressAddedBody"));
      setNewAddr("");
      setNewLabel("");
      setShowAdd(false);
      invalidateAddresses();
    } catch (err) {
      setAddError(apiErrorMessage(err, tx("addressAddFailed")));
    } finally {
      setAddBusy(false);
    }
  };

  const removeAddress = async (id: string) => {
    try {
      await api.removeWithdrawalAddress(id);
      if (selectedId === id) setSelectedId(null);
      invalidateAddresses();
    } catch (err) {
      toast.error(tx("addressRemoveFailed"), apiErrorMessage(err));
    }
  };

  const validateAmount = (): boolean => {
    try {
      const units = fromDisplay(amount || "0");
      if (units <= 0n) throw new Error();
      // The ledger debits amount + fee. Checking the amount alone let someone
      // enter their whole balance, pass this check, and be told "insufficient
      // balance" by the server after confirming.
      if (quoteFailed) {
        setAmountError(tx("quoteUnavailable"));
        return false;
      }
      if (!quoteReady) {
        setAmountError(tx("quoteLoading"));
        return false;
      }
      if (BigInt(quote.total) > BigInt(available)) {
        setAmountError(tx("amountExceedsWithFee"));
        return false;
      }
      setAmountError(undefined);
      return true;
    } catch {
      setAmountError(tx("amountInvalid"));
      return false;
    }
  };

  const openConfirm = () => {
    if (selected && isUsable(selected) && validateAmount()) setConfirmOpen(true);
  };

  const submit = async (creds: { pin?: string; totpCode?: string }) => {
    if (!selected) return;
    setBusy(true);
    setDialogError(null);
    try {
      const w = await api.requestWithdrawal({
        asset: ASSET,
        toAddress: selected.address,
        amount: fromDisplay(amount).toString(),
        pin: creds.pin ?? "",
        totpCode: creds.totpCode ?? "",
        idempotencyKey: crypto.randomUUID(),
      });
      setConfirmOpen(false);
      setResult(w);
      // A withdrawal locks funds → the cached balance and the withdrawals list are stale.
      void qc.invalidateQueries({ queryKey: qk.balances });
      void qc.invalidateQueries({ queryKey: ["withdrawals"] });
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
            <Row label={tx("rowPlatformFee")} value={<Usdt value={result.fee} size="sm" />} />
            {result.networkFeeEstimate !== "0" && (
              <Row label={tx("rowNetworkFeeEstimate")} value={<Usdt value={result.networkFeeEstimate} size="sm" />} />
            )}
            <Row
              label={tx("rowTotalDebited")}
              value={<Usdt value={(BigInt(result.amount) + BigInt(result.fee)).toString()} size="sm" />}
            />
            <Row label={tx("rowStatus")} value={<WithdrawalStatusBadge status={result.status} />} />
          </div>
          <Link href="/wallet" className={buttonClassName({ className: "w-full" })}>
            {tx("backToWallet")}
          </Link>
        </Card>
      </div>
    );
  }

  const showAddForm = showAdd || addresses.length === 0;

  return (
    <div className="mx-auto max-w-md space-y-5">
      <PageHeader title={tx("title")} subtitle={tx("subtitle")} backHref="/wallet" />

      {blockers.length > 0 && (
        <Alert tone="warning" title={tx("blockersTitle")}>
          <ul className="mt-1 space-y-1">
            {blockers.map((b) => (
              <li key={b.key}>
                <Link href={b.href} className="text-accent-400 underline underline-offset-2">
                  {tx(b.key)}
                </Link>
              </li>
            ))}
          </ul>
        </Alert>
      )}

      <Card className="space-y-4">
        <div className="flex items-center justify-between rounded-lg bg-surface-2 px-3 py-2 text-sm">
          <span className="text-text-2">{tx("available")}</span>
          <Usdt value={available} size="sm" />
        </div>

        {/* whitelisted address picker */}
        <div className="space-y-2">
          <p className="text-sm font-medium">{tx("savedAddresses")}</p>

          {addrLoading ? (
            <Skeleton className="h-16 w-full rounded-lg" />
          ) : addresses.length === 0 ? (
            <p className="rounded-lg border border-dashed border-border px-3 py-2 text-sm font-medium text-text-1">
              {tx("noAddressesTitle")}
            </p>
          ) : (
            <div role="radiogroup" aria-label={tx("selectUsableAddress")} className="space-y-2">
              {addresses.map((a) => {
                const usable = isUsable(a);
                const active = selectedId === a.id;
                return (
                  <div
                    key={a.id}
                    className={cn(
                      "flex items-center gap-2 rounded-lg border p-3 transition-colors",
                      active ? "border-accent-400 bg-surface-2" : "border-border",
                      usable ? "" : "opacity-70",
                    )}
                  >
                    <button
                      type="button"
                      role="radio"
                      aria-checked={active}
                      disabled={!usable}
                      onClick={() => usable && setSelectedId(a.id)}
                      className="flex min-w-0 flex-1 items-center gap-2.5 text-left disabled:cursor-not-allowed"
                    >
                      <span
                        className={cn(
                          "flex h-4 w-4 shrink-0 items-center justify-center rounded-full border",
                          active ? "border-accent-400" : "border-border",
                        )}
                      >
                        {active && <span className="h-2 w-2 rounded-full bg-accent-400" />}
                      </span>
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-medium">{a.label || shortHash(a.address, 8, 6)}</span>
                        <span className="block truncate font-money text-xs text-text-3">{shortHash(a.address, 10, 8)}</span>
                      </span>
                    </button>
                    {!a.active ? (
                      <Badge tone="neutral">{tx("inactiveBadge")}</Badge>
                    ) : usable ? (
                      <Badge tone="success" icon={<ShieldCheck size={11} />}>
                        {tx("usableBadge")}
                      </Badge>
                    ) : (
                      <Badge tone="warning" icon={<Clock size={11} />}>
                        {tx("cooldownBadge", { time: formatDateTime(a.usableAt) })}
                      </Badge>
                    )}
                    <button
                      type="button"
                      aria-label={tx("removeAddress")}
                      onClick={() => void removeAddress(a.id)}
                      className="shrink-0 text-text-3 transition-colors hover:text-danger"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          {showAddForm ? (
            <div className="space-y-2 rounded-lg border border-border p-3">
              <p className="text-sm font-medium">{tx("addNewAddress")}</p>
              {/* A placeholder is not a label: it disappears on focus and screen
                  readers announce the field as unnamed. These two take a TRON
                  address that funds are sent to — worth naming properly. */}
              <Input
                aria-label={tx("newAddressAria")}
                placeholder={tx("newAddressPlaceholder")}
                value={newAddr}
                onChange={(e) => setNewAddr(e.target.value.trim())}
              />
              <Input
                aria-label={tx("labelAria")}
                placeholder={tx("labelPlaceholder")}
                value={newLabel}
                onChange={(e) => setNewLabel(e.target.value)}
                maxLength={60}
              />
              {addError && (
                <p role="alert" className="text-sm text-danger">
                  {addError}
                </p>
              )}
              <p className="text-xs text-text-3">{tx("noAddressesBody")}</p>
              <div className="flex gap-2">
                {addresses.length > 0 && (
                  <Button size="sm" variant="secondary" onClick={() => setShowAdd(false)} disabled={addBusy}>
                    {tx("cancel")}
                  </Button>
                )}
                <Button size="sm" onClick={() => void addAddress()} disabled={addBusy || !newAddr}>
                  {addBusy ? <Spinner /> : tx("addAddressButton")}
                </Button>
              </div>
            </div>
          ) : (
            <Button size="sm" variant="secondary" onClick={() => setShowAdd(true)}>
              <Plus size={15} /> {tx("addNewAddress")}
            </Button>
          )}
        </div>

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

        {/* The fee used to appear only in the receipt, i.e. after the money had
            already moved. It has to be visible before the user commits. */}
        {quoteReady && quote && (
          <dl className="rounded-lg border border-border bg-surface-2 p-3 text-sm">
            <div className="flex justify-between gap-3">
              <dt className="text-text-3">{tx("rowPlatformFee")}</dt>
              <dd>
                <Usdt value={quote.fee} size="sm" />
              </dd>
            </div>
            {quote.networkFeeEstimate !== "0" && (
              <div className="mt-1.5 flex justify-between gap-3">
                <dt className="text-text-3">{tx("rowNetworkFeeEstimate")}</dt>
                <dd>
                  <Usdt value={quote.networkFeeEstimate} size="sm" />
                </dd>
              </div>
            )}
            <div className="mt-1.5 flex justify-between gap-3 border-t border-border pt-1.5 font-medium">
              <dt>{tx("rowTotalDebit")}</dt>
              <dd>
                <Usdt value={quote.total} size="sm" />
              </dd>
            </div>
          </dl>
        )}

        {/* validateAmount() cannot run while the button is disabled, so a failed
            or pending quote would otherwise be a silent dead-end: greyed button,
            no message, no retry. Say what is happening. */}
        {amountUnits > 0n && quoteFailed && (
          <Alert tone="danger" title={tx("quoteUnavailable")}>
            <button type="button" onClick={() => void refetchQuote()} className="underline underline-offset-2">
              {tx("quoteRetry")}
            </button>
          </Alert>
        )}
        {amountUnits > 0n && !quoteFailed && !quoteReady && (
          <p className="text-xs text-text-3">{tx("quoteLoading")}</p>
        )}

        <Alert tone="info">{tx("feeNotice")}</Alert>

        <Button
          className="w-full"
          onClick={openConfirm}
          disabled={
            !selected || !isUsable(selected) || !amount || blockers.length > 0 || !quoteReady || quoting
          }
        >
          {tx("reviewWithdrawal")}
        </Button>
      </Card>

      <SecurityDialog
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        title={tx("confirmTitle")}
        description={tx("confirmDescription", { amount: amount || "0", address: selected ? shortHash(selected.address) : "" })}
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
