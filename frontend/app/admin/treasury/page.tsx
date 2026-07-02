"use client";

import { Coins, TrendingUp } from "lucide-react";
import { AdminTitle } from "@/components/admin/admin-ui";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Usdt } from "@/components/ui/amount";
import { useAdminRevenue, useAdminTreasury } from "@/hooks/use-admin";

export default function AdminTreasuryPage(): React.JSX.Element {
  const { data: revenue, isLoading: loadingRev } = useAdminRevenue();
  const { data: balances, isLoading: loadingBal } = useAdminTreasury();

  return (
    <div className="space-y-5">
      <AdminTitle title="Treasury" subtitle="Fee revenue and platform balances, straight from the ledger." />

      <div>
        <h2 className="mb-2 flex items-center gap-2 font-display text-lg font-medium">
          <TrendingUp size={18} className="text-accent-400" /> Fee revenue
        </h2>
        <div className="grid grid-cols-3 gap-3">
          <RevTile label="Today" value={revenue?.today} loading={loadingRev} />
          <RevTile label="This month" value={revenue?.month} loading={loadingRev} />
          <RevTile label="Lifetime" value={revenue?.lifetime} loading={loadingRev} highlight />
        </div>
      </div>

      <div>
        <h2 className="mb-2 flex items-center gap-2 font-display text-lg font-medium">
          <Coins size={18} className="text-accent-400" /> Platform balances
        </h2>
        <Card className="divide-y divide-border">
          <BalRow label="Treasury (fees collected)" value={balances?.treasury} loading={loadingBal} />
          <BalRow label="Pending sweep (in-flight withdrawals)" value={balances?.pendingSweep} loading={loadingBal} />
          <BalRow label="External (net on-chain position)" value={balances?.external} loading={loadingBal} allowNegative />
        </Card>
        <p className="mt-2 text-xs text-text-3">
          External is a contra account and may be negative — it mirrors funds that have left to user
          balances vs. arrived on-chain. Reconciliation compares these against the chain nightly.
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
