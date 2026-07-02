"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { BadgeCheck, FileText } from "lucide-react";
import type { z } from "zod";
import { zAdminKycQueueRow } from "@quatatrade/shared";
import { AdminTitle, Pagination, TableFrame } from "@/components/admin/admin-ui";
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
  const [page, setPage] = useState(1);
  const { data, isLoading } = useAdminKycQueue(page);
  const [active, setActive] = useState<Row | null>(null);

  return (
    <div className="space-y-5">
      <AdminTitle title="KYC review" subtitle="Decisions are manual — no code path auto-approves." />

      {isLoading ? (
        <Skeleton className="h-64 w-full rounded-xl" />
      ) : !data || data.items.length === 0 ? (
        <EmptyState icon={BadgeCheck} title="Nothing to review" description="No pending KYC submissions." />
      ) : (
        <>
          <TableFrame
            head={
              <tr>
                <th className="px-4 py-2.5">User</th>
                <th className="px-4 py-2.5">Tier</th>
                <th className="px-4 py-2.5">Document</th>
                <th className="px-4 py-2.5">Files</th>
                <th className="px-4 py-2.5">Submitted</th>
                <th className="px-4 py-2.5 text-right">Action</th>
              </tr>
            }
          >
            {data.items.map((k) => (
              <tr key={k.id}>
                <td className="px-4 py-3">{k.userEmail}</td>
                <td className="px-4 py-3"><Badge tone="info">Tier {k.tier}</Badge></td>
                <td className="px-4 py-3 capitalize">{k.docType.replace(/_/g, " ")}</td>
                <td className="px-4 py-3">
                  <span className="flex items-center gap-1 text-text-2">
                    <FileText size={14} /> {k.files.length}
                  </span>
                </td>
                <td className="px-4 py-3 text-xs text-text-3">{formatDateTime(k.submittedAt)}</td>
                <td className="px-4 py-3 text-right">
                  <Button size="sm" onClick={() => setActive(k)}>
                    Review
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
  const qc = useQueryClient();
  const toast = useToast();
  const [decision, setDecision] = useState<Decision>("approve");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      await adminApi.adminReviewKyc(row.id, decision, { notes: notes.trim() || undefined });
      toast.success(`Marked ${decision}d`, `${row.userEmail} — tier ${row.tier}`);
      onClose();
      void qc.invalidateQueries({ queryKey: ["admin"] });
    } catch (err) {
      setError(apiErrorMessage(err, "Review failed"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open onClose={onClose} title={`Review — ${row.userEmail}`} description={`Tier ${row.tier} · ${row.docType.replace(/_/g, " ")}`}>
      <div className="space-y-4">
        {error && <Alert tone="danger">{error}</Alert>}
        <Alert tone="info">
          {row.files.length} document{row.files.length === 1 ? "" : "s"} submitted. Open each in the secure viewer
          before deciding. Approving raises the user to tier {row.tier}.
        </Alert>
        <div>
          <p className="mb-1.5 text-sm font-medium">Decision</p>
          <Segmented
            value={decision}
            onChange={setDecision}
            aria-label="KYC decision"
            className="w-full"
            options={[
              { value: "approve", label: "Approve", tone: "success" },
              { value: "resubmit", label: "Resubmit" },
              { value: "reject", label: "Reject", tone: "danger" },
            ]}
          />
        </div>
        <Field label="Notes" hint="Shown to the user on reject/resubmit.">
          {(p) => <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional reviewer notes…" {...p} />}
        </Field>
        <div className="flex gap-2">
          <Button variant="secondary" className="flex-1" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button className="flex-1" onClick={submit} disabled={busy}>
            {busy ? <Spinner /> : `Confirm ${decision}`}
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
