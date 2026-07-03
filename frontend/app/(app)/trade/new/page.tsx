"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
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
  const tx = useTranslations("tradeNew");
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
      if (methods.length === 0) throw new Error(tx("selectPaymentMethod"));
      setBusy(true);
      await api.createOffer(body);
      toast.success(tx("offerPublishedTitle"), tx("offerPublishedBody"));
      router.replace("/trade");
    } catch (err) {
      setError(apiErrorMessage(err, tx("createError")));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-lg space-y-5">
      <PageHeader title={tx("title")} subtitle={tx("subtitle")} backHref="/trade" />

      <Card className="space-y-4">
        <div>
          <p className="mb-1.5 text-sm font-medium">{tx("iWantTo")}</p>
          <Segmented
            value={side}
            onChange={setSide}
            aria-label={tx("offerSideAria")}
            options={[
              { value: "SELL", label: tx("sellUsdt"), tone: "danger" },
              { value: "BUY", label: tx("buyUsdt"), tone: "success" },
            ]}
          />
        </div>

        <Field label={tx("priceLabel")} required>
          {(p) => (
            <Input inputMode="numeric" mono suffix="XAF" placeholder="650" value={price} onChange={(e) => setPrice(e.target.value.replace(/[^\d]/g, ""))} {...p} />
          )}
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label={tx("minTrade")} required>
            {(p) => (
              <Input inputMode="decimal" mono suffix="USDT" placeholder="5" value={minTrade} onChange={(e) => setMinTrade(e.target.value.replace(/[^\d.]/g, ""))} {...p} />
            )}
          </Field>
          <Field label={tx("maxTrade")} required>
            {(p) => (
              <Input inputMode="decimal" mono suffix="USDT" placeholder="200" value={maxTrade} onChange={(e) => setMaxTrade(e.target.value.replace(/[^\d.]/g, ""))} {...p} />
            )}
          </Field>
        </div>

        <Field label={tx("totalLabel")} hint={tx("totalHint")} required>
          {(p) => (
            <Input inputMode="decimal" mono suffix="USDT" placeholder="1000" value={total} onChange={(e) => setTotal(e.target.value.replace(/[^\d.]/g, ""))} {...p} />
          )}
        </Field>

        <div>
          <p className="mb-1.5 text-sm font-medium">{tx("paymentMethods")}</p>
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

        <Field label={tx("termsLabel")}>
          {(p) => (
            <Textarea
              placeholder={tx("termsPlaceholder")}
              value={terms}
              onChange={(e) => setTerms(e.target.value)}
              maxLength={2000}
              {...p}
            />
          )}
        </Field>

        {error && <Alert tone="danger">{error}</Alert>}

        <Button className="w-full" onClick={submit} disabled={busy}>
          {busy ? <Spinner /> : tx("publish")}
        </Button>
      </Card>
    </div>
  );
}
