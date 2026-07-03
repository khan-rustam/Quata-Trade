"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
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
import { useAdminKillSwitch, useAdminMe } from "@/hooks/use-admin";
import { apiErrorMessage } from "@/lib/api/errors";

type Target = "withdrawals" | "trades";

export default function AdminSettingsPage(): React.JSX.Element {
  const tx = useTranslations("adminSettings");
  const { data, isLoading } = useAdminKillSwitch();
  const { data: me } = useAdminMe();
  const qc = useQueryClient();
  const toast = useToast();
  const [pending, setPending] = useState<{ target: Target; paused: boolean } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const targetLabel = (target: Target) =>
    tx(target === "withdrawals" ? "targetWithdrawals" : "targetTrades");

  const submit = async (v: { totpCode: string; reason?: string }) => {
    if (!pending) return;
    setBusy(true);
    setError(null);
    try {
      await adminApi.adminSetKillSwitch({
        target: pending.target,
        paused: pending.paused,
        totpCode: v.totpCode || undefined,
        reason: v.reason ?? "",
      });
      toast.success(
        pending.paused ? tx("toastPausedTitle") : tx("toastResumedTitle"),
        tx(pending.paused ? "toastPausedDetail" : "toastResumedDetail", {
          target: targetLabel(pending.target),
        }),
      );
      setPending(null);
      void qc.invalidateQueries({ queryKey: ["admin", "kill-switch"] });
    } catch (err) {
      setError(apiErrorMessage(err, tx("errorUpdate")));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-5">
      <AdminTitle title={tx("pageTitle")} subtitle={tx("pageSubtitle")} />

      <Alert tone="warning" title={tx("alertTitle")}>
        {tx("alertBody")}
      </Alert>

      {isLoading ? (
        <Skeleton className="h-40 w-full rounded-xl" />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          <KillCard
            title={tx("withdrawalsTitle")}
            description={tx("withdrawalsDesc")}
            paused={data?.withdrawalsPaused ?? false}
            onToggle={(paused) => { setError(null); setPending({ target: "withdrawals", paused }); }}
          />
          <KillCard
            title={tx("tradingTitle")}
            description={tx("tradingDesc")}
            paused={data?.tradesPaused ?? false}
            onToggle={(paused) => { setError(null); setPending({ target: "trades", paused }); }}
          />
        </div>
      )}

      <TotpActionDialog
        open={Boolean(pending)}
        onClose={() => setPending(null)}
        title={pending ? tx(pending.paused ? "dialogTitlePause" : "dialogTitleResume", { target: targetLabel(pending.target) }) : ""}
        description={pending?.paused ? tx("dialogDescPause") : tx("dialogDescResume")}
        actionLabel={pending?.paused ? tx("actionPauseNow") : tx("actionResume")}
        destructive={pending?.paused}
        reasonLabel={tx("reasonLabel")}
        reasonRequired
        requireTotp={Boolean(me?.totpEnabled)}
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
  const tx = useTranslations("adminSettings");
  return (
    <Card className={paused ? "border-danger/30 bg-danger/5" : ""}>
      <div className="flex items-start justify-between">
        <div>
          <p className="font-medium">{title}</p>
          <p className="mt-0.5 text-sm text-text-2">{description}</p>
        </div>
        <Badge tone={paused ? "danger" : "success"} icon={paused ? <Ban size={11} /> : undefined}>
          {paused ? tx("badgePaused") : tx("badgeLive")}
        </Badge>
      </div>
      <div className="mt-4">
        {paused ? (
          <Button size="sm" onClick={() => onToggle(false)}>
            <Play size={14} /> {tx("resumeAction", { target: title.toLowerCase() })}
          </Button>
        ) : (
          <Button size="sm" variant="danger" onClick={() => onToggle(true)}>
            <Pause size={14} /> {tx("pauseAction", { target: title.toLowerCase() })}
          </Button>
        )}
      </div>
    </Card>
  );
}
