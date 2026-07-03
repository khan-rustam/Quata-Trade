"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { ArrowDownToLine, Coins, Repeat, UserPlus } from "lucide-react";
import { toDisplay, type AdminMetricsResponse } from "@quatatrade/shared";
import { AdminTitle, ExportCsvButton, RefreshButton, StatCards } from "@/components/admin/admin-ui";
import { TrendChart, type ChartPoint } from "@/components/admin/metric-chart";
import { StatTile } from "@/components/ui/stat-tile";
import { Card } from "@/components/ui/card";
import { Segmented } from "@/components/ui/segmented";
import { Skeleton } from "@/components/ui/skeleton";
import { useAdminMetrics } from "@/hooks/use-admin";
import { formatUsdt } from "@/lib/format";

type Period = "7" | "30" | "90";

const usdtNum = (raw: string): number => Number(toDisplay(raw, "USDT_TRC20", 2));
const shortDay = (iso: string): string => iso.slice(5); // MM-DD

export default function AdminReportsPage(): React.JSX.Element {
  const tx = useTranslations("adminReports");
  const [period, setPeriod] = useState<Period>("30");
  const { data, isLoading, refetch, isFetching } = useAdminMetrics(Number(period));

  return (
    <div className="space-y-5">
      <AdminTitle
        title={tx("title")}
        subtitle={tx("subtitle")}
        action={
          <div className="flex flex-wrap items-center gap-2">
            <Segmented
              value={period}
              onChange={setPeriod}
              aria-label={tx("periodAria")}
              options={[
                { value: "7", label: tx("period7") },
                { value: "30", label: tx("period30") },
                { value: "90", label: tx("period90") },
              ]}
            />
            <RefreshButton onClick={() => void refetch()} busy={isFetching} />
            <ExportCsvButton
              rows={data?.points ?? []}
              filename={`quatatrade-metrics-${period}d`}
              columns={[
                { header: "Date", value: (p) => p.date },
                { header: "Signups", value: (p) => p.signups },
                { header: "Trades", value: (p) => p.trades },
                { header: "Volume (USDT units)", value: (p) => p.volumeUsdt },
                { header: "Fees (USDT units)", value: (p) => p.feeUsdt },
              ]}
            />
          </div>
        }
      />

      {isLoading || !data ? (
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-24 rounded-xl" />
            ))}
          </div>
          <Skeleton className="h-64 w-full rounded-xl" />
          <Skeleton className="h-64 w-full rounded-xl" />
        </div>
      ) : (
        <Report data={data} />
      )}
    </div>
  );
}

function Report({ data }: { data: AdminMetricsResponse }): React.JSX.Element {
  const tx = useTranslations("adminReports");
  const signups: ChartPoint[] = data.points.map((p) => ({ label: shortDay(p.date), value: p.signups }));
  const trades: ChartPoint[] = data.points.map((p) => ({ label: shortDay(p.date), value: p.trades }));
  const volume: ChartPoint[] = data.points.map((p) => ({ label: shortDay(p.date), value: usdtNum(p.volumeUsdt) }));
  const fees: ChartPoint[] = data.points.map((p) => ({ label: shortDay(p.date), value: usdtNum(p.feeUsdt) }));

  const usdtFmt = (v: number) => `${v.toLocaleString()} USDT`;

  return (
    <div className="space-y-5">
      <StatCards>
        <StatTile label={tx("sumSignups")} value={data.totals.signups} icon={<UserPlus size={16} />} />
        <StatTile label={tx("sumTrades")} value={data.totals.trades} icon={<Repeat size={16} />} />
        <StatTile
          label={tx("sumVolume")}
          value={<span className="font-money">{formatUsdt(data.totals.volumeUsdt, "USDT_TRC20", 0)}</span>}
          footnote="USDT"
          icon={<Coins size={16} />}
        />
        <StatTile
          label={tx("sumFees")}
          value={<span className="font-money">{formatUsdt(data.totals.feeUsdt, "USDT_TRC20", 2)}</span>}
          footnote="USDT"
          icon={<ArrowDownToLine size={16} />}
        />
      </StatCards>

      <div className="grid gap-5 lg:grid-cols-2">
        <ChartCard title={tx("chartSignups")}>
          <TrendChart data={signups} type="area" />
        </ChartCard>
        <ChartCard title={tx("chartTrades")}>
          <TrendChart data={trades} type="bar" />
        </ChartCard>
        <ChartCard title={tx("chartVolume")}>
          <TrendChart data={volume} type="area" formatter={usdtFmt} />
        </ChartCard>
        <ChartCard title={tx("chartFees")}>
          <TrendChart data={fees} type="bar" color="var(--color-warning)" formatter={usdtFmt} />
        </ChartCard>
      </div>
    </div>
  );
}

function ChartCard({ title, children }: { title: string; children: React.ReactNode }): React.JSX.Element {
  return (
    <Card>
      <h2 className="mb-3 font-display text-sm font-semibold text-text-2">{title}</h2>
      {children}
    </Card>
  );
}
