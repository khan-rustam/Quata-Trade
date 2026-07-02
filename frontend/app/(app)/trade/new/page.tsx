"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { fromDisplay, PAYMENT_METHODS, type CreateOfferRequest, type OfferSide, type PaymentMethod } from "@quatatrade/shared";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { Input, Textarea } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Segmented } from "@/components/ui/segmented";
import { Alert } from "@/components/ui/alert";
import { Spinner } from "@/components/ui/spinner";
import { PaymentMethodChip } from "@/components/trade/payment-method-chip";
import { useToast } from "@/components/ui/toast";
import { api } from "@/lib/api/client";
import { apiErrorMessage } from "@/lib/api/errors";
import { cn } from "@/lib/utils";

export default function NewOfferPage(): React.JSX.Element {
  const router = useRouter();
  const toast = useToast();
  const [side, setSide] = useState<OfferSide>("SELL");
  const [price, setPrice] = useState("");
  const [minTrade, setMinTrade] = useState("");
  const [maxTrade, setMaxTrade] = useState("");
  const [total, setTotal] = useState("");
  const [methods, setMethods] = useState<PaymentMethod[]>(["MTN_MOMO"]);
  const [terms, setTerms] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const toggleMethod = (m: PaymentMethod) =>
    setMethods((prev) => (prev.includes(m) ? prev.filter((x) => x !== m) : [...prev, m]));

  const submit = async () => {
    setError(null);
    try {
      const body: CreateOfferRequest = {
        side,
        asset: "USDT_TRC20",
        priceXafPerUnit: BigInt(Math.round(Number(price || "0"))).toString(),
        minTrade: fromDisplay(minTrade || "0").toString(),
        maxTrade: fromDisplay(maxTrade || "0").toString(),
        totalAmount: fromDisplay(total || "0").toString(),
        paymentMethods: methods,
        terms: terms.trim() || undefined,
      };
      if (methods.length === 0) throw new Error("Select at least one payment method");
      setBusy(true);
      await api.createOffer(body);
      toast.success("Offer published", "Traders can now find your offer.");
      router.replace("/trade");
    } catch (err) {
      setError(apiErrorMessage(err, "Could not create the offer"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-lg space-y-5">
      <PageHeader title="Create an offer" subtitle="Set your rate, limits, and payment methods." backHref="/trade" />

      <Card className="space-y-4">
        <div>
          <p className="mb-1.5 text-sm font-medium">I want to</p>
          <Segmented
            value={side}
            onChange={setSide}
            aria-label="Offer side"
            options={[
              { value: "SELL", label: "Sell USDT", tone: "danger" },
              { value: "BUY", label: "Buy USDT", tone: "success" },
            ]}
          />
        </div>

        <Field label="Price (XAF per USDT)" required>
          {(p) => (
            <Input inputMode="numeric" mono suffix="XAF" placeholder="650" value={price} onChange={(e) => setPrice(e.target.value.replace(/[^\d]/g, ""))} {...p} />
          )}
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Min trade" required>
            {(p) => (
              <Input inputMode="decimal" mono suffix="USDT" placeholder="5" value={minTrade} onChange={(e) => setMinTrade(e.target.value.replace(/[^\d.]/g, ""))} {...p} />
            )}
          </Field>
          <Field label="Max trade" required>
            {(p) => (
              <Input inputMode="decimal" mono suffix="USDT" placeholder="200" value={maxTrade} onChange={(e) => setMaxTrade(e.target.value.replace(/[^\d.]/g, ""))} {...p} />
            )}
          </Field>
        </div>

        <Field label="Total amount to offer" hint="Must be backed by your available balance for SELL offers." required>
          {(p) => (
            <Input inputMode="decimal" mono suffix="USDT" placeholder="1000" value={total} onChange={(e) => setTotal(e.target.value.replace(/[^\d.]/g, ""))} {...p} />
          )}
        </Field>

        <div>
          <p className="mb-1.5 text-sm font-medium">Payment methods</p>
          <div className="flex flex-wrap gap-2">
            {PAYMENT_METHODS.map((m) => {
              const active = methods.includes(m);
              return (
                <button
                  key={m}
                  type="button"
                  onClick={() => toggleMethod(m)}
                  aria-pressed={active}
                  className={cn(
                    "rounded-full border p-0.5 transition-colors",
                    active ? "border-accent-400" : "border-transparent opacity-70 hover:opacity-100",
                  )}
                >
                  <PaymentMethodChip method={m} />
                </button>
              );
            })}
          </div>
        </div>

        <Field label="Terms (optional)">
          {(p) => (
            <Textarea
              placeholder="e.g. Pay within 15 minutes. Use your real name as reference."
              value={terms}
              onChange={(e) => setTerms(e.target.value)}
              maxLength={2000}
              {...p}
            />
          )}
        </Field>

        {error && <Alert tone="danger">{error}</Alert>}

        <Button className="w-full" onClick={submit} disabled={busy}>
          {busy ? <Spinner /> : "Publish offer"}
        </Button>
      </Card>
    </div>
  );
}
