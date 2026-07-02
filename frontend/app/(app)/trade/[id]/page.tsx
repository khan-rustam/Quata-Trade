"use client";

import { useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { ShieldCheck, Star } from "lucide-react";
import { fromDisplay, type PaymentMethod } from "@quatatrade/shared";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Segmented } from "@/components/ui/segmented";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert } from "@/components/ui/alert";
import { Avatar } from "@/components/ui/avatar";
import { Usdt, Xaf } from "@/components/ui/amount";
import { Spinner } from "@/components/ui/spinner";
import { PaymentMethodChip } from "@/components/trade/payment-method-chip";
import { useToast } from "@/components/ui/toast";
import { useOffer, useOpenTrade } from "@/hooks/use-trade";
import { api } from "@/lib/api/client";
import { apiErrorMessage } from "@/lib/api/errors";
import { formatRate, formatUsdt } from "@/lib/format";

export default function OfferDetailPage(): React.JSX.Element {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const toast = useToast();
  const { data: offer, isLoading } = useOffer(id);
  const openTrade = useOpenTrade();

  const [amount, setAmount] = useState("");
  const [pickedMethod, setPickedMethod] = useState<PaymentMethod | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Default to the offer's first method until the user picks one — derived, no effect.
  const method: PaymentMethod | null = pickedMethod ?? offer?.paymentMethods[0] ?? null;

  const units = useMemo(() => {
    try {
      return amount ? fromDisplay(amount).toString() : null;
    } catch {
      return null;
    }
  }, [amount]);

  const { data: preview, isFetching: previewing } = useQuery({
    queryKey: ["fee-preview", id, units, method],
    queryFn: () =>
      api.feePreview({ amount: units!, paymentMethod: method!, priceXafPerUnit: offer!.priceXafPerUnit }),
    enabled: Boolean(units && method && offer),
  });

  const withinLimits =
    offer && units ? BigInt(units) >= BigInt(offer.minTrade) && BigInt(units) <= BigInt(offer.remaining) : false;

  const submit = async () => {
    if (!offer || !units || !method) return;
    setError(null);
    try {
      const trade = await openTrade.mutateAsync({
        offerId: offer.id,
        amount: units,
        paymentMethod: method,
        idempotencyKey: crypto.randomUUID(),
      });
      toast.success("Trade opened", "Escrow is locked — follow the payment steps.");
      router.replace(`/trade/room/${trade.id}`);
    } catch (err) {
      setError(apiErrorMessage(err, "Could not open the trade"));
    }
  };

  if (isLoading) return <Skeleton className="h-96 w-full rounded-xl" />;
  if (!offer)
    return (
      <Alert tone="danger" title="Offer unavailable">
        This offer no longer exists.
      </Alert>
    );

  return (
    <div className="mx-auto max-w-lg space-y-5">
      <PageHeader title={offer.side === "SELL" ? "Buy USDT" : "Sell USDT"} backHref="/trade" />

      <Card>
        <div className="flex items-center gap-3">
          <Avatar seed={offer.trader.id} name={offer.trader.displayName} size={40} />
          <div>
            <p className="flex items-center gap-1.5 font-medium">
              {offer.trader.displayName}
              {offer.trader.kycTier >= 2 && <ShieldCheck size={14} className="text-accent-400" />}
            </p>
            <p className="flex items-center gap-1 text-xs text-text-3">
              <Star size={11} className="text-warning" /> {offer.trader.reputationScore} ·{" "}
              {offer.trader.completedTrades} trades · {Math.round(offer.trader.completionRate)}%
            </p>
          </div>
          <div className="ml-auto text-right">
            <p className="font-money text-lg font-semibold">{formatRate(offer.priceXafPerUnit)}</p>
            <p className="text-xs text-text-3">per USDT</p>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2 text-sm">
          <Meta label="Limits" value={`${formatUsdt(offer.minTrade, "USDT_TRC20", 0)}–${formatUsdt(offer.maxTrade, "USDT_TRC20", 0)}`} />
          <Meta label="Available" value={`${formatUsdt(offer.remaining, "USDT_TRC20", 0)} USDT`} />
        </div>

        <div className="mt-3 flex flex-wrap gap-1.5">
          {offer.paymentMethods.map((m) => (
            <PaymentMethodChip key={m} method={m} />
          ))}
        </div>

        {offer.terms && (
          <div className="mt-4 rounded-lg bg-surface-2 p-3 text-sm text-text-2">
            <p className="mb-1 font-medium text-text-1">Trader&rsquo;s terms</p>
            {offer.terms}
          </div>
        )}
      </Card>

      <Card className="space-y-4">
        <Field label="Amount to trade" required>
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

        {offer.paymentMethods.length > 1 && method && (
          <div>
            <p className="mb-1.5 text-sm font-medium">Payment method</p>
            <Segmented
              value={method}
              onChange={setPickedMethod}
              aria-label="Payment method"
              options={offer.paymentMethods.map((m) => ({
                value: m,
                label: m === "MTN_MOMO" ? "MTN" : m === "ORANGE_MONEY" ? "Orange" : "QuataPay",
              }))}
            />
          </div>
        )}

        <div className="space-y-2 rounded-lg bg-surface-2 p-3 text-sm">
          <Row label="You pay (fiat)" value={preview ? <Xaf value={preview.fiatAmountXaf} /> : "—"} loading={previewing} />
          <Row label="Trading fee" value={preview ? <Usdt value={preview.feeAmount} size="sm" /> : "—"} loading={previewing} />
          <Row
            label="You receive"
            value={preview ? <Usdt value={preview.buyerCredit} size="sm" className="text-accent-400" /> : "—"}
            loading={previewing}
          />
        </div>

        {units && !withinLimits && (
          <Alert tone="warning">Amount is outside this offer&rsquo;s limits or available balance.</Alert>
        )}
        {error && <Alert tone="danger">{error}</Alert>}

        <Button
          className="w-full"
          disabled={!withinLimits || !method || openTrade.isPending}
          onClick={submit}
        >
          {openTrade.isPending ? <Spinner /> : amount ? `Open trade for ${amount} USDT` : "Open trade"}
        </Button>
        <p className="text-center text-xs text-text-3">
          Opening locks the seller&rsquo;s crypto in escrow until you&rsquo;re confirmed paid.
        </p>
      </Card>
    </div>
  );
}

function Meta({ label, value }: { label: string; value: string }): React.JSX.Element {
  return (
    <div className="rounded-lg bg-surface-2 p-2.5">
      <p className="text-xs text-text-3">{label}</p>
      <p className="font-money text-sm font-medium">{value}</p>
    </div>
  );
}

function Row({ label, value, loading }: { label: string; value: React.ReactNode; loading?: boolean }): React.JSX.Element {
  return (
    <div className="flex items-center justify-between">
      <span className="text-text-2">{label}</span>
      {loading ? <Skeleton className="h-4 w-20" /> : <span className="font-medium text-text-1">{value}</span>}
    </div>
  );
}
