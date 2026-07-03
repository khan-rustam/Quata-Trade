"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { CheckCircle2, ScrollText, ShieldAlert } from "lucide-react";
import { AdminTitle, ExportCsvButton, Pagination, RefreshButton, TableFrame } from "@/components/admin/admin-ui";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { Spinner } from "@/components/ui/spinner";
import { useToast } from "@/components/ui/toast";
import { adminApi } from "@/lib/api/admin-client";
import { useAdminAuditLogs } from "@/hooks/use-admin";
import { apiErrorMessage } from "@/lib/api/errors";
import { formatDateTime, shortHash } from "@/lib/format";

export default function AdminAuditPage(): React.JSX.Element {
  const tx = useTranslations("adminAudit");
  const [page, setPage] = useState(1);
  const { data, isLoading, refetch, isFetching } = useAdminAuditLogs(page);
  const toast = useToast();
  const [verifying, setVerifying] = useState(false);
  const [verifyResult, setVerifyResult] = useState<{ broken: number } | null>(null);

  const verify = async () => {
    setVerifying(true);
    try {
      const res = await adminApi.adminVerifyAudit();
      setVerifyResult({ broken: res.broken.length });
      if (res.broken.length === 0) toast.success(tx("chainIntactTitle"), tx("chainIntactBody"));
      else toast.error(tx("tamperDetectedTitle"), tx("tamperDetectedBody", { count: res.broken.length }));
    } catch (err) {
      toast.error(tx("verifyFailedTitle"), apiErrorMessage(err));
    } finally {
      setVerifying(false);
    }
  };

  return (
    <div className="space-y-5">
      <AdminTitle
        title={tx("title")}
        subtitle={tx("subtitle")}
        action={
          <div className="flex flex-wrap gap-2">
            <RefreshButton onClick={() => void refetch()} busy={isFetching} />
            <ExportCsvButton
              rows={data?.items ?? []}
              filename="quatatrade-audit-logs"
              columns={[
                { header: "When", value: (r) => r.createdAt },
                { header: "Actor type", value: (r) => r.actorType },
                { header: "Actor id", value: (r) => r.actorId ?? "" },
                { header: "Action", value: (r) => r.action },
                { header: "Target type", value: (r) => r.targetType ?? "" },
                { header: "Target id", value: (r) => r.targetId ?? "" },
                { header: "IP", value: (r) => r.ip ?? "" },
                { header: "Metadata", value: (r) => (r.metadata ? JSON.stringify(r.metadata) : "") },
              ]}
            />
            <Button size="sm" variant="secondary" onClick={verify} disabled={verifying}>
              {verifying ? <Spinner /> : <ShieldAlert size={14} />} {tx("verifyChain")}
            </Button>
          </div>
        }
      />

      {verifyResult && (
        <Card className={verifyResult.broken === 0 ? "border-success/30 bg-success/5" : "border-danger/30 bg-danger/5"}>
          <p className="flex items-center gap-2 text-sm">
            {verifyResult.broken === 0 ? (
              <>
                <CheckCircle2 size={16} className="text-success" /> {tx("hashChainVerified")}
              </>
            ) : (
              <>
                <ShieldAlert size={16} className="text-danger" /> {tx("rowsFailedHashCheck", { count: verifyResult.broken })}
              </>
            )}
          </p>
        </Card>
      )}

      {isLoading ? (
        <Skeleton className="h-64 w-full rounded-xl" />
      ) : !data || data.items.length === 0 ? (
        <EmptyState icon={ScrollText} title={tx("emptyTitle")} description={tx("emptyBody")} />
      ) : (
        <>
          <TableFrame
            head={
              <tr>
                <th className="px-4 py-2.5">{tx("colWhen")}</th>
                <th className="px-4 py-2.5">{tx("colActor")}</th>
                <th className="px-4 py-2.5">{tx("colAction")}</th>
                <th className="px-4 py-2.5">{tx("colTarget")}</th>
                <th className="px-4 py-2.5">{tx("colIp")}</th>
              </tr>
            }
          >
            {data.items.map((r) => (
              <tr key={r.id}>
                <td className="px-4 py-3 text-xs text-text-3">{formatDateTime(r.createdAt)}</td>
                <td className="px-4 py-3">
                  <Badge tone={r.actorType === "admin" ? "accent" : r.actorType === "system" ? "neutral" : "info"}>
                    {r.actorType}
                  </Badge>
                  {r.actorId && <span className="ml-1 font-money text-xs text-text-3">{shortHash(r.actorId, 6, 4)}</span>}
                </td>
                <td className="px-4 py-3 font-medium">{r.action}</td>
                <td className="px-4 py-3 text-text-2">
                  {r.targetType ? `${r.targetType}${r.targetId ? ` ${shortHash(r.targetId, 6, 4)}` : ""}` : "—"}
                </td>
                <td className="px-4 py-3 font-money text-xs text-text-3">{r.ip ?? "—"}</td>
              </tr>
            ))}
          </TableFrame>
          <Pagination page={data.page} pageSize={data.pageSize} total={data.total} onPage={setPage} />
        </>
      )}
    </div>
  );
}
