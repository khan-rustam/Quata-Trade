"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
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
  const { data: me, refetch } = useMe();

  return (
    <div className="mx-auto max-w-lg space-y-5">
      <PageHeader title="Security center" subtitle="Protect your account and your funds." backHref="/account" />

      {/* 2FA */}
      <Card>
        <div className="flex items-start justify-between">
          <div className="flex gap-3">
            <ShieldCheck size={20} className="mt-0.5 text-accent-400" />
            <div>
              <p className="font-medium">Two-factor authentication</p>
              <p className="text-sm text-text-2">Required for withdrawals and releasing escrow.</p>
            </div>
          </div>
          {me ? (
            <Badge tone={me.totpEnabled ? "success" : "neutral"}>{me.totpEnabled ? "On" : "Off"}</Badge>
          ) : (
            <Skeleton className="h-5 w-10" />
          )}
        </div>
        {me && !me.totpEnabled && <TwoFactorSetup onEnabled={() => void refetch()} />}
      </Card>

      {/* PIN */}
      <Card>
        <div className="flex items-start justify-between">
          <div className="flex gap-3">
            <KeyRound size={20} className="mt-0.5 text-accent-400" />
            <div>
              <p className="font-medium">Transaction PIN</p>
              <p className="text-sm text-text-2">A 6-digit PIN for confirming money actions.</p>
            </div>
          </div>
          {me ? <Badge tone={me.pinSet ? "success" : "neutral"}>{me.pinSet ? "Set" : "Not set"}</Badge> : null}
        </div>
        <SetPin onDone={() => void refetch()} pinSet={Boolean(me?.pinSet)} />
      </Card>

      {/* Password */}
      <Card className="flex items-center justify-between">
        <div className="flex gap-3">
          <Lock size={20} className="mt-0.5 text-accent-400" />
          <div>
            <p className="font-medium">Password</p>
            <p className="text-sm text-text-2">Reset it via a secure email link.</p>
          </div>
        </div>
        <Link href="/forgot">
          <Button size="sm" variant="secondary">
            Reset
          </Button>
        </Link>
      </Card>

      <Sessions />
    </div>
  );
}

function TwoFactorSetup({ onEnabled }: { onEnabled: () => void }): React.JSX.Element {
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
      toast.success("Two-factor enabled", "Your account is better protected now.");
      setOpen(false);
      onEnabled();
    } catch (err) {
      setError(apiErrorMessage(err, "Invalid code"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mt-3">
      <Button size="sm" onClick={start}>
        Enable 2FA
      </Button>
      <Dialog open={open} onClose={() => setOpen(false)} title="Set up two-factor" description="Scan the QR with your authenticator app, then enter the 6-digit code.">
        <div className="space-y-4">
          <div className="flex justify-center">
            {isFetching || !data ? (
              <Skeleton className="h-40 w-40 rounded-xl" />
            ) : (
              <Image src={data.qrDataUrl} alt="Authenticator QR code" width={160} height={160} className="rounded-xl bg-white p-2" unoptimized />
            )}
          </div>
          {error && <Alert tone="danger">{error}</Alert>}
          <OtpInput value={code} onChange={setCode} aria-label="Authenticator code" invalid={Boolean(error)} />
          <Button className="w-full" onClick={enable} disabled={busy || code.length < 6}>
            {busy ? <Spinner /> : "Verify & enable"}
          </Button>
        </div>
      </Dialog>
    </div>
  );
}

function SetPin({ onDone, pinSet }: { onDone: () => void; pinSet: boolean }): React.JSX.Element {
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
      toast.success(pinSet ? "PIN updated" : "PIN set");
      setOpen(false);
      setPin("");
      setPassword("");
      onDone();
    } catch (err) {
      setError(apiErrorMessage(err, "Could not set PIN"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mt-3">
      <Button size="sm" variant="secondary" onClick={() => setOpen(true)}>
        {pinSet ? "Change PIN" : "Set PIN"}
      </Button>
      <Dialog open={open} onClose={() => setOpen(false)} title={pinSet ? "Change your PIN" : "Set a transaction PIN"}>
        <div className="space-y-4">
          {error && <Alert tone="danger">{error}</Alert>}
          <div className="space-y-2">
            <label className="text-sm font-medium">New 6-digit PIN</label>
            <OtpInput value={pin} onChange={setPin} aria-label="New PIN" />
          </div>
          <Field label="Confirm with your password" required>
            {(p) => (
              <Input type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} {...p} />
            )}
          </Field>
          <Button className="w-full" onClick={submit} disabled={busy || pin.length < 6 || !password}>
            {busy ? <Spinner /> : "Save PIN"}
          </Button>
        </div>
      </Dialog>
    </div>
  );
}

function Sessions(): React.JSX.Element {
  const toast = useToast();
  const { data, isLoading, refetch } = useQuery({ queryKey: qk.sessions, queryFn: () => api.sessions() });

  const revoke = async (id: string) => {
    try {
      await api.revokeSession(id);
      toast.success("Session revoked");
      void refetch();
    } catch (err) {
      toast.error("Could not revoke", apiErrorMessage(err));
    }
  };

  return (
    <div>
      <h2 className="mb-2 flex items-center gap-2 font-display text-lg font-medium">
        <Monitor size={18} /> Active sessions
      </h2>
      {isLoading ? (
        <Skeleton className="h-20 w-full rounded-xl" />
      ) : (
        <div className="divide-y divide-border overflow-hidden rounded-xl border border-border">
          {data?.sessions.map((s) => (
            <div key={s.id} className="flex items-center justify-between px-4 py-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">
                  {s.userAgent ?? "Unknown device"}
                  {s.current && <span className="ml-2 text-xs text-accent-400">This device</span>}
                </p>
                <p className="text-xs text-text-3">
                  {s.ip ?? "—"} · {formatDateTime(s.createdAt)}
                </p>
              </div>
              {!s.current && (
                <Button size="sm" variant="ghost" className="text-danger" onClick={() => revoke(s.id)}>
                  Revoke
                </Button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
