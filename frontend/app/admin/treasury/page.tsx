"use client";

import { Coins, TrendingUp } from "lucide-react";
import { useTranslations } from "next-intl";
import { AdminTitle } from "@/components/admin/admin-ui";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Usdt } from "@/components/ui/amount";
import { useAdminRevenue, useAdminTreasury } from "@/hooks/use-admin";

export default function AdminTreasuryPage(): React.JSX.Element {
  const tx = useTranslations("adminTreasury");
  const { data: revenue, isLoading: loadingRev } = useAdminRevenue();
  const { data: balances, isLoading: loadingBal } = useAdminTreasury();

  return (
    <div className="space-y-5">
      <AdminTitle title={tx("title")} subtitle={tx("subtitle")} />

      <div>
        <h2 className="mb-2 flex items-center gap-2 font-display text-lg font-medium">
          <TrendingUp size={18} className="text-accent-400" /> {tx("feeRevenue")}
        </h2>
        <div className="grid grid-cols-3 gap-3">
          <RevTile label={tx("today")} value={revenue?.today} loading={loadingRev} />
          <RevTile label={tx("thisMonth")} value={revenue?.month} loading={loadingRev} />
          <RevTile label={tx("lifetime")} value={revenue?.lifetime} loading={loadingRev} highlight />
        </div>
      </div>

      <div>
        <h2 className="mb-2 flex items-center gap-2 font-display text-lg font-medium">
          <Coins size={18} className="text-accent-400" /> {tx("platformBalances")}
        </h2>
        <Card className="divide-y divide-border">
          <BalRow label={tx("treasuryLabel")} value={balances?.treasury} loading={loadingBal} />
          <BalRow label={tx("pendingSweepLabel")} value={balances?.pendingSweep} loading={loadingBal} />
          <BalRow label={tx("externalLabel")} value={balances?.external} loading={loadingBal} allowNegative />
        </Card>
        <p className="mt-2 text-xs text-text-3">
          {tx("externalNote")}
        </p>
      </div>
    </div>
  );
}

function RevTile({ label, value, loading, highlight }: { label: string; value?: string; loading: boolean; highlight?: boolean }): React.JSX.Element {
  return (
    <Card className={highlight ? "border-accent-400/30" : ""}>
      <p className="text-sm text-text-2">{label}</p>
      {loading ? <Skeleton className="mt-2 h-6 w-24" /> : <div className="mt-1"><Usdt value={value ?? "0"} size="lg" className={highlight ? "text-accent-400" : ""} /></div>}
    </Card>
  );
}

function BalRow({ label, value, loading, allowNegative }: { label: string; value?: string; loading: boolean; allowNegative?: boolean }): React.JSX.Element {
  const negative = allowNegative && value?.startsWith("-");
  return (
    <div className="flex items-center justify-between py-3 first:pt-0 last:pb-0">
      <span className="text-sm text-text-2">{label}</span>
      {loading ? (
        <Skeleton className="h-5 w-24" />
      ) : negative ? (
        <span className="font-money tabular-nums text-danger">
          -<Usdt value={(value ?? "0").replace("-", "")} size="sm" />
        </span>
      ) : (
        <Usdt value={value ?? "0"} size="sm" />
      )}
    </div>
  );
}
