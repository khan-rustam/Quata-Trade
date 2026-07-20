"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { BadgeCheck, FileText } from "lucide-react";
import { useTranslations } from "next-intl";
import type { z } from "zod";
import { zAdminKycQueueRow } from "@quatatrade/shared";
import { AdminTitle, ExportCsvButton, Pagination, RefreshButton, TableFrame } from "@/components/admin/admin-ui";
import { Dialog } from "@/components/ui/dialog";
import { OtpInput } from "@/components/ui/otp-input";
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
import { useAdminKycQueue, useAdminMe } from "@/hooks/use-admin";
import { apiErrorMessage } from "@/lib/api/errors";
import { formatDateTime } from "@/lib/format";

type Row = z.infer<typeof zAdminKycQueueRow>;
type Decision = "approve" | "reject" | "resubmit";

export default function AdminKycPage(): React.JSX.Element {
  const tx = useTranslations("adminKyc");
  const [page, setPage] = useState(1);
  const { data, isLoading, refetch, isFetching } = useAdminKycQueue(page);
  const [active, setActive] = useState<Row | null>(null);
  const { data: me } = useAdminMe();

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

      {active && <ReviewDialog row={active} requireTotp={Boolean(me?.totpEnabled)} onClose={() => setActive(null)} />}
    </div>
  );
}

function ReviewDialog({
  row,
  requireTotp,
  onClose,
}: {
  row: Row;
  requireTotp: boolean;
  onClose: () => void;
}): React.JSX.Element {
  const tx = useTranslations("adminKyc");
  const qc = useQueryClient();
  const toast = useToast();
  const [decision, setDecision] = useState<Decision>("approve");
  const [notes, setNotes] = useState("");
  const [totp, setTotp] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Step-up: an approval raises the user's KYC tier and with it their withdrawal
  // limits, so the server re-verifies the reviewer's own TOTP.
  const totpOk = !requireTotp || totp.length >= 6;

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

  const { data: docs, isLoading: docsLoading, isError: docsError } = useQuery({
    queryKey: ["admin", "kyc-documents", row.id],
    queryFn: () => adminApi.adminKycDocuments(row.id),
    staleTime: 60_000,
  });

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      await adminApi.adminReviewKyc(row.id, decision, { notes: notes.trim() || undefined, totpCode: totp || undefined });
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

        <div className="space-y-2">
          <p className="text-sm font-medium">{tx("documentsLabel")}</p>
          {docsLoading ? (
            <div className="grid grid-cols-2 gap-2">
              {Array.from({ length: Math.min(row.files.length || 2, 4) }).map((_, i) => (
                <Skeleton key={i} className="h-28 w-full rounded-lg" />
              ))}
            </div>
          ) : docsError || !docs || docs.documents.length === 0 ? (
            <Alert tone="warning">{tx("documentsError")}</Alert>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-2">
                {docs.documents.map((d) => (
                  <a
                    key={d.key}
                    href={d.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block overflow-hidden rounded-lg border border-border transition-colors hover:border-accent-400/50"
                  >
                    {d.kind === "image" ? (
                      // eslint-disable-next-line @next/next/no-img-element -- short-TTL presigned MinIO URL; no optimization
                      <img src={d.url} alt="" loading="lazy" className="h-28 w-full object-cover" />
                    ) : (
                      <div className="flex h-28 flex-col items-center justify-center gap-1 bg-surface-2 text-text-2">
                        <FileText size={22} />
                        <span className="text-xs">{d.kind === "pdf" ? tx("openPdf") : tx("openFile")}</span>
                      </div>
                    )}
                  </a>
                ))}
              </div>
              <p className="text-xs text-text-3">{tx("documentsTtl", { seconds: docs.ttlSeconds })}</p>
            </>
          )}
        </div>
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
        {requireTotp && (
          <div className="space-y-2">
            <label className="text-sm font-medium">{tx("authenticatorCodeLabel")}</label>
            <OtpInput value={totp} onChange={setTotp} aria-label={tx("authenticatorCodeAria")} invalid={Boolean(error)} />
          </div>
        )}
        <div className="flex gap-2">
          <Button variant="secondary" className="flex-1" onClick={onClose} disabled={busy}>
            {tx("cancel")}
          </Button>
          <Button className="flex-1" onClick={submit} disabled={busy || !totpOk}>
            {busy ? <Spinner /> : tx("confirm", { decision: labels[decision] })}
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
