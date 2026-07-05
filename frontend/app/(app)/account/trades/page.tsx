"use client";

import { useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { ArrowRight } from "lucide-react";
import type { Trade } from "@quatatrade/shared";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { buttonClassName } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { TradeStatusBadge } from "@/components/ui/status-badge";
import { PaymentMethodChip } from "@/components/trade/payment-method-chip";
import { Pagination } from "@/components/admin/admin-ui";
import { Usdt, Xaf } from "@/components/ui/amount";
import { useTrades } from "@/hooks/use-trade";
import { useMe } from "@/hooks/use-auth";

/**
 * The signed-in user's trade history — active and past trades, most recent first.
 * Previously there was no way to return to a trade room after the one-time redirect
 * on open (GET /trades was built but had no UI). Each row deep-links to /trade/room/:id.
 */
export default function MyTradesPage(): React.JSX.Element {
  const tx = useTranslations("myTrades");
  const { data: me } = useMe();
  const [page, setPage] = useState(1);
  const { data, isLoading } = useTrades({ page, pageSize: 20 });
  const trades = data?.items ?? [];

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <PageHeader title={tx("title")} subtitle={tx("subtitle")} backHref="/account" />

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-32 w-full rounded-xl" />
          ))}
        </div>
      ) : trades.length === 0 ? (
        <EmptyState
          image="/assets/empty-offers.png"
          title={tx("emptyTitle")}
          description={tx("emptyBody")}
          action={
            <Link href="/trade" className={buttonClassName({ size: "sm" })}>
              {tx("browse")}
            </Link>
          }
        />
      ) : (
        <>
          <div className="space-y-3">
            {trades.map((trade) => (
              <TradeRow key={trade.id} trade={trade} meId={me?.id} label={tx} />
            ))}
          </div>
          {data && data.total > data.pageSize && (
            <Pagination page={data.page} pageSize={data.pageSize} total={data.total} onPage={setPage} />
          )}
        </>
      )}
    </div>
  );
}

function TradeRow({
  trade,
  meId,
  label,
}: {
  trade: Trade;
  meId?: string;
  label: (k: string) => string;
}): React.JSX.Element {
  const isBuyer = meId != null && trade.buyer.id === meId;

  return (
    <Card className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Badge tone={isBuyer ? "success" : "danger"}>{label(isBuyer ? "buying" : "selling")}</Badge>
          <TradeStatusBadge status={trade.status} />
        </div>
        <span className="font-money text-xs text-text-3">{trade.shortRef}</span>
      </div>

      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <Usdt value={trade.amount} size="lg" className="font-semibold" />
        <span className="text-sm text-text-2">
          <Xaf value={trade.fiatAmountXaf} />
        </span>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3">
        <PaymentMethodChip method={trade.paymentMethod} />
        <Link
          href={`/trade/room/${trade.id}`}
          className={buttonClassName({ size: "sm", variant: "secondary" })}
        >
          {label("open")} <ArrowRight size={14} />
        </Link>
      </div>
    </Card>
  );
}
