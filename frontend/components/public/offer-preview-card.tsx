import Link from "next/link";
import { ArrowRight, ShieldCheck, TrendingDown, TrendingUp } from "lucide-react";
import type { Offer } from "@quatatrade/shared";
import { Avatar } from "@/components/ui/avatar";
import { PaymentMethodChip } from "@/components/trade/payment-method-chip";
import { Usdt } from "@/components/ui/amount";
import { formatRate } from "@/lib/format";
import { cn } from "@/lib/utils";

/**
 * Marketplace offer card — the trust triple (completed trades, completion rate,
 * verification) surfaced next to a seeded avatar, per the P2P-escrow UX research.
 * Reused on the landing (illustrative examples) and the marketplace list.
 */
export function OfferPreviewCard({
  offer,
  href = "/register",
  className,
}: {
  offer: Offer;
  href?: string;
  className?: string;
}): React.JSX.Element {
  const buys = offer.side === "BUY";
  const verified = offer.trader.kycTier >= 2;

  return (
    <div
      className={cn(
        "group flex flex-col gap-4 rounded-card border border-border/80 bg-surface-1/40 p-5 transition-all duration-300 hover:border-accent-400/50 hover:bg-surface-2/65 hover:-translate-y-1 hover:shadow-[0_8px_30px_rgba(47,212,167,0.12)] relative overflow-hidden backdrop-blur-md",
        className,
      )}
    >
      {/* Light gradient highlight on hover */}
      <div className="absolute -right-12 -top-12 h-24 w-24 rounded-full bg-accent-400/0 blur-xl group-hover:bg-accent-400/10 transition-all duration-500 pointer-events-none" />
      <div className="relative z-10 flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <span
          className={cn(
            "inline-flex items-center gap-1.5 rounded-chip px-2.5 py-1 text-xs font-semibold",
            buys ? "bg-success/12 text-success" : "bg-danger/12 text-danger",
          )}
        >
          {buys ? <TrendingUp size={13} aria-hidden /> : <TrendingDown size={13} aria-hidden />}
          {buys ? "Buys USDT" : "Sells USDT"}
        </span>
        <span className="font-money text-lg tabular-nums text-text-1">
          {formatRate(offer.priceXafPerUnit)}
          <span className="ml-1 text-xs text-text-3">/ USDT</span>
        </span>
      </div>

      <div className="flex items-center gap-3">
        <Avatar seed={offer.trader.id} name={offer.trader.displayName} size={40} />
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="truncate font-medium text-text-1">{offer.trader.displayName}</span>
            {verified && <ShieldCheck size={14} className="shrink-0 text-accent-400" aria-label="Verified trader" />}
          </div>
          <div className="font-money text-xs tabular-nums text-text-2">
            {offer.trader.completedTrades} trades · {offer.trader.completionRate.toFixed(1)}%
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {offer.paymentMethods.map((m) => (
          <PaymentMethodChip key={m} method={m} />
        ))}
      </div>

      <div className="flex items-center justify-between border-t border-border pt-3 text-xs text-text-2">
        <span className="inline-flex items-center gap-1">
          Limit
          <span className="font-money tabular-nums text-text-1">
            <Usdt value={offer.minTrade} showUnit={false} size="sm" />–<Usdt value={offer.maxTrade} showUnit={false} size="sm" />
          </span>
          USDT
        </span>
        <Link href={href} className="inline-flex items-center gap-1 font-medium text-accent-400 group-hover:gap-1.5">
          Trade <ArrowRight size={13} aria-hidden />
        </Link>
      </div>
      </div>
    </div>
  );
}
