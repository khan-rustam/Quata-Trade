"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Check, ShieldAlert, X } from "lucide-react";
import type { z } from "zod";
import { zAdminWithdrawalRow } from "@quatatrade/shared";
import { AdminTitle, Pagination, TableFrame } from "@/components/admin/admin-ui";
import { TotpActionDialog } from "@/components/admin/totp-dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Usdt } from "@/components/ui/amount";
import { WithdrawalStatusBadge } from "@/components/ui/status-badge";
import { useToast } from "@/components/ui/toast";
import { adminApi } from "@/lib/api/admin-client";
import { useAdminWithdrawals } from "@/hooks/use-admin";
import { apiErrorMessage } from "@/lib/api/errors";
import { shortHash } from "@/lib/format";

type Row = z.infer<typeof zAdminWithdrawalRow>;

export default function AdminWithdrawalsPage(): React.JSX.Element {
  const [page, setPage] = useState(1);
  const { data, isLoading } = useAdminWithdrawals(page);
  const qc = useQueryClient();
  const toast = useToast();

  const [action, setAction] = useState<{ row: Row; kind: "approve" | "reject" } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (v: { totpCode: string; reason?: string }) => {
    if (!action) return;
    setBusy(true);
    setError(null);
    try {
      if (action.kind === "approve") {
        await adminApi.adminApproveWithdrawal(action.row.id, { totpCode: v.totpCode });
        toast.success("Approved", "The withdrawal moves to the signer pipeline.");
      } else {
        await adminApi.adminRejectWithdrawal(action.row.id, { totpCode: v.totpCode, reason: v.reason ?? "" });
        toast.success("Rejected", "Funds were refunded to the user.");
      }
      setAction(null);
      void qc.invalidateQueries({ queryKey: ["admin"] });
    } catch (err) {
      setError(apiErrorMessage(err, "Action failed"));
    } finally {
      setBusy(false);
    }
  };

  const actionable = (s: string) => s === "PENDING_APPROVAL" || s === "RISK_HOLD";

  return (
    <div className="space-y-5">
      <AdminTitle title="Withdrawals" subtitle="Approve or reject pending withdrawals. Large amounts need two approvers." />

      {isLoading ? (
        <Skeleton className="h-64 w-full rounded-xl" />
      ) : !data || data.items.length === 0 ? (
        <EmptyState icon={Check} title="Queue is clear" description="No withdrawals awaiting review." />
      ) : (
        <>
          <TableFrame
            head={
              <tr>
                <th className="px-4 py-2.5">User</th>
                <th className="px-4 py-2.5">Amount</th>
                <th className="px-4 py-2.5">Destination</th>
                <th className="px-4 py-2.5">Risk</th>
                <th className="px-4 py-2.5">Status</th>
                <th className="px-4 py-2.5 text-right">Action</th>
              </tr>
            }
          >
            {data.items.map((w) => (
              <tr key={w.id} className="align-middle">
                <td className="px-4 py-3">
                  <p className="truncate">{w.userEmail}</p>
                  {w.requiresSecondApprover && (
                    <Badge tone="warning" className="mt-0.5">
                      2 approvers
                    </Badge>
                  )}
                </td>
                <td className="px-4 py-3">
                  <Usdt value={w.amount} size="sm" />
                  <p className="text-xs text-text-3">fee <Usdt value={w.fee} size="sm" showUnit={false} /></p>
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
                        <X size={14} /> Reject
                      </Button>
                      <Button size="sm" onClick={() => { setError(null); setAction({ row: w, kind: "approve" }); }}>
                        <Check size={14} /> Approve
                      </Button>
                    </div>
                  ) : (
                    <span className="block text-right text-xs text-text-3">
                      {w.approvedBy ? "1st approved" : "—"}
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </TableFrame>
          <Pagination page={data.page} pageSize={data.pageSize} total={data.total} onPage={setPage} />
        </>
      )}

      <TotpActionDialog
        open={Boolean(action)}
        onClose={() => setAction(null)}
        title={action?.kind === "approve" ? "Approve withdrawal" : "Reject withdrawal"}
        description={
          action
            ? action.kind === "approve"
              ? action.row.requiresSecondApprover
                ? "This is a large withdrawal — it needs a second, different approver before signing."
                : "This releases the withdrawal to the signer pipeline."
              : "The debited funds will be refunded to the user."
            : undefined
        }
        actionLabel={action?.kind === "approve" ? "Approve" : "Reject"}
        destructive={action?.kind === "reject"}
        reasonLabel={action?.kind === "reject" ? "Reason" : undefined}
        reasonRequired={action?.kind === "reject"}
        busy={busy}
        error={error}
        onConfirm={submit}
      />
    </div>
  );
}
