"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useQueryClient } from "@tanstack/react-query";
import { Check, ShieldAlert, X } from "lucide-react";
import type { z } from "zod";
import { toDisplay,WITHDRAWAL_STATUSES, zAdminWithdrawalRow } from "@quatatrade/shared";
import { AdminTitle, ExportCsvButton, FilterBar, Pagination, RefreshButton, TableFrame } from "@/components/admin/admin-ui";
import { TotpActionDialog } from "@/components/admin/totp-dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/field";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Usdt } from "@/components/ui/amount";
import { WithdrawalStatusBadge } from "@/components/ui/status-badge";
import { useToast } from "@/components/ui/toast";
import { adminApi } from "@/lib/api/admin-client";
import { useAdminMe, useAdminWithdrawals } from "@/hooks/use-admin";
import { usePageClamp } from "@/hooks/use-page-clamp";
import { apiErrorMessage } from "@/lib/api/errors";
import { shortHash } from "@/lib/format";

type Row = z.infer<typeof zAdminWithdrawalRow>;

export default function AdminWithdrawalsPage(): React.JSX.Element {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [status, setStatus] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const { data, isLoading, refetch, isFetching, isError } = useAdminWithdrawals(page, pageSize, { status, from, to });
  const { data: me } = useAdminMe();
  usePageClamp(page, data?.items.length, setPage);
  const qc = useQueryClient();
  const toast = useToast();
  const tx = useTranslations("adminWithdrawals");
  const tu = useTranslations("adminUi");
  const hasFilters = Boolean(status || from || to);
  const resetFilters = () => {
    setStatus("");
    setFrom("");
    setTo("");
    setPage(1);
  };

  const [action, setAction] = useState<{ row: Row; kind: "approve" | "reject" } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (v: { totpCode?: string; reason?: string }) => {
    if (!action) return;
    setBusy(true);
    setError(null);
    try {
      if (action.kind === "approve") {
        await adminApi.adminApproveWithdrawal(action.row.id, { totpCode: v.totpCode });
        toast.success(tx("approvedToastTitle"), tx("approvedToastBody"));
      } else {
        await adminApi.adminRejectWithdrawal(action.row.id, { totpCode: v.totpCode, reason: v.reason ?? "" });
        toast.success(tx("rejectedToastTitle"), tx("rejectedToastBody"));
      }
      setAction(null);
      void qc.invalidateQueries({ queryKey: ["admin"] });
    } catch (err) {
      setError(apiErrorMessage(err, tx("actionFailed")));
    } finally {
      setBusy(false);
    }
  };

  const actionable = (s: string) => s === "PENDING_APPROVAL" || s === "RISK_HOLD";

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
              filename="quatatrade-withdrawals"
              columns={[
                { header: "User", value: (w) => w.userEmail },
                { header: "Asset", value: (w) => w.asset },
                { header: "Amount (USDT)", value: (w) => toDisplay(w.amount, "USDT_TRC20", 6) },
                { header: "Fee (USDT)", value: (w) => toDisplay(w.fee, "USDT_TRC20", 6) },
                { header: "Destination", value: (w) => w.toAddress },
                { header: "Risk", value: (w) => w.riskScore ?? "" },
                { header: "Status", value: (w) => w.status },
                { header: "Created", value: (w) => w.createdAt },
              ]}
            />
          </div>
        }
      />

      <FilterBar onReset={resetFilters} showReset={hasFilters}>
        <Field label={tu("filterStatus")} className="w-52">
          {() => (
            <Select
              value={status}
              onChange={(e) => {
                setStatus(e.target.value);
                setPage(1);
              }}
              options={[
                { value: "", label: tu("filterAll") },
                ...WITHDRAWAL_STATUSES.map((s) => ({ value: s, label: s })),
              ]}
            />
          )}
        </Field>
        <Field label={tu("dateFrom")} className="w-40">
          {() => (
            <Input
              type="date"
              value={from}
              onChange={(e) => {
                setFrom(e.target.value);
                setPage(1);
              }}
            />
          )}
        </Field>
        <Field label={tu("dateTo")} className="w-40">
          {() => (
            <Input
              type="date"
              value={to}
              onChange={(e) => {
                setTo(e.target.value);
                setPage(1);
              }}
            />
          )}
        </Field>
      </FilterBar>

      {isLoading ? (
        <Skeleton className="h-64 w-full rounded-xl" />
      ) : isError || !data ? (
        // A failed request is not an empty queue: telling an operator the queue
        // is clear when it could not be read is how held money goes unreviewed.
        <Alert tone="danger">{tx("queueLoadError")}</Alert>
      ) : data.items.length === 0 ? (
        <>
          <EmptyState icon={Check} title={tx("emptyTitle")} description={tx("emptyDescription")} />
          {/* Without this an admin who filtered down to an empty page had no
              control to get back to page 1. */}
          {data && data.page > 1 && (
            <Pagination page={data.page} pageSize={data.pageSize} total={data.total} onPage={setPage} />
          )}
        </>
      ) : (
        <>
          <TableFrame
            head={
              <tr>
                <th className="px-4 py-2.5">{tx("colUser")}</th>
                <th className="px-4 py-2.5">{tx("colAmount")}</th>
                <th className="px-4 py-2.5">{tx("colDestination")}</th>
                <th className="px-4 py-2.5">{tx("colRisk")}</th>
                <th className="px-4 py-2.5">{tx("colStatus")}</th>
                <th className="px-4 py-2.5 text-right">{tx("colAction")}</th>
              </tr>
            }
          >
            {data.items.map((w) => (
              <tr key={w.id} className="align-middle">
                <td className="px-4 py-3">
                  <p className="truncate">{w.userEmail}</p>
                  {w.requiresSecondApprover && (
                    <Badge tone="warning" className="mt-0.5">
                      {tx("twoApprovers")}
                    </Badge>
                  )}
                </td>
                <td className="px-4 py-3">
                  <Usdt value={w.amount} size="sm" />
                  <p className="text-xs text-text-3">{tx("fee")} <Usdt value={w.fee} size="sm" showUnit={false} /></p>
                </td>
                <td className="px-4 py-3 font-money text-xs">{shortHash(w.toAddress, 8, 6)}</td>
                <td className="px-4 py-3">
                  {w.riskScore != null ? (
                    <Badge tone={w.riskScore >= 70 ? "danger" : w.riskScore >= 40 ? "warning" : "neutral"}>
                      {w.riskScore >= 70 && <ShieldAlert size={11} />} {w.riskScore}
                    </Badge>
                  ) : (
                    <span className="text-text-3">—</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  <WithdrawalStatusBadge status={w.status} />
                </td>
                <td className="px-4 py-3">
                  {actionable(w.status) ? (
                    <div className="flex justify-end gap-2">
                      <Button size="sm" variant="secondary" className="text-danger" onClick={() => { setError(null); setAction({ row: w, kind: "reject" }); }}>
                        <X size={14} /> {tx("reject")}
                      </Button>
                      <Button size="sm" onClick={() => { setError(null); setAction({ row: w, kind: "approve" }); }}>
                        <Check size={14} /> {tx("approve")}
                      </Button>
                    </div>
                  ) : (
                    <span className="block text-right text-xs text-text-3">
                      {w.approvedBy ? tx("firstApproved") : "—"}
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </TableFrame>
          <Pagination
            page={data.page}
            pageSize={data.pageSize}
            total={data.total}
            onPage={setPage}
            onPageSize={(n) => {
              setPageSize(n);
              setPage(1);
            }}
          />
        </>
      )}

      <TotpActionDialog
        open={Boolean(action)}
        onClose={() => setAction(null)}
        title={action?.kind === "approve" ? tx("approveTitle") : tx("rejectTitle")}
        description={
          action
            ? action.kind === "approve"
              ? action.row.requiresSecondApprover
                ? tx("approveDescLarge")
                : tx("approveDesc")
              : tx("rejectDesc")
            : undefined
        }
        actionLabel={action?.kind === "approve" ? tx("approve") : tx("reject")}
        destructive={action?.kind === "reject"}
        reasonLabel={action?.kind === "reject" ? tx("reason") : undefined}
        reasonRequired={action?.kind === "reject"}
        requireTotp={Boolean(me?.totpEnabled)}
        busy={busy}
        error={error}
        onConfirm={submit}
      />
    </div>
  );
}
