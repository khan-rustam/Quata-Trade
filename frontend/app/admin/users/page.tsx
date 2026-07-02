"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Search, Users } from "lucide-react";
import type { z } from "zod";
import { zAdminUserRow } from "@quatatrade/shared";
import { AdminTitle, Pagination, TableFrame } from "@/components/admin/admin-ui";
import { Dialog } from "@/components/ui/dialog";
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
import { useAdminUsers } from "@/hooks/use-admin";
import { apiErrorMessage } from "@/lib/api/errors";
import { formatDateTime } from "@/lib/format";

type Row = z.infer<typeof zAdminUserRow>;
type Action = "freeze" | "suspend" | "restore";

const STATUS_TONE = { active: "success", frozen: "warning", suspended: "danger", closed: "neutral" } as const;

export default function AdminUsersPage(): React.JSX.Element {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const { data, isLoading } = useAdminUsers(page, debounced || undefined);
  const [active, setActive] = useState<Row | null>(null);

  return (
    <div className="space-y-5">
      <AdminTitle title="Users" subtitle="Search, review, and moderate accounts." />

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
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by email…" className="pl-9" aria-label="Search users" />
        </div>
        <Button type="submit" variant="secondary">
          Search
        </Button>
      </form>

      {isLoading ? (
        <Skeleton className="h-64 w-full rounded-xl" />
      ) : !data || data.items.length === 0 ? (
        <EmptyState icon={Users} title="No users found" description="Try a different search." />
      ) : (
        <>
          <TableFrame
            head={
              <tr>
                <th className="px-4 py-2.5">Email</th>
                <th className="px-4 py-2.5">KYC</th>
                <th className="px-4 py-2.5">Status</th>
                <th className="px-4 py-2.5">Joined</th>
                <th className="px-4 py-2.5 text-right">Action</th>
              </tr>
            }
          >
            {data.items.map((u) => (
              <tr key={u.id}>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2.5">
                    <Avatar seed={u.id} size={32} />
                    <div className="min-w-0">
                      <p className="truncate">{u.email}</p>
                      {u.phone && <p className="text-xs text-text-3">{u.phone}</p>}
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3"><Badge tone={u.kycStatus === "APPROVED" ? "success" : "neutral"}>T{u.kycTier} · {u.kycStatus.toLowerCase()}</Badge></td>
                <td className="px-4 py-3"><Badge tone={STATUS_TONE[u.status]}>{u.status}</Badge></td>
                <td className="px-4 py-3 text-xs text-text-3">{formatDateTime(u.createdAt)}</td>
                <td className="px-4 py-3 text-right">
                  <Button size="sm" variant="secondary" onClick={() => setActive(u)}>
                    Manage
                  </Button>
                </td>
              </tr>
            ))}
          </TableFrame>
          <Pagination page={data.page} pageSize={data.pageSize} total={data.total} onPage={setPage} />
        </>
      )}

      {active && <ModerateDialog user={active} onClose={() => setActive(null)} />}
    </div>
  );
}

function ModerateDialog({ user, onClose }: { user: Row; onClose: () => void }): React.JSX.Element {
  const qc = useQueryClient();
  const toast = useToast();
  const [action, setAction] = useState<Action>(user.status === "active" ? "freeze" : "restore");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      await adminApi.adminModerateUser(user.id, action, { reason });
      toast.success(`User ${action}d`, user.email);
      onClose();
      void qc.invalidateQueries({ queryKey: ["admin"] });
    } catch (err) {
      setError(apiErrorMessage(err, "Action failed"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open onClose={onClose} title={`Manage ${user.email}`} description={`Current status: ${user.status}`}>
      <div className="space-y-4">
        {error && <Alert tone="danger">{error}</Alert>}
        <div>
          <p className="mb-1.5 text-sm font-medium">Action</p>
          <Segmented
            value={action}
            onChange={setAction}
            aria-label="Moderation action"
            className="w-full"
            options={[
              { value: "freeze", label: "Freeze", tone: "default" },
              { value: "suspend", label: "Suspend", tone: "danger" },
              { value: "restore", label: "Restore", tone: "success" },
            ]}
          />
          <p className="mt-1.5 text-xs text-text-3">
            Freeze blocks trading & withdrawals. Suspend is stronger. Restore reactivates.
          </p>
        </div>
        <Field label="Reason" required>
          {(p) => <Textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Audit reason (min 5 characters)…" {...p} />}
        </Field>
        <div className="flex gap-2">
          <Button variant="secondary" className="flex-1" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button variant={action === "restore" ? "primary" : "danger"} className="flex-1" onClick={submit} disabled={busy || reason.trim().length < 5}>
            {busy ? <Spinner /> : `Confirm ${action}`}
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
