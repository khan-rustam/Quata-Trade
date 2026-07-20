"use client";

import { useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { Pause, Pencil, Play, Plus, Trash2 } from "lucide-react";
import {
  fromDisplay,
  toDisplay,
  type Offer,
  type OfferStatus,
  type PaymentMethod,
  type UpdateOfferRequest,
} from "@quatatrade/shared";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { Button, buttonClassName } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Field } from "@/components/ui/field";
import { Input, Textarea } from "@/components/ui/input";
import { Dialog } from "@/components/ui/dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { Alert } from "@/components/ui/alert";
import { useToast } from "@/components/ui/toast";
import { PaymentMethodChip } from "@/components/trade/payment-method-chip";
import { useUserMarket } from "@/hooks/use-user-market";
import {
  useActivateOffer,
  useDeleteOffer,
  useMyOffers,
  usePauseOffer,
  useUpdateOffer,
} from "@/hooks/use-trade";
import { apiErrorMessage } from "@/lib/api/errors";
import { formatUsdt } from "@/lib/format";
import { Xaf } from "@/components/ui/amount";
import { cn } from "@/lib/utils";

const STATUS_TONE: Record<OfferStatus, "success" | "warning" | "neutral" | "danger"> = {
  ACTIVE: "success",
  PAUSED: "warning",
  EXHAUSTED: "neutral",
  DELETED: "danger",
};

/** toDisplay always returns a fixed-decimals string (with a dot) — trim it for input prefill. */
function usdtInput(raw: string): string {
  const s = toDisplay(raw, "USDT_TRC20", 6);
  return s.includes(".") ? s.replace(/\.?0+$/, "") : s;
}

export default function MyOffersPage(): React.JSX.Element {
  const tx = useTranslations("myOffers");
  const toast = useToast();
  const { data, isLoading } = useMyOffers();
  const [editing, setEditing] = useState<Offer | null>(null);
  const [deleting, setDeleting] = useState<Offer | null>(null);

  const pause = usePauseOffer();
  const activate = useActivateOffer();
  const del = useDeleteOffer();

  const toggleStatus = (offer: Offer) => {
    const mut = offer.status === "ACTIVE" ? pause : activate;
    mut.mutate(offer.id, {
      onError: (err) => toast.error(tx("actionError"), apiErrorMessage(err)),
    });
  };

  const confirmDelete = () => {
    if (!deleting) return;
    del.mutate(deleting.id, {
      onSuccess: () => {
        toast.success(tx("deletedTitle"), tx("deletedBody"));
        setDeleting(null);
      },
      onError: (err) => toast.error(tx("actionError"), apiErrorMessage(err)),
    });
  };

  const offers = data?.items ?? [];

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <PageHeader
        title={tx("title")}
        subtitle={tx("subtitle")}
        backHref="/account"
        action={
          <Link href="/trade/new" className={buttonClassName({ size: "sm" })}>
            <Plus size={16} /> {tx("newOffer")}
          </Link>
        }
      />

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-32 w-full rounded-xl" />
          ))}
        </div>
      ) : offers.length === 0 ? (
        <EmptyState
          image="/assets/empty-offers.png"
          title={tx("emptyTitle")}
          description={tx("emptyBody")}
          action={
            <Link href="/trade/new" className={buttonClassName({ size: "sm" })}>
              {tx("newOffer")}
            </Link>
          }
        />
      ) : (
        <div className="space-y-3">
          {offers.map((offer) => (
            <Card key={offer.id} className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Badge tone={offer.side === "BUY" ? "success" : "danger"}>{tx(`side_${offer.side}`)}</Badge>
                  <Badge tone={STATUS_TONE[offer.status]}>{tx(`status_${offer.status}`)}</Badge>
                </div>
                <div className="text-right">
                  <Xaf value={offer.priceXafPerUnit} className="text-lg font-semibold" />{" "}
                  <span className="text-xs text-text-3">{tx("perUsdt")}</span>
                </div>
              </div>

              <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm text-text-2">
                <span>
                  {tx("limits")}:{" "}
                  <span className="font-money tabular-nums text-text-1">
                    {formatUsdt(offer.minTrade, "USDT_TRC20", 0)}–{formatUsdt(offer.maxTrade, "USDT_TRC20", 0)} USDT
                  </span>
                </span>
                <span>
                  {tx("available")}:{" "}
                  <span className="font-money tabular-nums text-text-1">
                    {formatUsdt(offer.remaining, "USDT_TRC20", 0)} USDT
                  </span>
                </span>
              </div>

              <div className="flex flex-wrap gap-1.5">
                {offer.paymentMethods.map((m) => (
                  <PaymentMethodChip key={m} method={m} />
                ))}
              </div>

              {offer.status !== "EXHAUSTED" && (
                <div className="flex flex-wrap gap-2 border-t border-border pt-3">
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => toggleStatus(offer)}
                    disabled={pause.isPending || activate.isPending}
                  >
                    {offer.status === "ACTIVE" ? (
                      <>
                        <Pause size={14} /> {tx("pause")}
                      </>
                    ) : (
                      <>
                        <Play size={14} /> {tx("activate")}
                      </>
                    )}
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setEditing(offer)}>
                    <Pencil size={14} /> {tx("edit")}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-danger"
                    onClick={() => setDeleting(offer)}
                  >
                    <Trash2 size={14} /> {tx("delete")}
                  </Button>
                </div>
              )}
            </Card>
          ))}
        </div>
      )}

      {editing && <EditOfferDialog offer={editing} onClose={() => setEditing(null)} />}

      <Dialog
        open={Boolean(deleting)}
        onClose={() => setDeleting(null)}
        title={tx("deleteTitle")}
        description={tx("deleteConfirm")}
      >
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setDeleting(null)}>
            {tx("cancel")}
          </Button>
          <Button className="bg-danger hover:bg-danger/90" onClick={confirmDelete} disabled={del.isPending}>
            {del.isPending ? <Spinner /> : tx("delete")}
          </Button>
        </div>
      </Dialog>
    </div>
  );
}

function EditOfferDialog({ offer, onClose }: { offer: Offer; onClose: () => void }): React.JSX.Element {
  const tx = useTranslations("myOffers");
  const toast = useToast();
  const market = useUserMarket();
  const update = useUpdateOffer();
  const [price, setPrice] = useState(offer.priceXafPerUnit);
  const [minTrade, setMinTrade] = useState(usdtInput(offer.minTrade));
  const [maxTrade, setMaxTrade] = useState(usdtInput(offer.maxTrade));
  const [methods, setMethods] = useState<PaymentMethod[]>(offer.paymentMethods);
  const [terms, setTerms] = useState(offer.terms ?? "");
  const [error, setError] = useState<string | null>(null);

  const toggleMethod = (m: PaymentMethod) =>
    setMethods((prev) => (prev.includes(m) ? prev.filter((x) => x !== m) : [...prev, m]));

  const save = () => {
    setError(null);
    try {
      if (methods.length === 0) throw new Error(tx("selectPaymentMethod"));
      const body: UpdateOfferRequest = {
        // The input is already digit-only, so this is a plain integer string.
        // Routing it through Number()/Math.round() was the float hop that was
        // removed from the create path — money never touches a JS number.
        priceXafPerUnit: BigInt(price || "0").toString(),
        minTrade: fromDisplay(minTrade || "0").toString(),
        maxTrade: fromDisplay(maxTrade || "0").toString(),
        paymentMethods: methods,
        terms: terms.trim() || null,
      };
      update.mutate(
        { id: offer.id, body },
        {
          onSuccess: () => {
            toast.success(tx("savedTitle"), tx("savedBody"));
            onClose();
          },
          onError: (err) => setError(apiErrorMessage(err, tx("actionError"))),
        },
      );
    } catch (err) {
      setError(apiErrorMessage(err, tx("actionError")));
    }
  };

  return (
    <Dialog open onClose={onClose} title={tx("editTitle")} description={tx(`side_${offer.side}`)}>
      <div className="space-y-4">
        <Field label={tx("priceLabel")} required>
          {(p) => (
            <Input
              {...p}
              inputMode="numeric"
              mono
              suffix={market.currencyCode}
              value={price}
              onChange={(e) => setPrice(e.target.value.replace(/[^\d]/g, ""))}
            />
          )}
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label={tx("minTrade")} required>
            {(p) => (
              <Input
                {...p}
                inputMode="decimal"
                mono
                suffix="USDT"
                value={minTrade}
                onChange={(e) => setMinTrade(e.target.value.replace(/[^\d.]/g, ""))}
              />
            )}
          </Field>
          <Field label={tx("maxTrade")} required>
            {(p) => (
              <Input
                {...p}
                inputMode="decimal"
                mono
                suffix="USDT"
                value={maxTrade}
                onChange={(e) => setMaxTrade(e.target.value.replace(/[^\d.]/g, ""))}
              />
            )}
          </Field>
        </div>
        <div>
          <p className="mb-1.5 text-sm font-medium">{tx("paymentMethods")}</p>
          <div className="flex flex-wrap gap-2">
            {market.paymentMethods.map((m) => {
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
            <Textarea {...p} value={terms} onChange={(e) => setTerms(e.target.value)} maxLength={2000} rows={3} />
          )}
        </Field>

        {error && <Alert tone="danger">{error}</Alert>}

        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            {tx("cancel")}
          </Button>
          <Button onClick={save} disabled={update.isPending}>
            {update.isPending ? <Spinner /> : tx("save")}
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
