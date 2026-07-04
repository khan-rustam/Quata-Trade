"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useQuery } from "@tanstack/react-query";
import { KeyRound, Lock, Monitor, ShieldCheck } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Dialog } from "@/components/ui/dialog";
import { OtpInput } from "@/components/ui/otp-input";
import { Alert } from "@/components/ui/alert";
import { Spinner } from "@/components/ui/spinner";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/components/ui/toast";
import { useMe } from "@/hooks/use-auth";
import { api } from "@/lib/api/client";
import { qk } from "@/lib/api/query-keys";
import { apiErrorMessage } from "@/lib/api/errors";
import { formatDateTime } from "@/lib/format";

export default function SecurityPage(): React.JSX.Element {
  const tx = useTranslations("accountSecurity");
  const { data: me, refetch } = useMe();

  return (
    <div className="mx-auto max-w-lg space-y-5">
      <PageHeader title={tx("title")} subtitle={tx("subtitle")} backHref="/account" />

      {/* 2FA */}
      <Card>
        <div className="flex items-start justify-between">
          <div className="flex gap-3">
            <ShieldCheck size={20} className="mt-0.5 text-accent-400" />
            <div>
              <p className="font-medium">{tx("twoFactorTitle")}</p>
              <p className="text-sm text-text-2">{tx("twoFactorDesc")}</p>
            </div>
          </div>
          {me ? (
            <Badge tone={me.totpEnabled ? "success" : "neutral"}>{me.totpEnabled ? tx("on") : tx("off")}</Badge>
          ) : (
            <Skeleton className="h-5 w-10" />
          )}
        </div>
        {me && !me.totpEnabled && <TwoFactorSetup onEnabled={() => void refetch()} />}
        {me?.totpEnabled && <TwoFactorDisable onDisabled={() => void refetch()} />}
      </Card>

      {/* PIN */}
      <Card>
        <div className="flex items-start justify-between">
          <div className="flex gap-3">
            <KeyRound size={20} className="mt-0.5 text-accent-400" />
            <div>
              <p className="font-medium">{tx("pinTitle")}</p>
              <p className="text-sm text-text-2">{tx("pinDesc")}</p>
            </div>
          </div>
          {me ? <Badge tone={me.pinSet ? "success" : "neutral"}>{me.pinSet ? tx("set") : tx("notSet")}</Badge> : null}
        </div>
        <SetPin onDone={() => void refetch()} pinSet={Boolean(me?.pinSet)} />
      </Card>

      {/* Password */}
      <Card className="flex items-center justify-between">
        <div className="flex gap-3">
          <Lock size={20} className="mt-0.5 text-accent-400" />
          <div>
            <p className="font-medium">{tx("passwordTitle")}</p>
            <p className="text-sm text-text-2">{tx("passwordDesc")}</p>
          </div>
        </div>
        <Link href="/forgot">
          <Button size="sm" variant="secondary">
            {tx("reset")}
          </Button>
        </Link>
      </Card>

      <Sessions />
    </div>
  );
}

function TwoFactorSetup({ onEnabled }: { onEnabled: () => void }): React.JSX.Element {
  const tx = useTranslations("accountSecurity");
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { data, isFetching, refetch } = useQuery({
    queryKey: ["totp-setup"],
    queryFn: () => api.totpSetup(),
    enabled: false,
  });

  const start = async () => {
    setOpen(true);
    setError(null);
    await refetch();
  };

  const enable = async () => {
    setBusy(true);
    setError(null);
    try {
      await api.totpEnable({ code });
      toast.success(tx("twoFactorEnabledToastTitle"), tx("twoFactorEnabledToastBody"));
      setOpen(false);
      onEnabled();
    } catch (err) {
      setError(apiErrorMessage(err, tx("invalidCode")));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mt-3">
      <Button size="sm" onClick={start}>
        {tx("enable2fa")}
      </Button>
      <Dialog open={open} onClose={() => setOpen(false)} title={tx("setupTwoFactorTitle")} description={tx("setupTwoFactorDesc")}>
        <div className="space-y-4">
          <div className="flex justify-center">
            {isFetching || !data ? (
              <Skeleton className="h-40 w-40 rounded-xl" />
            ) : (
              <Image src={data.qrDataUrl} alt={tx("qrAlt")} width={160} height={160} className="rounded-xl bg-white p-2" unoptimized />
            )}
          </div>
          {error && <Alert tone="danger">{error}</Alert>}
          <OtpInput value={code} onChange={setCode} aria-label={tx("authenticatorCodeLabel")} invalid={Boolean(error)} />
          <Button className="w-full" onClick={enable} disabled={busy || code.length < 6}>
            {busy ? <Spinner /> : tx("verifyEnable")}
          </Button>
        </div>
      </Dialog>
    </div>
  );
}

function TwoFactorDisable({ onDisabled }: { onDisabled: () => void }): React.JSX.Element {
  const tx = useTranslations("accountSecurity");
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const disable = async () => {
    setBusy(true);
    setError(null);
    try {
      await api.totpDisable({ code });
      toast.success(tx("twoFactorDisabledToastTitle"), tx("twoFactorDisabledToastBody"));
      setOpen(false);
      setCode("");
      onDisabled();
    } catch (err) {
      setError(apiErrorMessage(err, tx("invalidCode")));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mt-3">
      <Button
        size="sm"
        variant="secondary"
        className="text-danger"
        onClick={() => {
          setError(null);
          setCode("");
          setOpen(true);
        }}
      >
        {tx("disable2fa")}
      </Button>
      <Dialog open={open} onClose={() => setOpen(false)} title={tx("disableTwoFactorTitle")} description={tx("disableTwoFactorDesc")}>
        <div className="space-y-4">
          {error && <Alert tone="danger">{error}</Alert>}
          <Alert tone="warning">{tx("disableWarning")}</Alert>
          <OtpInput value={code} onChange={setCode} aria-label={tx("authenticatorCodeLabel")} invalid={Boolean(error)} />
          <Button variant="danger" className="w-full" onClick={disable} disabled={busy || code.length < 6}>
            {busy ? <Spinner /> : tx("confirmDisable")}
          </Button>
        </div>
      </Dialog>
    </div>
  );
}

function SetPin({ onDone, pinSet }: { onDone: () => void; pinSet: boolean }): React.JSX.Element {
  const tx = useTranslations("accountSecurity");
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [pin, setPin] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      await api.setPin({ pin, currentPassword: password });
      toast.success(pinSet ? tx("pinUpdated") : tx("pinSetToast"));
      setOpen(false);
      setPin("");
      setPassword("");
      onDone();
    } catch (err) {
      setError(apiErrorMessage(err, tx("couldNotSetPin")));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mt-3">
      <Button size="sm" variant="secondary" onClick={() => setOpen(true)}>
        {pinSet ? tx("changePin") : tx("setPin")}
      </Button>
      <Dialog open={open} onClose={() => setOpen(false)} title={pinSet ? tx("changePinTitle") : tx("setPinTitle")}>
        <div className="space-y-4">
          {error && <Alert tone="danger">{error}</Alert>}
          <div className="space-y-2">
            <label className="text-sm font-medium">{tx("newPinLabel")}</label>
            <OtpInput value={pin} onChange={setPin} aria-label={tx("newPinAria")} />
          </div>
          <Field label={tx("confirmPassword")} required>
            {(p) => (
              <Input type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} {...p} />
            )}
          </Field>
          <Button className="w-full" onClick={submit} disabled={busy || pin.length < 6 || !password}>
            {busy ? <Spinner /> : tx("savePin")}
          </Button>
        </div>
      </Dialog>
    </div>
  );
}

function Sessions(): React.JSX.Element {
  const tx = useTranslations("accountSecurity");
  const toast = useToast();
  const { data, isLoading, refetch } = useQuery({ queryKey: qk.sessions, queryFn: () => api.sessions() });

  const revoke = async (id: string) => {
    try {
      await api.revokeSession(id);
      toast.success(tx("sessionRevoked"));
      void refetch();
    } catch (err) {
      toast.error(tx("couldNotRevoke"), apiErrorMessage(err));
    }
  };

  return (
    <div>
      <h2 className="mb-2 flex items-center gap-2 font-display text-lg font-medium">
        <Monitor size={18} /> {tx("activeSessions")}
      </h2>
      {isLoading ? (
        <Skeleton className="h-20 w-full rounded-xl" />
      ) : (
        <div className="divide-y divide-border overflow-hidden rounded-xl border border-border">
          {data?.sessions.map((s) => (
            <div key={s.id} className="flex items-center justify-between px-4 py-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">
                  {s.userAgent ?? tx("unknownDevice")}
                  {s.current && <span className="ml-2 text-xs text-accent-400">{tx("thisDevice")}</span>}
                </p>
                <p className="text-xs text-text-3">
                  {s.ip ?? "—"} · {formatDateTime(s.createdAt)}
                </p>
              </div>
              {!s.current && (
                <Button size="sm" variant="ghost" className="text-danger" onClick={() => revoke(s.id)}>
                  {tx("revoke")}
                </Button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
