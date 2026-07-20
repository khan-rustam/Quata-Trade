"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { PauseCircle, ShieldAlert, ShieldX, Check, X } from "lucide-react";
import type { z } from "zod";
import { zAdminHeldDepositDecision, zAdminHeldDepositRow } from "@quatatrade/shared";
import { AdminTitle, ExportCsvButton, FilterBar, Pagination, RefreshButton, TableFrame } from "@/components/admin/admin-ui";
import { Dialog } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Field } from "@/components/ui/field";
import { Textarea } from "@/components/ui/input";
import { OtpInput } from "@/components/ui/otp-input";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
import { Usdt } from "@/components/ui/amount";
import { useToast } from "@/components/ui/toast";
import { useAdminMe } from "@/hooks/use-admin";
import { useAdminHeldDeposits, useReviewHeldDeposit, type HoldFilter } from "@/hooks/use-held-deposits";
import { can } from "@/lib/admin-rbac";
import { apiErrorMessage } from "@/lib/api/errors";
import { formatDateTime, shortHash, timeAgo } from "@/lib/format";

type Row = z.infer<typeof zAdminHeldDepositRow>;
type Decision = "release" | "reject";

const HOLDS: HoldFilter[] = ["all", "aml", "policy"];

/**
 * Held-deposit review queue. A deposit parked by source screening (AML) or by the
 * amount/limit policy is skipped by the confirmation job forever — release/reject
 * here is the ONLY exit, so an unreviewed row means a user's on-chain funds sit
 * uncreditable. Viewing is open to every admin role; deciding is SUPER/COMPLIANCE
 * only (server-enforced; the gate below is UX).
 */
export default function AdminHeldDepositsPage(): React.JSX.Element {
  const tx = useTranslations("adminHeldDeposits");
  const locale = useLocale();
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [hold, setHold] = useState<HoldFilter>("all");
  const { data, isLoading, refetch, isFetching } = useAdminHeldDeposits(page, pageSize, hold);
  const { data: me } = useAdminMe();
  const [action, setAction] = useState<{ row: Row; kind: Decision } | null>(null);

  const mayDecide = can(me?.role, "reviewHeldDeposit");

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
              filename="quatatrade-held-deposits"
              columns={[
                { header: "User", value: (d) => d.userEmail },
                { header: "Asset", value: (d) => d.asset },
                { header: "Amount", value: (d) => d.amount },
                { header: "AML reason", value: (d) => d.amlReason ?? "" },
                { header: "Policy reason", value: (d) => d.policyReason ?? "" },
                { header: "From", value: (d) => d.fromAddress ?? "" },
                { header: "Tx", value: (d) => d.txHash },
                { header: "Confirmations", value: (d) => d.confirmations },
                { header: "Created", value: (d) => d.createdAt },
              ]}
            />
          </div>
        }
      />

      {!mayDecide && <Alert tone="info">{tx("readOnlyNotice")}</Alert>}

      <FilterBar>
        <Field label={tx("filterHold")} className="w-52">
          {() => (
            <Select
              value={hold}
              onChange={(e) => {
                setHold(e.target.value as HoldFilter);
                setPage(1);
              }}
              options={HOLDS.map((h) => ({ value: h, label: tx(`hold_${h}`) }))}
            />
          )}
        </Field>
      </FilterBar>

      {isLoading ? (
        <Skeleton className="h-64 w-full rounded-xl" />
      ) : !data || data.items.length === 0 ? (
        <EmptyState icon={PauseCircle} title={tx("emptyTitle")} description={tx("emptyDescription")} />
      ) : (
        <>
          <TableFrame
            head={
              <tr>
                <th className="px-4 py-2.5">{tx("colUser")}</th>
                <th className="px-4 py-2.5">{tx("colAmount")}</th>
                <th className="px-4 py-2.5">{tx("colHold")}</th>
                <th className="px-4 py-2.5">{tx("colSource")}</th>
                <th className="px-4 py-2.5">{tx("colTx")}</th>
                <th className="px-4 py-2.5">{tx("colAge")}</th>
                {mayDecide && <th className="px-4 py-2.5 text-right">{tx("colAction")}</th>}
              </tr>
            }
          >
            {data.items.map((d) => (
              <tr key={d.id} className="align-top">
                <td className="px-4 py-3">
                  <p className="truncate">{d.userEmail}</p>
                </td>
                <td className="px-4 py-3">
                  <Usdt value={d.amount} size="sm" showUnit={false} />
                  <p className="text-xs text-text-3">{d.asset}</p>
                </td>
                <td className="px-4 py-3">
                  <div className="space-y-1">
                    {d.amlHold && (
                      <div>
                        <Badge tone="danger" icon={<ShieldX size={11} />}>
                          {tx("badgeAml")}
                        </Badge>
                        <p className="mt-0.5 max-w-60 text-xs text-text-2">{d.amlReason ?? tx("noReason")}</p>
                      </div>
                    )}
                    {d.policyHold && (
                      <div>
                        <Badge tone="warning" icon={<ShieldAlert size={11} />}>
                          {tx("badgePolicy")}
                        </Badge>
                        <p className="mt-0.5 max-w-60 text-xs text-text-2">{d.policyReason ?? tx("noReason")}</p>
                      </div>
                    )}
                  </div>
                </td>
                <td className="px-4 py-3 font-money text-xs">
                  {d.fromAddress ? shortHash(d.fromAddress, 8, 6) : <span className="text-text-3">—</span>}
                </td>
                <td className="px-4 py-3">
                  <p className="font-money text-xs">{shortHash(d.txHash, 8, 6)}</p>
                  <p className="text-xs text-text-3">{tx("confirmations", { n: d.confirmations })}</p>
                </td>
                <td className="px-4 py-3">
                  <p className="text-xs text-text-2">{timeAgo(d.createdAt, locale)}</p>
                  <p className="text-xs text-text-3">{formatDateTime(d.createdAt, locale)}</p>
                </td>
                {mayDecide && (
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-2">
                      <Button size="sm" variant="secondary" className="text-danger" onClick={() => setAction({ row: d, kind: "reject" })}>
                        <X size={14} /> {tx("reject")}
                      </Button>
                      <Button size="sm" onClick={() => setAction({ row: d, kind: "release" })}>
                        <Check size={14} /> {tx("release")}
                      </Button>
                    </div>
                  </td>
                )}
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

      {action && (
        <DecisionDialog
          row={action.row}
          kind={action.kind}
          requireTotp={Boolean(me?.totpEnabled)}
          onClose={() => setAction(null)}
        />
      )}
    </div>
  );
}

function DecisionDialog({
  row,
  kind,
  requireTotp,
  onClose,
}: {
  row: Row;
  kind: Decision;
  requireTotp: boolean;
  onClose: () => void;
}): React.JSX.Element {
  const tx = useTranslations("adminHeldDeposits");
  const toast = useToast();
  const review = useReviewHeldDeposit();
  const [reason, setReason] = useState("");
  const [totp, setTotp] = useState("");
  const [error, setError] = useState<string | null>(null);

  // Mirror the wire contract exactly rather than re-stating "min 10 chars" here.
  const parsed = zAdminHeldDepositDecision.safeParse({ reason });
  // Both decisions are step-up actions server-side: a release credits flagged
  // money, a rejection permanently refuses it. Without this the request is
  // rejected with "verification failed" and the admin has no way to comply.
  const totpOk = !requireTotp || totp.length >= 6;

  const submit = async () => {
    if (!parsed.success || !totpOk) return;
    setError(null);
    try {
      await review.mutateAsync({ id: row.id, decision: kind, body: { ...parsed.data, totpCode: totp || undefined } });
      toast.success(kind === "release" ? tx("releasedToastTitle") : tx("rejectedToastTitle"), row.userEmail);
      onClose();
    } catch (err) {
      setError(apiErrorMessage(err, tx("actionFailed")));
    }
  };

  return (
    <Dialog
      open
      onClose={onClose}
      title={kind === "release" ? tx("releaseTitle") : tx("rejectTitle")}
      description={tx("dialogSubject", { email: row.userEmail })}
    >
      <div className="space-y-4">
        {error && <Alert tone="danger">{error}</Alert>}

        <Alert tone={kind === "release" ? "warning" : "danger"} title={tx("consequenceTitle")}>
          {kind === "release" ? tx("releaseConsequence") : tx("rejectConsequence")}
        </Alert>

        <dl className="rounded-lg border border-border bg-surface-2 p-3 text-sm">
          <div className="flex justify-between gap-3">
            <dt className="text-text-3">{tx("colAmount")}</dt>
            <dd>
              <Usdt value={row.amount} size="sm" />
            </dd>
          </div>
          <div className="mt-1.5 flex justify-between gap-3">
            <dt className="text-text-3">{tx("colHold")}</dt>
            <dd className="max-w-72 text-right text-xs text-text-2">
              {row.amlHold && <p>{tx("badgeAml")} — {row.amlReason ?? tx("noReason")}</p>}
              {row.policyHold && <p>{tx("badgePolicy")} — {row.policyReason ?? tx("noReason")}</p>}
            </dd>
          </div>
          <div className="mt-1.5 flex justify-between gap-3">
            <dt className="text-text-3">{tx("colTx")}</dt>
            <dd className="font-money text-xs break-all">{row.txHash}</dd>
          </div>
        </dl>

        <Field label={tx("reasonLabel")} hint={tx("reasonHint")} required>
          {(p) => (
            <Textarea
              {...p}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder={tx("reasonPlaceholder")}
              maxLength={4000}
            />
          )}
        </Field>

        {requireTotp && (
          <div className="space-y-2">
            <label className="text-sm font-medium">{tx("authenticatorCodeLabel")}</label>
            <OtpInput value={totp} onChange={setTotp} aria-label={tx("authenticatorCodeAria")} invalid={Boolean(error)} />
          </div>
        )}

        <div className="flex gap-2">
          <Button variant="secondary" className="flex-1" onClick={onClose} disabled={review.isPending}>
            {tx("cancel")}
          </Button>
          <Button
            variant={kind === "reject" ? "danger" : "primary"}
            className="flex-1"
            disabled={!parsed.success || !totpOk || review.isPending}
            onClick={submit}
          >
            {review.isPending ? <Spinner /> : kind === "release" ? tx("release") : tx("reject")}
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
