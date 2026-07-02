"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Ban, Pause, Play } from "lucide-react";
import { AdminTitle } from "@/components/admin/admin-ui";
import { TotpActionDialog } from "@/components/admin/totp-dialog";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert } from "@/components/ui/alert";
import { useToast } from "@/components/ui/toast";
import { adminApi } from "@/lib/api/admin-client";
import { useAdminKillSwitch } from "@/hooks/use-admin";
import { apiErrorMessage } from "@/lib/api/errors";

type Target = "withdrawals" | "trades";

export default function AdminSettingsPage(): React.JSX.Element {
  const { data, isLoading } = useAdminKillSwitch();
  const qc = useQueryClient();
  const toast = useToast();
  const [pending, setPending] = useState<{ target: Target; paused: boolean } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (v: { totpCode: string; reason?: string }) => {
    if (!pending) return;
    setBusy(true);
    setError(null);
    try {
      await adminApi.adminSetKillSwitch({
        target: pending.target,
        paused: pending.paused,
        totpCode: v.totpCode,
        reason: v.reason ?? "",
      });
      toast.success(pending.paused ? "Paused" : "Resumed", `${pending.target} ${pending.paused ? "halted" : "resumed"}.`);
      setPending(null);
      void qc.invalidateQueries({ queryKey: ["admin", "kill-switch"] });
    } catch (err) {
      setError(apiErrorMessage(err, "Could not update"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-5">
      <AdminTitle title="Settings & controls" subtitle="Emergency kill switches and platform configuration." />

      <Alert tone="warning" title="Kill switches act immediately">
        Pausing withdrawals or trades halts the relevant queues within seconds. Use during incidents; every toggle is
        2FA-verified and audit-logged.
      </Alert>

      {isLoading ? (
        <Skeleton className="h-40 w-full rounded-xl" />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          <KillCard
            title="Withdrawals"
            description="Stop all withdrawal processing and new requests."
            paused={data?.withdrawalsPaused ?? false}
            onToggle={(paused) => { setError(null); setPending({ target: "withdrawals", paused }); }}
          />
          <KillCard
            title="Trading"
            description="Stop opening new trades (in-flight trades continue)."
            paused={data?.tradesPaused ?? false}
            onToggle={(paused) => { setError(null); setPending({ target: "trades", paused }); }}
          />
        </div>
      )}

      <TotpActionDialog
        open={Boolean(pending)}
        onClose={() => setPending(null)}
        title={pending ? `${pending.paused ? "Pause" : "Resume"} ${pending.target}` : ""}
        description={pending?.paused ? "This halts the queue immediately." : "This resumes normal processing."}
        actionLabel={pending?.paused ? "Pause now" : "Resume"}
        destructive={pending?.paused}
        reasonLabel="Reason"
        reasonRequired
        busy={busy}
        error={error}
        onConfirm={submit}
      />
    </div>
  );
}

function KillCard({
  title,
  description,
  paused,
  onToggle,
}: {
  title: string;
  description: string;
  paused: boolean;
  onToggle: (paused: boolean) => void;
}): React.JSX.Element {
  return (
    <Card className={paused ? "border-danger/30 bg-danger/5" : ""}>
      <div className="flex items-start justify-between">
        <div>
          <p className="font-medium">{title}</p>
          <p className="mt-0.5 text-sm text-text-2">{description}</p>
        </div>
        <Badge tone={paused ? "danger" : "success"} icon={paused ? <Ban size={11} /> : undefined}>
          {paused ? "Paused" : "Live"}
        </Badge>
      </div>
      <div className="mt-4">
        {paused ? (
          <Button size="sm" onClick={() => onToggle(false)}>
            <Play size={14} /> Resume {title.toLowerCase()}
          </Button>
        ) : (
          <Button size="sm" variant="danger" onClick={() => onToggle(true)}>
            <Pause size={14} /> Pause {title.toLowerCase()}
          </Button>
        )}
      </div>
    </Card>
  );
}
