"use client";

import { useState } from "react";
import Image from "next/image";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { ShieldCheck } from "lucide-react";
import { AdminTitle } from "@/components/admin/admin-ui";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { OtpInput } from "@/components/ui/otp-input";
import { Alert } from "@/components/ui/alert";
import { Spinner } from "@/components/ui/spinner";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/components/ui/toast";
import { adminApi } from "@/lib/api/admin-client";
import { useAdminMe } from "@/hooks/use-admin";
import { apiErrorMessage } from "@/lib/api/errors";

export default function AdminProfilePage(): React.JSX.Element {
  const { data: me } = useAdminMe();
  const tx = useTranslations("adminProfile");

  return (
    <div className="max-w-lg space-y-5">
      <AdminTitle title={tx("title")} subtitle={tx("subtitle")} />

      {/* Account */}
      <Card className="space-y-3">
        <Row label={tx("emailLabel")} value={me?.email} />
        <Row label={tx("roleLabel")} value={me ? <Badge tone="accent">{me.role.replace("_", " ").toLowerCase()}</Badge> : undefined} />
      </Card>

      {/* 2FA */}
      <Card>
        <div className="flex items-start justify-between">
          <div className="flex gap-3">
            <ShieldCheck size={20} className="mt-0.5 text-accent-400" />
            <div>
              <p className="font-medium">{tx("twoFactorHeading")}</p>
              <p className="text-sm text-text-2">
                {tx("twoFactorDescription")}
              </p>
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

  const enable = async () => {
    setBusy(true);
    setError(null);
    try {
      await adminApi.adminTotpEnable({ code });
      toast.success(tx("enabledToastTitle"), tx("enabledToastBody"));
      setOpen(false);
      void qc.invalidateQueries({ queryKey: ["admin", "me"] });
    } catch (err) {
      setError(apiErrorMessage(err, tx("invalidCode")));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Button size="sm" onClick={start}>
        {tx("enableButton")}
      </Button>
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title={tx("setupTitle")}
        description={tx("setupDescription")}
      >
        <div className="space-y-4">
          <div className="flex justify-center">
            {isFetching || !data ? (
              <Skeleton className="h-40 w-40 rounded-xl" />
            ) : (
              <Image src={data.qrDataUrl} alt={tx("qrAlt")} width={160} height={160} className="rounded-xl bg-white p-2" unoptimized />
            )}
          </div>
          {error && <Alert tone="danger">{error}</Alert>}
          <OtpInput value={code} onChange={setCode} aria-label={tx("codeAriaLabel")} invalid={Boolean(error)} />
          <Button className="w-full" onClick={enable} disabled={busy || code.length < 6}>
            {busy ? <Spinner /> : tx("verifyEnable")}
          </Button>
        </div>
      </Dialog>
    </>
  );
}
