"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { ArrowDownLeft, ArrowUpRight, Repeat, ShieldCheck, TrendingUp } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar } from "@/components/ui/avatar";
import { Usdt } from "@/components/ui/amount";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert } from "@/components/ui/alert";
import { Keyhole } from "@/components/brand/keyhole";
import { useMe } from "@/hooks/use-auth";
import { useBalances } from "@/hooks/use-wallet";
import { useUserMarket } from "@/hooks/use-user-market";
import { indicativeRate } from "@/lib/market";

const KYC_TONE = {
  APPROVED: "success",
  PENDING: "warning",
  REJECTED: "danger",
  RESUBMIT: "warning",
  NONE: "neutral",
} as const;

export default function HomePage(): React.JSX.Element {
  const t = useTranslations("nav");
  const tx = useTranslations("appHome");
  const { data: me } = useMe();
  const { data: balances, isLoading } = useBalances();
  const market = useUserMarket();
  const rate = indicativeRate(market.currencyCode);

  const usdt = balances?.balances.find((b) => b.asset === "USDT_TRC20");
  const available = usdt?.available ?? "0";
  const escrow = usdt?.inEscrow ?? "0";

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        {me ? (
          <Avatar seed={me.id} name={me.firstName ?? me.email} size={44} />
        ) : (
          <Skeleton className="h-11 w-11 rounded-full" />
        )}
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight">
            {me?.firstName ? tx("greetingNamed", { name: me.firstName }) : tx("greeting")} 👋
          </h1>
          <p className="text-sm text-text-2">{tx("portfolioToday")}</p>
        </div>
      </div>

      {me && me.kycStatus !== "APPROVED" && (
        <Alert tone={me.kycStatus === "REJECTED" ? "danger" : "info"} title={tx("finishVerification")}>
          <div className="flex items-center justify-between gap-3">
            <span>{tx("verifyBody")}</span>
            <Link href="/account/kyc" className="shrink-0 font-medium text-accent-400 hover:underline">
              {tx("verifyNow")}
            </Link>
          </div>
        </Alert>
      )}

      {/* portfolio card */}
      <Card className="relative overflow-hidden">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm text-text-2">{tx("availableBalance")}</p>
            {isLoading ? (
              <Skeleton className="mt-2 h-9 w-40" />
            ) : (
              <div className="mt-1">
                <Usdt value={available} size="xl" />
              </div>
            )}
          </div>
          {me && (
            <Badge tone={KYC_TONE[me.kycStatus]} icon={<ShieldCheck size={12} />}>
              {me.kycStatus === "APPROVED" ? tx("verified") : tx(`kycStatus_${me.kycStatus}`)}
            </Badge>
          )}
        </div>

        <div className="mt-4 flex items-center gap-2 rounded-lg bg-surface-2 px-3 py-2 text-sm">
          <Keyhole size={16} className="text-accent-400" />
          <span className="text-text-2">{tx("inEscrow")}</span>
          <Usdt value={escrow} size="sm" className="ml-auto" />
        </div>

        <div className="mt-4 grid grid-cols-4 gap-2">
          <QuickAction href="/trade?side=BUY" icon={<ArrowDownLeft size={18} />} label={tx("buy")} />
          <QuickAction href="/trade?side=SELL" icon={<ArrowUpRight size={18} />} label={tx("sell")} />
          <QuickAction href="/wallet/deposit" icon={<TrendingUp size={18} />} label={tx("deposit")} />
          <QuickAction href="/wallet/withdraw" icon={<Repeat size={18} />} label={tx("withdraw")} />
        </div>
      </Card>

      {/* reputation + market snapshot */}
      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <p className="text-sm text-text-2">{tx("reputation")}</p>
          <p className="mt-1 text-xl font-semibold">{me?.reputationScore ?? 0}</p>
          <p className="mt-1 text-xs text-text-3">{tx("reputationHint")}</p>
        </Card>
        <Card>
          <p className="text-sm text-text-2">USDT / {market.currencyCode}</p>
          <p className="mt-1 font-money text-xl font-semibold tabular-nums">
            {rate !== null ? `≈ ${rate.toLocaleString()}` : "—"}
          </p>
          <p className="mt-1 text-xs text-text-3">{tx("indicativeRate")}</p>
        </Card>
      </div>

      <div className="flex items-center justify-between">
        <h2 className="font-display text-lg font-medium">{tx("startTrading")}</h2>
        <Link href="/trade" className="text-sm text-accent-400 hover:underline">
          {t("trade")}
        </Link>
      </div>
      <Card className="flex items-center justify-between">
        <div>
          <p className="font-medium">{tx("browseOffers")}</p>
          <p className="text-sm text-text-2">{tx("browseOffersBody")}</p>
        </div>
        <Link href="/trade">
          <Button size="sm">{tx("explore")}</Button>
        </Link>
      </Card>
    </div>
  );
}

function QuickAction({ href, icon, label }: { href: string; icon: React.ReactNode; label: string }): React.JSX.Element {
  return (
    <Link
      href={href}
      className="flex flex-col items-center gap-1.5 rounded-lg bg-surface-2 py-3 text-xs font-medium text-text-1 transition-colors hover:bg-surface-3"
    >
      <span className="text-accent-400">{icon}</span>
      {label}
    </Link>
  );
}
