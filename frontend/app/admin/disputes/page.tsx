"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useQueryClient } from "@tanstack/react-query";
import { ShieldCheck } from "lucide-react";
import type { z } from "zod";
import { zAdminDisputeRow, type DisputeResolution } from "@quatatrade/shared";
import { AdminTitle, ExportCsvButton, Pagination, RefreshButton, TableFrame } from "@/components/admin/admin-ui";
import { Dialog } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import { Segmented } from "@/components/ui/segmented";
import { Field } from "@/components/ui/field";
import { Textarea } from "@/components/ui/input";
import { OtpInput } from "@/components/ui/otp-input";
import { Alert } from "@/components/ui/alert";
import { Spinner } from "@/components/ui/spinner";
import { Usdt } from "@/components/ui/amount";
import { useToast } from "@/components/ui/toast";
import { adminApi } from "@/lib/api/admin-client";
import { useAdminDisputes, useAdminMe } from "@/hooks/use-admin";
import { apiErrorMessage } from "@/lib/api/errors";
import { formatDateTime } from "@/lib/format";

type Row = z.infer<typeof zAdminDisputeRow>;

export default function AdminDisputesPage(): React.JSX.Element {
  const tx = useTranslations("adminDisputes");
  const [page, setPage] = useState(1);
  const { data, isLoading, refetch, isFetching } = useAdminDisputes(page);
  const { data: me } = useAdminMe();
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
              filename="quatatrade-disputes"
              columns={[
                { header: "Trade", value: (d) => d.tradeShortRef },
                { header: "Amount", value: (d) => d.amount },
                { header: "Reason", value: (d) => d.reason },
                { header: "Status", value: (d) => d.status },
                { header: "Opened by", value: (d) => d.openedBy },
                { header: "Opened", value: (d) => d.createdAt },
              ]}
            />
          </div>
        }
      />

      {isLoading ? (
        <Skeleton className="h-64 w-full rounded-xl" />
      ) : !data || data.items.length === 0 ? (
        <EmptyState icon={ShieldCheck} title={tx("emptyTitle")} description={tx("emptyDescription")} />
      ) : (
        <>
          <TableFrame
            head={
              <tr>
                <th className="px-4 py-2.5">{tx("colTrade")}</th>
                <th className="px-4 py-2.5">{tx("colAmount")}</th>
                <th className="px-4 py-2.5">{tx("colReason")}</th>
                <th className="px-4 py-2.5">{tx("colOpened")}</th>
                <th className="px-4 py-2.5 text-right">{tx("colAction")}</th>
              </tr>
            }
          >
            {data.items.map((d) => (
              <tr key={d.id}>
                <td className="px-4 py-3 font-money">{d.tradeShortRef}</td>
                <td className="px-4 py-3"><Usdt value={d.amount} size="sm" /></td>
                <td className="max-w-xs truncate px-4 py-3 text-text-2">{d.reason}</td>
                <td className="px-4 py-3 text-xs text-text-3">{formatDateTime(d.createdAt)}</td>
                <td className="px-4 py-3 text-right">
                  <Button size="sm" onClick={() => setActive(d)}>
                    {tx("resolve")}
                  </Button>
                </td>
              </tr>
            ))}
          </TableFrame>
          <Pagination page={data.page} pageSize={data.pageSize} total={data.total} onPage={setPage} />
        </>
      )}

      {active && <ResolveDialog dispute={active} requireTotp={Boolean(me?.totpEnabled)} onClose={() => setActive(null)} />}
    </div>
  );
}

function ResolveDialog({ dispute, requireTotp, onClose }: { dispute: Row; requireTotp: boolean; onClose: () => void }): React.JSX.Element {
  const tx = useTranslations("adminDisputes");
  const qc = useQueryClient();
  const toast = useToast();
  const [resolution, setResolution] = useState<DisputeResolution>("RELEASE_TO_BUYER");
  const [notes, setNotes] = useState("");
  const [totp, setTotp] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      await adminApi.adminResolveDispute(dispute.id, { resolution, notes, totpCode: totp || undefined });
      toast.success(tx("toastResolvedTitle"), resolution === "RELEASE_TO_BUYER" ? tx("toastReleasedDetail") : tx("toastRefundedDetail"));
      onClose();
      void qc.invalidateQueries({ queryKey: ["admin"] });
    } catch (err) {
      setError(apiErrorMessage(err, tx("errorCouldNotResolve")));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog
      open
      onClose={onClose}
      title={tx("resolveTitle", { ref: dispute.tradeShortRef })}
      description={requireTotp ? tx("dialogDescTotp") : tx("dialogDesc")}
    >
      <div className="space-y-4">
        {error && <Alert tone="danger">{error}</Alert>}
        <div className="rounded-lg bg-surface-2 p-3 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-text-2">{tx("frozenEscrow")}</span>
            <Usdt value={dispute.amount} size="sm" />
          </div>
          <p className="mt-1 text-xs text-text-3">{dispute.reason}</p>
        </div>
        <div>
          <p className="mb-1.5 text-sm font-medium">{tx("outcome")}</p>
          <Segmented
            value={resolution}
            onChange={setResolution}
            aria-label={tx("resolutionOutcomeAria")}
            className="w-full"
            options={[
              { value: "RELEASE_TO_BUYER", label: tx("releaseToBuyer"), tone: "success" },
              { value: "REFUND_TO_SELLER", label: tx("refundToSeller"), tone: "danger" },
            ]}
          />
        </div>
        <Field label={tx("resolutionNotes")} required>
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
          <Button className="flex-1" disabled={busy || notes.trim().length < 10 || (requireTotp && totp.length < 6)} onClick={submit}>
            {busy ? <Spinner /> : tx("resolveDispute")}
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
