"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { BadgeCheck, FileText } from "lucide-react";
import { useTranslations } from "next-intl";
import type { z } from "zod";
import { zAdminKycQueueRow } from "@quatatrade/shared";
import { AdminTitle, ExportCsvButton, Pagination, RefreshButton, TableFrame } from "@/components/admin/admin-ui";
import { Dialog } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Segmented } from "@/components/ui/segmented";
import { Field } from "@/components/ui/field";
import { Textarea } from "@/components/ui/input";
import { Alert } from "@/components/ui/alert";
import { Spinner } from "@/components/ui/spinner";
import { useToast } from "@/components/ui/toast";
import { adminApi } from "@/lib/api/admin-client";
import { useAdminKycQueue } from "@/hooks/use-admin";
import { apiErrorMessage } from "@/lib/api/errors";
import { formatDateTime } from "@/lib/format";

type Row = z.infer<typeof zAdminKycQueueRow>;
type Decision = "approve" | "reject" | "resubmit";

export default function AdminKycPage(): React.JSX.Element {
  const tx = useTranslations("adminKyc");
  const [page, setPage] = useState(1);
  const { data, isLoading, refetch, isFetching } = useAdminKycQueue(page);
  const [active, setActive] = useState<Row | null>(null);

  return (
    <div className="space-y-5">
      <AdminTitle
        title={tx("title")}
        subtitle={tx("subtitle")}
        action={
          <div className="flex gap-2">
            <RefreshButton onClick={() => void refetch()} busy={isFetching} />
            <ExportCsvButton
              rows={data?.items ?? []}
              filename="quatatrade-kyc-queue"
              columns={[
                { header: "User", value: (k) => k.userEmail },
                { header: "Tier", value: (k) => k.tier },
                { header: "Document", value: (k) => k.docType },
                { header: "Files", value: (k) => k.files.length },
                { header: "Submitted", value: (k) => k.submittedAt },
              ]}
            />
          </div>
        }
      />

      {isLoading ? (
        <Skeleton className="h-64 w-full rounded-xl" />
      ) : !data || data.items.length === 0 ? (
        <EmptyState icon={BadgeCheck} title={tx("emptyTitle")} description={tx("emptyDescription")} />
      ) : (
        <>
          <TableFrame
            head={
              <tr>
                <th className="px-4 py-2.5">{tx("colUser")}</th>
                <th className="px-4 py-2.5">{tx("colTier")}</th>
                <th className="px-4 py-2.5">{tx("colDocument")}</th>
                <th className="px-4 py-2.5">{tx("colFiles")}</th>
                <th className="px-4 py-2.5">{tx("colSubmitted")}</th>
                <th className="px-4 py-2.5 text-right">{tx("colAction")}</th>
              </tr>
            }
          >
            {data.items.map((k) => (
              <tr key={k.id}>
                <td className="px-4 py-3">{k.userEmail}</td>
                <td className="px-4 py-3"><Badge tone="info">{tx("badgeTier", { tier: k.tier })}</Badge></td>
                <td className="px-4 py-3 capitalize">{k.docType.replace(/_/g, " ")}</td>
                <td className="px-4 py-3">
                  <span className="flex items-center gap-1 text-text-2">
                    <FileText size={14} /> {k.files.length}
                  </span>
                </td>
                <td className="px-4 py-3 text-xs text-text-3">{formatDateTime(k.submittedAt)}</td>
                <td className="px-4 py-3 text-right">
                  <Button size="sm" onClick={() => setActive(k)}>
                    {tx("review")}
                  </Button>
                </td>
              </tr>
            ))}
          </TableFrame>
          <Pagination page={data.page} pageSize={data.pageSize} total={data.total} onPage={setPage} />
        </>
      )}

      {active && <ReviewDialog row={active} onClose={() => setActive(null)} />}
    </div>
  );
}

function ReviewDialog({ row, onClose }: { row: Row; onClose: () => void }): React.JSX.Element {
  const tx = useTranslations("adminKyc");
  const qc = useQueryClient();
  const toast = useToast();
  const [decision, setDecision] = useState<Decision>("approve");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const labels: Record<Decision, string> = {
    approve: tx("decisionApprove"),
    resubmit: tx("decisionResubmit"),
    reject: tx("decisionReject"),
  };
  const toastTitles: Record<Decision, string> = {
    approve: tx("toastApproved"),
    resubmit: tx("toastResubmit"),
    reject: tx("toastRejected"),
  };

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      await adminApi.adminReviewKyc(row.id, decision, { notes: notes.trim() || undefined });
      toast.success(toastTitles[decision], tx("toastDetail", { email: row.userEmail, tier: row.tier }));
      onClose();
      void qc.invalidateQueries({ queryKey: ["admin"] });
    } catch (err) {
      setError(apiErrorMessage(err, tx("reviewFailed")));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open onClose={onClose} title={tx("dialogTitle", { email: row.userEmail })} description={tx("dialogDescription", { tier: row.tier, doc: row.docType.replace(/_/g, " ") })}>
      <div className="space-y-4">
        {error && <Alert tone="danger">{error}</Alert>}
        <Alert tone="info">
          {tx("alertInfo", { count: row.files.length, tier: row.tier })}
        </Alert>
        <div>
          <p className="mb-1.5 text-sm font-medium">{tx("decisionLabel")}</p>
          <Segmented
            value={decision}
            onChange={setDecision}
            aria-label={tx("segmentedAria")}
            className="w-full"
            options={[
              { value: "approve", label: labels.approve, tone: "success" },
              { value: "resubmit", label: labels.resubmit },
              { value: "reject", label: labels.reject, tone: "danger" },
            ]}
          />
        </div>
        <Field label={tx("notesLabel")} hint={tx("notesHint")}>
          {(p) => <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder={tx("notesPlaceholder")} {...p} />}
        </Field>
        <div className="flex gap-2">
          <Button variant="secondary" className="flex-1" onClick={onClose} disabled={busy}>
            {tx("cancel")}
          </Button>
          <Button className="flex-1" onClick={submit} disabled={busy}>
            {busy ? <Spinner /> : tx("confirm", { decision: labels[decision] })}
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
