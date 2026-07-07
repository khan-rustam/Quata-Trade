"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { UserPlus, ShieldCheck, ShieldOff, Power, KeyRound } from "lucide-react";
import { ADMIN_ROLES, zCreateAdminRequest, type AdminAccount, type AdminRole } from "@quatatrade/shared";
import { AdminTitle, TableFrame } from "@/components/admin/admin-ui";
import { TotpActionDialog } from "@/components/admin/totp-dialog";
import { Card } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/components/ui/toast";
import { adminApi } from "@/lib/api/admin-client";
import { apiErrorMessage } from "@/lib/api/errors";

/** Pending, TOTP-gated action awaiting confirmation. */
type Pending =
  | { kind: "create"; email: string; role: AdminRole; password: string }
  | { kind: "role"; id: string; email: string; role: AdminRole }
  | { kind: "active"; id: string; email: string; active: boolean }
  | { kind: "reset"; id: string; email: string };

const roleLabel = (r: AdminRole) => r.charAt(0) + r.slice(1).toLowerCase().replace(/_/g, " ");

export default function TeamPage(): React.JSX.Element {
  const tx = useTranslations("adminTeam");
  const toast = useToast();
  const qc = useQueryClient();

  const { data, isLoading, error } = useQuery({ queryKey: ["admin", "team"], queryFn: () => adminApi.adminTeam() });
  const { data: me } = useQuery({ queryKey: ["admin", "me"], queryFn: () => adminApi.adminMe() });

  const [email, setEmail] = useState("");
  const [role, setRole] = useState<AdminRole>("SUPPORT_ADMIN");
  const [password, setPassword] = useState("");
  const [createError, setCreateError] = useState<string | null>(null);

  const [pending, setPending] = useState<Pending | null>(null);
  const [busy, setBusy] = useState(false);
  const [dialogError, setDialogError] = useState<string | null>(null);

  const roleOptions = ADMIN_ROLES.map((r) => ({ value: r, label: roleLabel(r) }));

  const openCreate = () => {
    setCreateError(null);
    const parsed = zCreateAdminRequest.safeParse({ email, role, password });
    if (!parsed.success) {
      setCreateError(parsed.error.issues[0]?.message ?? tx("createInvalid"));
      return;
    }
    setDialogError(null);
    setPending({ kind: "create", email: parsed.data.email, role: parsed.data.role, password: parsed.data.password });
  };

  const confirm = async (v: { totpCode: string }) => {
    if (!pending) return;
    setBusy(true);
    setDialogError(null);
    try {
      if (pending.kind === "create") {
        await adminApi.adminCreateAdmin({ email: pending.email, role: pending.role, password: pending.password, totpCode: v.totpCode });
        setEmail("");
        setPassword("");
        setRole("SUPPORT_ADMIN");
        toast.success(tx("createdTitle"), tx("createdBody", { email: pending.email }));
      } else if (pending.kind === "role") {
        await adminApi.adminUpdateAdmin(pending.id, { role: pending.role, totpCode: v.totpCode });
        toast.success(tx("updatedTitle"), tx("roleChangedBody", { email: pending.email, role: roleLabel(pending.role) }));
      } else if (pending.kind === "active") {
        await adminApi.adminUpdateAdmin(pending.id, { active: pending.active, totpCode: v.totpCode });
        toast.success(tx("updatedTitle"), tx(pending.active ? "activatedBody" : "deactivatedBody", { email: pending.email }));
      } else {
        await adminApi.adminResetAdminTotp(pending.id, { totpCode: v.totpCode });
        toast.success(tx("resetTitle"), tx("resetBody", { email: pending.email }));
      }
      await qc.invalidateQueries({ queryKey: ["admin", "team"] });
      setPending(null);
    } catch (err) {
      setDialogError(apiErrorMessage(err, tx("actionError")));
    } finally {
      setBusy(false);
    }
  };

  const dialogCopy = (): { title: string; description: string; destructive: boolean } => {
    if (!pending) return { title: "", description: "", destructive: false };
    switch (pending.kind) {
      case "create":
        return { title: tx("confirmCreateTitle"), description: tx("confirmCreate", { email: pending.email, role: roleLabel(pending.role) }), destructive: false };
      case "role":
        return { title: tx("confirmRoleTitle"), description: tx("confirmRole", { email: pending.email, role: roleLabel(pending.role) }), destructive: false };
      case "active":
        return {
          title: pending.active ? tx("confirmActivateTitle") : tx("confirmDeactivateTitle"),
          description: tx(pending.active ? "confirmActivate" : "confirmDeactivate", { email: pending.email }),
          destructive: !pending.active,
        };
      case "reset":
        return { title: tx("confirmResetTitle"), description: tx("confirmReset", { email: pending.email }), destructive: true };
    }
  };
  const copy = dialogCopy();

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <AdminTitle title={tx("pageTitle")} subtitle={tx("pageSubtitle")} />

      <Alert tone="warning" title={tx("warnTitle")}>
        {tx("warnBody")}
      </Alert>

      {/* create */}
      <Card className="space-y-4">
        <p className="flex items-center gap-1.5 font-medium">
          <UserPlus size={16} className="text-accent-400" /> {tx("createTitle")}
        </p>
        {createError && <Alert tone="danger">{createError}</Alert>}
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label={tx("emailLabel")}>
            {(p) => <Input {...p} type="email" value={email} onChange={(e) => setEmail(e.target.value.trim())} placeholder={tx("emailPlaceholder")} autoComplete="off" />}
          </Field>
          <Field label={tx("roleLabel")}>
            {(p) => <Select {...p} options={roleOptions} value={role} onChange={(e) => setRole(e.target.value as AdminRole)} />}
          </Field>
        </div>
        <Field label={tx("passwordLabel")} hint={tx("passwordHint")}>
          {(p) => <PasswordInput {...p} value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" placeholder={tx("passwordPlaceholder")} />}
        </Field>
        <Button onClick={openCreate} disabled={!email || !password}>
          {tx("addAdmin")}
        </Button>
      </Card>

      {/* team list */}
      <Card className="space-y-3">
        <p className="font-medium">{tx("listTitle")}</p>
        {isLoading ? (
          <Skeleton className="h-40 w-full" />
        ) : error || !data ? (
          <Alert tone="danger">{apiErrorMessage(error, tx("loadError"))}</Alert>
        ) : (
          <TableFrame
            head={
              <tr>
                <th className="px-3 py-2 font-medium">{tx("colEmail")}</th>
                <th className="px-3 py-2 font-medium">{tx("colRole")}</th>
                <th className="px-3 py-2 font-medium">{tx("colStatus")}</th>
                <th className="px-3 py-2 font-medium">{tx("col2fa")}</th>
                <th className="px-3 py-2 font-medium text-right">{tx("colActions")}</th>
              </tr>
            }
          >
            {data.admins.map((a: AdminAccount) => {
              const isSelf = me?.id === a.id;
              return (
                <tr key={a.id} className="align-middle">
                  <td className="px-3 py-2">
                    {a.email}
                    {isSelf && <span className="ml-1.5 text-xs text-text-3">({tx("you")})</span>}
                  </td>
                  <td className="px-3 py-2">
                    <Select
                      className="min-w-40"
                      options={roleOptions}
                      value={a.role}
                      disabled={isSelf}
                      aria-label={tx("colRole")}
                      onChange={(e) => {
                        const next = e.target.value as AdminRole;
                        if (next !== a.role) {
                          setDialogError(null);
                          setPending({ kind: "role", id: a.id, email: a.email, role: next });
                        }
                      }}
                    />
                  </td>
                  <td className="px-3 py-2">
                    {a.active ? (
                      <Badge tone="success" icon={<ShieldCheck size={12} />}>
                        {tx("statusActive")}
                      </Badge>
                    ) : (
                      <Badge tone="danger" icon={<ShieldOff size={12} />}>
                        {tx("statusInactive")}
                      </Badge>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    {a.totpEnabled ? (
                      <Badge tone="success">{tx("twofaOn")}</Badge>
                    ) : (
                      <Badge tone="warning">{tx("twofaOff")}</Badge>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex justify-end gap-1.5">
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => {
                          setDialogError(null);
                          setPending({ kind: "reset", id: a.id, email: a.email });
                        }}
                        title={tx("reset2fa")}
                      >
                        <KeyRound size={13} /> {tx("reset2fa")}
                      </Button>
                      <Button
                        size="sm"
                        variant={a.active ? "danger" : "primary"}
                        disabled={isSelf && a.active}
                        onClick={() => {
                          setDialogError(null);
                          setPending({ kind: "active", id: a.id, email: a.email, active: !a.active });
                        }}
                        title={a.active ? tx("deactivate") : tx("activate")}
                      >
                        <Power size={13} /> {a.active ? tx("deactivate") : tx("activate")}
                      </Button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </TableFrame>
        )}
      </Card>

      <TotpActionDialog
        open={pending !== null}
        onClose={() => setPending(null)}
        title={copy.title}
        description={copy.description}
        actionLabel={copy.title}
        destructive={copy.destructive}
        requireTotp
        busy={busy}
        error={dialogError}
        onConfirm={confirm}
      />
    </div>
  );
}
