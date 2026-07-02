"use client";

import Link from "next/link";
import { AlertTriangle, ArrowUpFromLine, BadgeCheck, Coins, ShieldAlert, TrendingUp, Users } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Usdt } from "@/components/ui/amount";
import { useAdminKpis } from "@/hooks/use-admin";

export default function AdminDashboard(): React.JSX.Element {
  const { data, isLoading } = useAdminKpis();

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-display text-2xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-sm text-text-2">Platform health at a glance.</p>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label="Total users" value={data?.totalUsers} loading={isLoading} icon={<Users size={16} />} />
        <Kpi label="Active trades" value={data?.activeTrades} loading={isLoading} icon={<TrendingUp size={16} />} />
        <Kpi label="Trades (24h)" value={data?.tradesLast24h} loading={isLoading} />
        <Kpi
          label="Volume (24h)"
          value={data ? <Usdt value={data.volumeLast24h} size="md" /> : undefined}
          loading={isLoading}
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <Card className="flex items-center justify-between">
          <div>
            <p className="flex items-center gap-1.5 text-sm text-text-2">
              <Coins size={14} className="text-accent-400" /> Escrow locked
            </p>
            {isLoading ? <Skeleton className="mt-1 h-6 w-28" /> : <div className="mt-1"><Usdt value={data?.escrowLockedTotal ?? "0"} size="lg" /></div>}
          </div>
          <div className="text-right">
            <p className="text-sm text-text-2">Treasury</p>
            {isLoading ? <Skeleton className="mt-1 h-6 w-24" /> : <div className="mt-1"><Usdt value={data?.treasuryBalance ?? "0"} size="lg" /></div>}
          </div>
        </Card>

        <div className="grid grid-cols-3 gap-3">
          <ActionTile href="/admin/withdrawals" label="Pending" value={data?.pendingWithdrawals} loading={isLoading} icon={<ArrowUpFromLine size={16} />} tone="warning" />
          <ActionTile href="/admin/disputes" label="Disputes" value={data?.openDisputes} loading={isLoading} icon={<ShieldAlert size={16} />} tone="danger" />
          <ActionTile href="/admin/kyc" label="KYC queue" value={data?.pendingKyc} loading={isLoading} icon={<BadgeCheck size={16} />} tone="info" />
        </div>
      </div>

      {data && data.riskFlagsLast24h > 0 && (
        <Card className="flex items-center gap-3 border-warning/30 bg-warning/5">
          <AlertTriangle size={18} className="text-warning" />
          <p className="text-sm">
            <span className="font-semibold text-warning">{data.riskFlagsLast24h}</span> risk flags in the last 24h.
          </p>
        </Card>
      )}
    </div>
  );
}

function Kpi({
  label,
  value,
  loading,
  icon,
}: {
  label: string;
  value: React.ReactNode;
  loading: boolean;
  icon?: React.ReactNode;
}): React.JSX.Element {
  return (
    <Card>
      <div className="flex items-center justify-between">
        <p className="text-sm text-text-2">{label}</p>
        {icon && <span className="text-text-3">{icon}</span>}
      </div>
      {loading ? <Skeleton className="mt-2 h-7 w-16" /> : <p className="mt-1 text-2xl font-semibold">{value ?? "—"}</p>}
    </Card>
  );
}

function ActionTile({
  href,
  label,
  value,
  loading,
  icon,
  tone,
}: {
  href: string;
  label: string;
  value?: number;
  loading: boolean;
  icon: React.ReactNode;
  tone: "warning" | "danger" | "info";
}): React.JSX.Element {
  const toneCls = { warning: "text-warning", danger: "text-danger", info: "text-info" }[tone];
  return (
    <Link href={href}>
      <Card className="h-full transition-colors hover:border-accent-400/40">
        <span className={toneCls}>{icon}</span>
        {loading ? <Skeleton className="mt-2 h-6 w-8" /> : <p className="mt-1 text-xl font-semibold">{value ?? 0}</p>}
        <p className="text-xs text-text-3">{label}</p>
      </Card>
    </Link>
  );
}
