"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Plus, ShieldCheck, Star } from "lucide-react";
import type { OfferSide, PaymentMethod } from "@quatatrade/shared";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Segmented } from "@/components/ui/segmented";
import { Select } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { Badge } from "@/components/ui/badge";
import { PaymentMethodChip } from "@/components/trade/payment-method-chip";
import { useOffers } from "@/hooks/use-trade";
import { formatRate, formatUsdt } from "@/lib/format";

function TradeBrowser(): React.JSX.Element {
  const params = useSearchParams();
  const initialSide = (params.get("side") as OfferSide) === "SELL" ? "SELL" : "BUY";
  const [side, setSide] = useState<OfferSide>(initialSide);
  const [method, setMethod] = useState<PaymentMethod | "">("");

  // BUY tab shows SELL offers (you buy from sellers) and vice versa.
  const listedSide: OfferSide = side === "BUY" ? "SELL" : "BUY";
  const { data, isLoading } = useOffers({
    side: listedSide,
    method: method || undefined,
    page: 1,
    pageSize: 20,
  });

  return (
    <div className="space-y-5">
      <PageHeader
        title="Trade"
        subtitle="Buy and sell USDT with people you can trust."
        action={
          <Link href="/trade/new">
            <Button size="sm">
              <Plus size={16} /> New offer
            </Button>
          </Link>
        }
      />

      <div className="flex flex-wrap items-center gap-3">
        <Segmented
          value={side}
          onChange={setSide}
          aria-label="Buy or sell"
          options={[
            { value: "BUY", label: "Buy USDT", tone: "success" },
            { value: "SELL", label: "Sell USDT", tone: "danger" },
          ]}
        />
        <div className="w-44">
          <Select
            aria-label="Payment method"
            value={method}
            onChange={(e) => setMethod(e.target.value as PaymentMethod | "")}
            placeholder="All payment methods"
            options={[
              { value: "", label: "All methods" },
              { value: "MTN_MOMO", label: "MTN MoMo" },
              { value: "ORANGE_MONEY", label: "Orange Money" },
              { value: "QUATAPAY", label: "QuataPay" },
            ]}
          />
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24 w-full rounded-xl" />
          ))}
        </div>
      ) : !data || data.items.length === 0 ? (
        <EmptyState
          image="/assets/empty-offers.png"
          title="No offers here yet"
          description={`No ${side === "BUY" ? "sellers" : "buyers"} for this filter — create the first offer.`}
          action={
            <Link href="/trade/new">
              <Button size="sm">Create an offer</Button>
            </Link>
          }
        />
      ) : (
        <div className="space-y-2">
          {data.items.map((offer) => (
            <Link key={offer.id} href={`/trade/${offer.id}`} className="block">
              <Card className="transition-colors hover:border-accent-400/40 hover:bg-surface-2/40">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="flex h-8 w-8 items-center justify-center rounded-full bg-surface-2 text-sm font-semibold text-accent-400">
                        {offer.trader.displayName.slice(0, 1).toUpperCase()}
                      </span>
                      <div className="min-w-0">
                        <p className="flex items-center gap-1.5 truncate font-medium">
                          {offer.trader.displayName}
                          {offer.trader.kycTier >= 2 && (
                            <ShieldCheck size={14} className="text-accent-400" aria-label="Verified" />
                          )}
                        </p>
                        <p className="flex items-center gap-1 text-xs text-text-3">
                          <Star size={11} className="text-warning" /> {offer.trader.reputationScore} ·{" "}
                          {offer.trader.completedTrades} trades · {Math.round(offer.trader.completionRate)}%
                        </p>
                      </div>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {offer.paymentMethods.map((m) => (
                        <PaymentMethodChip key={m} method={m} />
                      ))}
                    </div>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="font-money text-lg font-semibold tabular-nums">{formatRate(offer.priceXafPerUnit)}</p>
                    <p className="text-xs text-text-3">per USDT</p>
                    <Badge tone="neutral" className="mt-2">
                      {formatUsdt(offer.minTrade, "USDT_TRC20", 0)}–{formatUsdt(offer.maxTrade, "USDT_TRC20", 0)} USDT
                    </Badge>
                  </div>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

export default function TradePage(): React.JSX.Element {
  return (
    <Suspense fallback={<Skeleton className="h-64 w-full rounded-xl" />}>
      <TradeBrowser />
    </Suspense>
  );
}
