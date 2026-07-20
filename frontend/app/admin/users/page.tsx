"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { ChevronRight, Search, Users } from "lucide-react";
import type { z } from "zod";
import { zAdminUserRow } from "@quatatrade/shared";
import { AdminTitle, ExportCsvButton, Pagination, RefreshButton, TableFrame } from "@/components/admin/admin-ui";
import { Dialog } from "@/components/ui/dialog";
import { OtpInput } from "@/components/ui/otp-input";
import { Input, Textarea } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar } from "@/components/ui/avatar";
import { Field } from "@/components/ui/field";
import { Alert } from "@/components/ui/alert";
import { Spinner } from "@/components/ui/spinner";
import { Segmented } from "@/components/ui/segmented";
import { useToast } from "@/components/ui/toast";
import { adminApi } from "@/lib/api/admin-client";
import { useAdminUsers, useAdminMe } from "@/hooks/use-admin";
import { apiErrorMessage } from "@/lib/api/errors";
import { formatDateTime } from "@/lib/format";

type Row = z.infer<typeof zAdminUserRow>;
type Action = "freeze" | "suspend" | "restore";

const STATUS_TONE = { active: "success", frozen: "warning", suspended: "danger", closed: "neutral" } as const;

export default function AdminUsersPage(): React.JSX.Element {
  const tx = useTranslations("adminUsers");
  const router = useRouter();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const { data, isLoading, refetch, isFetching } = useAdminUsers(page, debounced || undefined);
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
              filename="quatatrade-users"
              columns={[
                { header: "Email", value: (u) => u.email },
                { header: "Phone", value: (u) => u.phone ?? "" },
                { header: "KYC tier", value: (u) => u.kycTier },
                { header: "KYC status", value: (u) => u.kycStatus },
                { header: "Status", value: (u) => u.status },
                { header: "Reputation", value: (u) => u.reputationScore },
                { header: "Joined", value: (u) => u.createdAt },
              ]}
            />
          </div>
        }
      />

      <form
        onSubmit={(e) => {
          e.preventDefault();
          setPage(1);
          setDebounced(search.trim());
        }}
        className="flex gap-2"
      >
        <div className="relative flex-1">
          <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-text-3" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={tx("searchPlaceholder")} className="pl-9" aria-label={tx("searchAria")} />
        </div>
        <Button type="submit" variant="secondary">
          {tx("searchButton")}
        </Button>
      </form>

      {isLoading ? (
        <Skeleton className="h-64 w-full rounded-xl" />
      ) : !data || data.items.length === 0 ? (
        <EmptyState icon={Users} title={tx("emptyTitle")} description={tx("emptyDescription")} />
      ) : (
        <>
          <TableFrame
            head={
              <tr>
                <th className="px-4 py-2.5">{tx("colEmail")}</th>
                <th className="px-4 py-2.5">{tx("colKyc")}</th>
                <th className="px-4 py-2.5">{tx("colStatus")}</th>
                <th className="px-4 py-2.5">{tx("colJoined")}</th>
                <th className="px-4 py-2.5 text-right">{tx("colAction")}</th>
              </tr>
            }
          >
            {data.items.map((u) => (
              <tr
                key={u.id}
                onClick={() => router.push(`/admin/users/${u.id}`)}
                className="cursor-pointer transition-colors hover:bg-surface-2/40"
              >
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2.5">
                    <Avatar seed={u.id} size={32} />
                    <div className="min-w-0">
                      <p className="truncate font-medium text-text-1">{u.email}</p>
                      {u.phone && <p className="text-xs text-text-3">{u.phone}</p>}
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3"><Badge tone={u.kycStatus === "APPROVED" ? "success" : "neutral"}>T{u.kycTier} · {u.kycStatus.toLowerCase()}</Badge></td>
                <td className="px-4 py-3"><Badge tone={STATUS_TONE[u.status]}>{u.status}</Badge></td>
                <td className="px-4 py-3 text-xs text-text-3">{formatDateTime(u.createdAt)}</td>
                <td className="px-4 py-3">
                  <div className="flex items-center justify-end gap-2">
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={(e) => {
                        e.stopPropagation();
                        setActive(u);
                      }}
                    >
                      {tx("manage")}
                    </Button>
                    <ChevronRight size={16} className="text-text-3" aria-hidden />
                  </div>
                </td>
              </tr>
            ))}
          </TableFrame>
          <Pagination page={data.page} pageSize={data.pageSize} total={data.total} onPage={setPage} />
        </>
      )}

      {active && <ModerateDialog user={active} requireTotp={Boolean(me?.totpEnabled)} onClose={() => setActive(null)} />}
    </div>
  );
}

function ModerateDialog({
  user,
  requireTotp,
  onClose,
}: {
  user: Row;
  requireTotp: boolean;
  onClose: () => void;
}): React.JSX.Element {
  const tx = useTranslations("adminUsers");
  const qc = useQueryClient();
  const toast = useToast();
  const [action, setAction] = useState<Action>(user.status === "active" ? "freeze" : "restore");
  const [reason, setReason] = useState("");
  const [totp, setTotp] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Step-up: freezing or restoring an account cuts off or restores a user's
  // access to their own funds, so the server re-verifies the admin's own TOTP.
  const totpOk = !requireTotp || totp.length >= 6;

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      await adminApi.adminModerateUser(user.id, action, { reason, totpCode: totp || undefined });
      toast.success(tx("toastTitle", { action }), user.email);
      onClose();
      void qc.invalidateQueries({ queryKey: ["admin"] });
    } catch (err) {
      setError(apiErrorMessage(err, tx("actionFailed")));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open onClose={onClose} title={tx("dialogTitle", { email: user.email })} description={tx("dialogDescription", { status: user.status })}>
      <div className="space-y-4">
        {error && <Alert tone="danger">{error}</Alert>}
        <div>
          <p className="mb-1.5 text-sm font-medium">{tx("actionLabel")}</p>
          <Segmented
            value={action}
            onChange={setAction}
            aria-label={tx("moderationAria")}
            className="w-full"
            options={[
              { value: "freeze", label: tx("optionFreeze"), tone: "default" },
              { value: "suspend", label: tx("optionSuspend"), tone: "danger" },
              { value: "restore", label: tx("optionRestore"), tone: "success" },
            ]}
          />
          <p className="mt-1.5 text-xs text-text-3">
            {tx("actionHelp")}
          </p>
        </div>
        <Field label={tx("reasonLabel")} required>
          {(p) => <Textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder={tx("reasonPlaceholder")} {...p} />}
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
          <Button
            variant={action === "restore" ? "primary" : "danger"}
            className="flex-1"
            onClick={submit}
            disabled={busy || reason.trim().length < 5 || !totpOk}
          >
            {busy ? <Spinner /> : tx("confirmAction", { action })}
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
