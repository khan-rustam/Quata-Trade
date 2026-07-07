"use client";

import { useTranslations } from "next-intl";
import { useQuery } from "@tanstack/react-query";
import { CheckCircle2, AlertTriangle, Database, Server, Radio, Inbox, ShieldAlert } from "lucide-react";
import type { ServiceStatus } from "@quatatrade/shared";
import { AdminTitle, RefreshButton, StatCards } from "@/components/admin/admin-ui";
import { StatTile } from "@/components/ui/stat-tile";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { adminApi } from "@/lib/api/admin-client";
import { apiErrorMessage } from "@/lib/api/errors";

const REFRESH_MS = 15_000;

function fmtAge(sec: number | null): string {
  if (sec === null) return "—";
  if (sec < 60) return `${sec}s`;
  const m = Math.floor(sec / 60);
  if (m < 60) return `${m}m ${sec % 60}s`;
  const h = Math.floor(m / 60);
  return `${h}h ${m % 60}m`;
}

/**
 * Admin System Health — in-app "Layer A" monitoring. Live service/queue/workload
 * signals from Postgres + Redis. NOTE (surfaced to the operator): this cannot
 * detect the app being wholly down — that needs the external uptime watchdog.
 */
export default function SystemHealthPage(): React.JSX.Element {
  const tx = useTranslations("adminSystemHealth");

  const { data, isLoading, error, refetch, isFetching } = useQuery({
    queryKey: ["admin", "system-health"],
    queryFn: () => adminApi.adminSystemHealth(),
    refetchInterval: REFRESH_MS,
    refetchOnWindowFocus: true,
  });

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <AdminTitle title={tx("pageTitle")} subtitle={tx("pageSubtitle")} />
        <RefreshButton onClick={() => void refetch()} busy={isFetching} />
      </div>

      <Alert tone="info" title={tx("watchdogTitle")}>
        {tx("watchdogBody")}
      </Alert>

      {isLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-32 w-full" />
        </div>
      ) : error || !data ? (
        <Alert tone="danger">{apiErrorMessage(error, tx("loadError"))}</Alert>
      ) : (
        <>
          <Card className="space-y-3">
            <p className="font-medium">{tx("servicesTitle")}</p>
            <div className="flex flex-wrap gap-2">
              <ServicePill label={tx("api")} status={data.services.api} icon={<Server size={13} />} up={tx("up")} down={tx("down")} />
              <ServicePill label={tx("db")} status={data.services.db} icon={<Database size={13} />} up={tx("up")} down={tx("down")} />
              <ServicePill label={tx("redis")} status={data.services.redis} icon={<Radio size={13} />} up={tx("up")} down={tx("down")} />
            </div>
            <div className="flex flex-wrap gap-2 pt-1">
              <SwitchPill label={tx("withdrawals")} paused={data.killSwitches.withdrawalsPaused} onLabel={tx("live")} offLabel={tx("paused")} />
              <SwitchPill label={tx("trades")} paused={data.killSwitches.tradesPaused} onLabel={tx("live")} offLabel={tx("paused")} />
            </div>
          </Card>

          <div className="space-y-2">
            <p className="text-sm font-medium text-text-2">{tx("pipelineTitle")}</p>
            <StatCards>
              <StatTile
                label={tx("outboxPending")}
                value={<span className={data.outbox.pending > 0 ? "text-warning" : undefined}>{data.outbox.pending}</span>}
                icon={<Inbox size={15} />}
                footnote={tx("oldestPending", { age: fmtAge(data.outbox.oldestPendingAgeSec) })}
              />
              <StatTile
                label={tx("outboxRetrying")}
                value={<span className={data.outbox.retrying > 0 ? "text-warning" : undefined}>{data.outbox.retrying}</span>}
                icon={<AlertTriangle size={15} />}
              />
              <StatTile
                label={tx("stuckBroadcast")}
                value={<span className={data.withdrawals.stuckBroadcast > 0 ? "text-danger" : undefined}>{data.withdrawals.stuckBroadcast}</span>}
                icon={<AlertTriangle size={15} />}
                footnote={tx("stuckHint")}
              />
              <StatTile label={tx("riskHold")} value={data.withdrawals.riskHold} icon={<ShieldAlert size={15} />} />
            </StatCards>
          </div>

          <div className="space-y-2">
            <p className="text-sm font-medium text-text-2">{tx("workloadTitle")}</p>
            <StatCards>
              <StatTile label={tx("pendingApproval")} value={data.withdrawals.pendingApproval} />
              <StatTile label={tx("openDisputes")} value={data.workload.openDisputes} />
              <StatTile label={tx("pendingKyc")} value={data.workload.pendingKyc} />
            </StatCards>
          </div>

          <p className="text-xs text-text-3">
            {tx("checkedAt", { time: new Date(data.checkedAt).toLocaleTimeString() })} · {tx("autoRefresh")}
          </p>
        </>
      )}
    </div>
  );
}

function ServicePill({
  label,
  status,
  icon,
  up,
  down,
}: {
  label: string;
  status: ServiceStatus;
  icon: React.ReactNode;
  up: string;
  down: string;
}): React.JSX.Element {
  const ok = status === "up";
  return (
    <Badge tone={ok ? "success" : "danger"} icon={ok ? <CheckCircle2 size={13} /> : <AlertTriangle size={13} />}>
      <span className="inline-flex items-center gap-1">
        {icon} {label}: {ok ? up : down}
      </span>
    </Badge>
  );
}

function SwitchPill({
  label,
  paused,
  onLabel,
  offLabel,
}: {
  label: string;
  paused: boolean;
  onLabel: string;
  offLabel: string;
}): React.JSX.Element {
  return (
    <Badge tone={paused ? "warning" : "neutral"} icon={paused ? <AlertTriangle size={13} /> : <CheckCircle2 size={13} />}>
      {label}: {paused ? offLabel : onLabel}
    </Badge>
  );
}
