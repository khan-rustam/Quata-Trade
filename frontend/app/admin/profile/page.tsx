"use client";

import { useState } from "react";
import Image from "next/image";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { ShieldCheck } from "lucide-react";
import type { AdminUpdateProfileRequest, AvatarStyle } from "@quatatrade/shared";
import { AdminTitle } from "@/components/admin/admin-ui";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Dialog } from "@/components/ui/dialog";
import { OtpInput } from "@/components/ui/otp-input";
import { Alert } from "@/components/ui/alert";
import { Spinner } from "@/components/ui/spinner";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/components/ui/toast";
import { AvatarPicker } from "@/components/account/avatar-picker";
import { adminApi } from "@/lib/api/admin-client";
import { useAdminMe } from "@/hooks/use-admin";
import { apiErrorMessage } from "@/lib/api/errors";

export default function AdminProfilePage(): React.JSX.Element {
  const { data: me } = useAdminMe();
  const qc = useQueryClient();
  const toast = useToast();
  const tx = useTranslations("adminProfile");

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [phone, setPhone] = useState("");
  const [avatar, setAvatar] = useState<{ style: AvatarStyle | null; seed: string | null }>({ style: null, seed: null });
  const [saving, setSaving] = useState(false);
  const [loadedId, setLoadedId] = useState<string | null>(null);

  // Seed the form when `me` first arrives (adjust-state-during-render, id-guarded).
  if (me && me.id !== loadedId) {
    setLoadedId(me.id);
    setFirstName(me.firstName ?? "");
    setLastName(me.lastName ?? "");
    setDisplayName(me.displayName ?? "");
    setPhone(me.phone ?? "");
    setAvatar({ style: me.avatarStyle, seed: me.avatarSeed });
  }

  const submit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    if (!me || saving) return;
    const handle = displayName.trim();
    if (handle && (handle.length < 2 || handle.length > 24)) {
      toast.error(tx("displayNameLength"));
      return;
    }
    const body: AdminUpdateProfileRequest = {
      firstName: firstName.trim() || null,
      lastName: lastName.trim() || null,
      displayName: handle || null,
      phone: phone.trim() || null,
      avatarStyle: avatar.style,
      avatarSeed: avatar.seed,
    };
    setSaving(true);
    try {
      await adminApi.adminUpdateProfile(body);
      await qc.invalidateQueries({ queryKey: ["admin", "me"] });
      toast.success(tx("profileUpdated"));
    } catch (err) {
      toast.error(tx("couldNotUpdate"), apiErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-lg space-y-5">
      <AdminTitle title={tx("title")} subtitle={tx("subtitle")} />

      {/* Account (read-only identity) */}
      <Card className="space-y-3">
        <Row label={tx("emailLabel")} value={me?.email} />
        <Row
          label={tx("roleLabel")}
          value={me ? <Badge tone="accent">{me.role.replace("_", " ").toLowerCase()}</Badge> : undefined}
        />
      </Card>

      {/* Editable profile */}
      <form onSubmit={submit} className="space-y-5" noValidate>
        <Card className="space-y-4">
          <div>
            <p className="text-sm font-medium text-text-1">{tx("avatar")}</p>
            <p className="mt-0.5 text-xs text-text-3">{tx("avatarHint")}</p>
          </div>
          {me && <AvatarPicker userId={me.id} style={avatar.style} seed={avatar.seed} onChange={setAvatar} />}

          <Field label={tx("displayName")}>
            {(p) => (
              <Input
                {...p}
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder={tx("displayNamePlaceholder")}
                maxLength={24}
                disabled={!me}
              />
            )}
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label={tx("firstName")}>
              {(p) => (
                <Input {...p} value={firstName} onChange={(e) => setFirstName(e.target.value)} placeholder={tx("firstNamePlaceholder")} disabled={!me} />
              )}
            </Field>
            <Field label={tx("lastName")}>
              {(p) => (
                <Input {...p} value={lastName} onChange={(e) => setLastName(e.target.value)} placeholder={tx("lastNamePlaceholder")} disabled={!me} />
              )}
            </Field>
          </div>

          <Field label={tx("phone")}>
            {(p) => (
              <Input
                {...p}
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder={tx("phonePlaceholder")}
                maxLength={20}
                disabled={!me}
              />
            )}
          </Field>
        </Card>

        <Button type="submit" disabled={saving || !me}>
          {saving ? <Spinner /> : tx("saveChanges")}
        </Button>
      </form>

      {/* 2FA */}
      <Card>
        <div className="flex items-start justify-between">
          <div className="flex gap-3">
            <ShieldCheck size={20} className="mt-0.5 text-accent-400" />
            <div>
              <p className="font-medium">{tx("twoFactorHeading")}</p>
              <p className="text-sm text-text-2">{tx("twoFactorDescription")}</p>
            </div>
          </div>
          {me ? (
            <Badge tone={me.totpEnabled ? "success" : "neutral"}>{me.totpEnabled ? tx("statusOn") : tx("statusOff")}</Badge>
          ) : (
            <Skeleton className="h-5 w-10" />
          )}
        </div>

        {me && !me.totpEnabled && (
          <div className="mt-4 flex items-center gap-3">
            <TwoFactorSetup />
            <span className="text-sm text-text-3">{tx("skipHint")}</span>
          </div>
        )}
        {me?.totpEnabled && (
          <Alert tone="success" className="mt-4">
            {tx("activeAlert")}
          </Alert>
        )}
      </Card>
    </div>
  );
}

function Row({ label, value }: { label: string; value?: React.ReactNode }): React.JSX.Element {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-sm text-text-2">{label}</span>
      {value === undefined ? <Skeleton className="h-5 w-40" /> : <span className="text-sm font-medium text-text-1">{value}</span>}
    </div>
  );
}

function TwoFactorSetup(): React.JSX.Element {
  const qc = useQueryClient();
  const toast = useToast();
  const tx = useTranslations("adminProfile");
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { data, isFetching, refetch } = useQuery({
    queryKey: ["admin", "totp-setup"],
    queryFn: () => adminApi.adminTotpSetup(),
    enabled: false,
  });

  const start = async () => {
    setCode("");
    setError(null);
    setOpen(true);
    await refetch();
  };

  const enable = async (fullCode: string) => {
    if (busy || fullCode.length < 6) return;
    setBusy(true);
    setError(null);
    try {
      await adminApi.adminTotpEnable({ code: fullCode });
      toast.success(tx("enabledToastTitle"), tx("enabledToastBody"));
      setOpen(false);
      void qc.invalidateQueries({ queryKey: ["admin", "me"] });
    } catch (err) {
      setError(apiErrorMessage(err, tx("invalidCode")));
      setCode("");
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Button size="sm" onClick={start}>
        {tx("enableButton")}
      </Button>
      <Dialog open={open} onClose={() => setOpen(false)} title={tx("setupTitle")} description={tx("setupDescription")}>
        <div className="space-y-4">
          <div className="flex justify-center">
            {isFetching || !data ? (
              <Skeleton className="h-40 w-40 rounded-xl" />
            ) : (
              <Image src={data.qrDataUrl} alt={tx("qrAlt")} width={160} height={160} className="rounded-xl bg-white p-2" unoptimized />
            )}
          </div>
          {error && <Alert tone="danger">{error}</Alert>}
          {/* Auto-advances between boxes and auto-verifies when the 6th digit lands. */}
          <OtpInput
            value={code}
            onChange={setCode}
            onComplete={enable}
            autoFocus
            disabled={busy}
            aria-label={tx("codeAriaLabel")}
            invalid={Boolean(error)}
          />
          <Button className="w-full" onClick={() => void enable(code)} disabled={busy || code.length < 6}>
            {busy ? <Spinner /> : tx("verifyEnable")}
          </Button>
        </div>
      </Dialog>
    </>
  );
}
