"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { AlertTriangle, ArrowRight, ArrowUpFromLine, BadgeCheck, Coins, ShieldAlert, TrendingUp, Users } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Usdt } from "@/components/ui/amount";
import { TrendChart, type ChartPoint } from "@/components/admin/metric-chart";
import { useAdminKpis, useAdminMetrics } from "@/hooks/use-admin";

export default function AdminDashboard(): React.JSX.Element {
  const tx = useTranslations("adminDash");
  const { data, isLoading, isError } = useAdminKpis();
  const { data: metrics } = useAdminMetrics(30);
  const signups: ChartPoint[] = (metrics?.points ?? []).map((p) => ({ label: p.date.slice(5), value: p.signups }));
  const trades: ChartPoint[] = (metrics?.points ?? []).map((p) => ({ label: p.date.slice(5), value: p.trades }));

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-display text-2xl font-bold tracking-tight">{tx("title")}</h1>
        <p className="text-sm text-text-2">{tx("subtitle")}</p>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label={tx("totalUsers")} value={data?.totalUsers} loading={isLoading} icon={<Users size={16} />} />
        <Kpi label={tx("activeTrades")} value={data?.activeTrades} loading={isLoading} icon={<TrendingUp size={16} />} />
        <Kpi label={tx("trades24h")} value={data?.tradesLast24h} loading={isLoading} />
        <Kpi
          label={tx("volume24h")}
          value={data ? <Usdt value={data.volumeLast24h} size="md" /> : undefined}
          loading={isLoading}
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <Card className="flex items-center justify-between">
          <div>
            <p className="flex items-center gap-1.5 text-sm text-text-2">
              <Coins size={14} className="text-accent-400" /> {tx("escrowLocked")}
            </p>
            {isLoading ? <Skeleton className="mt-1 h-6 w-28" /> : isError ? <p className="mt-1 text-lg text-text-3">—</p> : <div className="mt-1"><Usdt value={data?.escrowLockedTotal ?? "0"} size="lg" /></div>}
          </div>
          <div className="text-right">
            <p className="text-sm text-text-2">{tx("treasury")}</p>
            {isLoading ? <Skeleton className="mt-1 h-6 w-24" /> : isError ? <p className="mt-1 text-lg text-text-3">—</p> : <div className="mt-1"><Usdt value={data?.treasuryBalance ?? "0"} size="lg" /></div>}
          </div>
        </Card>

        {/* A failed KPI read used to render 0 pending withdrawals, 0 disputes,
          0 KYC and 0.00 USDT held — "nothing needs you" is the single most
          dangerous thing to tell an operator when the console cannot see. */}
      {isError && <Alert tone="danger" className="mb-3">{tx("kpiLoadError")}</Alert>}
      <div className="grid grid-cols-3 gap-3">
          <ActionTile href="/admin/withdrawals" label={tx("pending")} value={isError ? undefined : data?.pendingWithdrawals} loading={isLoading} icon={<ArrowUpFromLine size={16} />} tone="warning" />
          <ActionTile href="/admin/disputes" label={tx("disputes")} value={isError ? undefined : data?.openDisputes} loading={isLoading} icon={<ShieldAlert size={16} />} tone="danger" />
          <ActionTile href="/admin/kyc" label={tx("kycQueue")} value={isError ? undefined : data?.pendingKyc} loading={isLoading} icon={<BadgeCheck size={16} />} tone="info" />
        </div>
      </div>

      {/* 30-day trends (full analytics on the report page) */}
      <div className="grid gap-3 lg:grid-cols-2">
        <Card>
          <div className="mb-3 flex items-center justify-between">
            <p className="text-sm font-medium text-text-2">{tx("chartSignups")}</p>
            <Link href="/admin/reports" className="flex items-center gap-1 text-xs text-accent-400 hover:underline">
              {tx("viewReport")} <ArrowRight size={12} />
            </Link>
          </div>
          {metrics ? <TrendChart data={signups} type="area" height={180} /> : <Skeleton className="h-44 w-full rounded-lg" />}
        </Card>
        <Card>
          <p className="mb-3 text-sm font-medium text-text-2">{tx("chartTrades")}</p>
          {metrics ? <TrendChart data={trades} type="bar" height={180} /> : <Skeleton className="h-44 w-full rounded-lg" />}
        </Card>
      </div>

      {data && data.riskFlagsLast24h > 0 && (
        <Card className="flex items-center gap-3 border-warning/30 bg-warning/5">
          <AlertTriangle size={18} className="text-warning" />
          <p className="text-sm">
            <span className="font-semibold text-warning">{data.riskFlagsLast24h}</span> {tx("riskFlags24h")}
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
