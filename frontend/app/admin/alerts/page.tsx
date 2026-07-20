"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertOctagon, AlertTriangle, Info, CheckCircle2, Check } from "lucide-react";
import type { AlertItem, AlertSeverity } from "@quatatrade/shared";
import { AdminTitle, RefreshButton, Pagination } from "@/components/admin/admin-ui";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { Segmented } from "@/components/ui/segmented";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { useToast } from "@/components/ui/toast";
import { adminApi } from "@/lib/api/admin-client";
import { usePageClamp } from "@/hooks/use-page-clamp";
import { apiErrorMessage } from "@/lib/api/errors";

const REFRESH_MS = 20_000;
type SeverityFilter = "all" | AlertSeverity;
type AckFilter = "all" | "unacked";

const SEV_TONE: Record<AlertSeverity, "danger" | "warning" | "info"> = {
  critical: "danger",
  warning: "warning",
  info: "info",
};

function SevIcon({ s }: { s: AlertSeverity }): React.JSX.Element {
  if (s === "critical") return <AlertOctagon size={13} />;
  if (s === "warning") return <AlertTriangle size={13} />;
  return <Info size={13} />;
}

export default function AlertsPage(): React.JSX.Element {
  const tx = useTranslations("adminAlerts");
  const toast = useToast();
  const qc = useQueryClient();

  const [severity, setSeverity] = useState<SeverityFilter>("all");
  const [ack, setAck] = useState<AckFilter>("all");
  const [ackingId, setAckingId] = useState<string | null>(null);
  // The API defaults to page 1 / 50 and applies LIMIT-OFFSET. Without a control,
  // the 51st-and-older alerts matching a filter were unreachable — including
  // unacknowledged criticals, which kept inflating the "unacknowledged" count
  // with no way to ever clear them.
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);

  const query: Record<string, string> = { page: String(page), pageSize: String(pageSize) };
  if (severity !== "all") query.severity = severity;
  if (ack === "unacked") query.acknowledged = "false";

  const { data, isLoading, error, refetch, isFetching } = useQuery({
    queryKey: ["admin", "alerts", severity, ack, page, pageSize],
    queryFn: () => adminApi.adminAlerts(query),
    refetchInterval: REFRESH_MS,
  });

  usePageClamp(page, data?.items.length, setPage);
  const acknowledge = async (id: string) => {
    setAckingId(id);
    try {
      await adminApi.adminAckAlert(id);
      await qc.invalidateQueries({ queryKey: ["admin", "alerts"] });
      toast.success(tx("ackedTitle"), tx("ackedBody"));
    } catch (err) {
      toast.error(tx("ackError"), apiErrorMessage(err, ""));
    } finally {
      setAckingId(null);
    }
  };

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <AdminTitle title={tx("pageTitle")} subtitle={tx("pageSubtitle")} />
        <RefreshButton onClick={() => void refetch()} busy={isFetching} />
      </div>

      {data && data.unacknowledged > 0 && (
        <Alert tone="warning" title={tx("unackTitle", { count: data.unacknowledged })}>
          {tx("unackBody")}
        </Alert>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <Segmented
          value={severity}
          onChange={(v) => {
            setSeverity(v as SeverityFilter);
            setPage(1); // a filter change invalidates the current offset
          }}
          aria-label={tx("severityFilter")}
          options={[
            { value: "all", label: tx("fAll") },
            { value: "critical", label: tx("fCritical"), tone: "danger" },
            { value: "warning", label: tx("fWarning") },
            { value: "info", label: tx("fInfo") },
          ]}
        />
        <Segmented
          value={ack}
          onChange={(v) => {
            setAck(v as AckFilter);
            setPage(1);
          }}
          aria-label={tx("ackFilter")}
          options={[
            { value: "all", label: tx("fAllAck") },
            { value: "unacked", label: tx("fUnacked") },
          ]}
        />
      </div>

      {isLoading ? (
        <div className="space-y-2">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
        </div>
      ) : error || !data ? (
        <Alert tone="danger">{apiErrorMessage(error, tx("loadError"))}</Alert>
      ) : data.items.length === 0 ? (
        <>
          <EmptyState icon={CheckCircle2} title={tx("emptyTitle")} description={tx("emptyBody")} />
          {/* Reachable here through the page's OWN action: acknowledging the last
              alerts on page 2 shrinks total to one page, the refetch returns
              nothing, and without this the admin sees "all clear" while the
              unacknowledged banner still shows a count, with no way back. */}
          {page > 1 && (
            <Pagination
              page={page}
              pageSize={pageSize}
              total={data.total}
              onPage={setPage}
              onPageSize={(n) => {
                setPageSize(n);
                setPage(1);
              }}
            />
          )}
        </>
      ) : (
        <div className="space-y-2">
          {data.items.map((a: AlertItem) => (
            <Card key={a.id} className="flex items-start justify-between gap-3">
              <div className="min-w-0 space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone={SEV_TONE[a.severity]} icon={<SevIcon s={a.severity} />}>
                    {tx(`sev_${a.severity}`)}
                  </Badge>
                  <span className="font-medium">{a.title}</span>
                  {a.acknowledgedAt && (
                    <Badge tone="neutral" icon={<Check size={12} />}>
                      {tx("acked")}
                    </Badge>
                  )}
                </div>
                <p className="font-money text-xs text-text-3">{a.eventType}</p>
                {a.metadata && (
                  <p className="break-all font-money text-xs text-text-2 line-clamp-2">{JSON.stringify(a.metadata)}</p>
                )}
                <p className="text-xs text-text-3">{new Date(a.createdAt).toLocaleString()}</p>
              </div>
              {!a.acknowledgedAt && (
                <Button size="sm" variant="secondary" onClick={() => void acknowledge(a.id)} disabled={ackingId === a.id}>
                  <Check size={13} /> {tx("ack")}
                </Button>
              )}
            </Card>
          ))}
          <Pagination
            page={page}
            pageSize={pageSize}
            total={data.total}
            onPage={setPage}
            onPageSize={(n) => {
              setPageSize(n);
              setPage(1);
            }}
          />
        </div>
      )}
    </div>
  );
}
