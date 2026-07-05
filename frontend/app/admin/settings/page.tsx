"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Ban, Pause, Play } from "lucide-react";
import { fromDisplay, toDisplay, zFeeBpsValue, zWithdrawalCapsValue } from "@quatatrade/shared";
import { AdminTitle } from "@/components/admin/admin-ui";
import { TotpActionDialog } from "@/components/admin/totp-dialog";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
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

      <SettingsConfigEditor />
    </div>
  );
}

function SettingsConfigEditor(): React.JSX.Element {
  const { data, isLoading } = useQuery({ queryKey: ["admin", "settings"], queryFn: () => adminApi.adminSettings() });
  if (isLoading || !data) return <Skeleton className="h-64 w-full rounded-xl" />;
  // Key on the snapshot so the form remounts (re-seeds from props, no effect) after a save refetches.
  const feeKey = Object.values(data.feeBps).join(",");
  const capsKey = Object.values(data.withdrawalCaps).join(",");
  return (
    <ConfigForm
      key={`${data.paymentWindowMinutes}:${data.depositPolicy.minAmount}:${data.depositPolicy.confirmations}:${feeKey}:${capsKey}`}
      data={data}
    />
  );
}

function ConfigForm({ data }: { data: Awaited<ReturnType<typeof adminApi.adminSettings>> }): React.JSX.Element {
  const tx = useTranslations("adminSettings");
  const toast = useToast();
  const qc = useQueryClient();
  const { data: me } = useAdminMe();

  const [windowMin, setWindowMin] = useState(String(data.paymentWindowMinutes));
  const [depMin, setDepMin] = useState(
    toDisplay(data.depositPolicy.minAmount, "USDT_TRC20", 6).replace(/\.?0+$/, ""),
  );
  const [depConf, setDepConf] = useState(String(data.depositPolicy.confirmations));
  // fee bps per rail (as input strings) + withdrawal caps (as USDT display strings)
  const [feeBps, setFeeBps] = useState<Record<string, string>>(
    Object.fromEntries(Object.entries(data.feeBps).map(([k, v]) => [k, String(v)])),
  );
  const capToDisplay = (raw: string) => toDisplay(raw, "USDT_TRC20", 6).replace(/\.?0+$/, "");
  const [caps, setCaps] = useState({
    per_tx_max: capToDisplay(data.withdrawalCaps.perTxMax),
    daily_max: capToDisplay(data.withdrawalCaps.dailyMax),
    dual_approval_threshold: capToDisplay(data.withdrawalCaps.dualApprovalThreshold),
    auto_approve_below: capToDisplay(data.withdrawalCaps.autoApproveBelow),
  });
  const [pending, setPending] = useState<{ key: string; value: unknown } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const saveWindow = () => {
    setError(null);
    setPending({ key: "trade_payment_window_minutes", value: Number(windowMin) });
  };
  const saveDeposit = () => {
    setError(null);
    try {
      setPending({
        key: "deposit_policy",
        value: { min_amount: fromDisplay(depMin || "0").toString(), confirmations: Number(depConf) },
      });
    } catch (err) {
      setError(apiErrorMessage(err, tx("errorUpdate")));
    }
  };
  const saveFees = () => {
    setError(null);
    // Full-rail snapshot: bps is a plain integer (not smallest-unit money).
    const value: Record<string, number> = {};
    for (const [rail, v] of Object.entries(feeBps)) value[rail] = Number(v || "0");
    const parsed = zFeeBpsValue.safeParse(value);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? tx("errorUpdate"));
      return;
    }
    setPending({ key: "fee_bps", value });
  };
  const saveCaps = () => {
    setError(null);
    try {
      // Caps are smallest-unit amounts — convert via fromDisplay, never Number.
      const value = {
        per_tx_max: fromDisplay(caps.per_tx_max || "0").toString(),
        daily_max: fromDisplay(caps.daily_max || "0").toString(),
        dual_approval_threshold: fromDisplay(caps.dual_approval_threshold || "0").toString(),
        auto_approve_below: fromDisplay(caps.auto_approve_below || "0").toString(),
      };
      const parsed = zWithdrawalCapsValue.safeParse(value);
      if (!parsed.success) {
        setError(parsed.error.issues[0]?.message ?? tx("errorUpdate"));
        return;
      }
      setPending({ key: "withdrawal_caps", value });
    } catch (err) {
      setError(apiErrorMessage(err, tx("errorUpdate")));
    }
  };

  const confirm = async (v: { totpCode: string }) => {
    if (!pending) return;
    setBusy(true);
    setError(null);
    try {
      await adminApi.adminUpdateSetting({ key: pending.key, value: pending.value, totpCode: v.totpCode || undefined });
      toast.success(tx("settingSavedTitle"), tx("settingSavedBody"));
      setPending(null);
      void qc.invalidateQueries({ queryKey: ["admin", "settings"] });
    } catch (err) {
      setError(apiErrorMessage(err, tx("errorUpdate")));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <h2 className="font-display text-base font-semibold">{tx("configTitle")}</h2>
        <p className="text-sm text-text-2">{tx("configSubtitle")}</p>
      </div>

      {/* editable: payment window */}
      <Card className="space-y-3">
        <div>
          <p className="font-medium">{tx("paymentWindowTitle")}</p>
          <p className="text-sm text-text-2">{tx("paymentWindowDesc")}</p>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <Field label={tx("paymentWindowTitle")}>
            {(p) => (
              <Input
                {...p}
                mono
                inputMode="numeric"
                suffix={tx("paymentWindowUnit")}
                value={windowMin}
                onChange={(e) => setWindowMin(e.target.value.replace(/[^\d]/g, ""))}
                className="w-40"
              />
            )}
          </Field>
          <Button size="sm" onClick={saveWindow} disabled={windowMin === "" || windowMin === String(data.paymentWindowMinutes)}>
            {tx("saveChanges")}
          </Button>
        </div>
      </Card>

      {/* editable: deposit policy */}
      <Card className="space-y-3">
        <p className="font-medium">{tx("depositTitle")}</p>
        <div className="flex flex-wrap items-end gap-3">
          <Field label={tx("depositMinLabel")}>
            {(p) => (
              <Input
                {...p}
                mono
                inputMode="decimal"
                suffix="USDT"
                value={depMin}
                onChange={(e) => setDepMin(e.target.value.replace(/[^\d.]/g, ""))}
                className="w-40"
              />
            )}
          </Field>
          <Field label={tx("depositConfirmationsLabel")}>
            {(p) => (
              <Input
                {...p}
                mono
                inputMode="numeric"
                value={depConf}
                onChange={(e) => setDepConf(e.target.value.replace(/[^\d]/g, ""))}
                className="w-32"
              />
            )}
          </Field>
          <Button size="sm" onClick={saveDeposit} disabled={depConf === ""}>
            {tx("saveChanges")}
          </Button>
        </div>
      </Card>

      {/* editable: fee bps per rail (full snapshot) */}
      <Card className="space-y-3">
        <div>
          <p className="font-medium">{tx("feesTitle")}</p>
          <p className="text-sm text-text-2">{tx("feesDesc")}</p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Object.keys(feeBps).map((rail) => (
            <Field key={rail} label={rail}>
              {(p) => (
                <Input
                  {...p}
                  mono
                  inputMode="numeric"
                  suffix={tx("bpsUnit")}
                  value={feeBps[rail] ?? ""}
                  onChange={(e) => setFeeBps((s) => ({ ...s, [rail]: e.target.value.replace(/[^\d]/g, "") }))}
                />
              )}
            </Field>
          ))}
        </div>
        <div>
          <Button size="sm" onClick={saveFees}>
            {tx("saveFees")}
          </Button>
        </div>
      </Card>

      {/* editable: withdrawal caps + dual-approval threshold */}
      <Card className="space-y-3">
        <div>
          <p className="font-medium">{tx("capsTitle")}</p>
          <p className="text-sm text-text-2">{tx("capsDesc")}</p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <CapInput label={tx("perTxMax")} value={caps.per_tx_max} onChange={(v) => setCaps((s) => ({ ...s, per_tx_max: v }))} />
          <CapInput label={tx("dailyMax")} value={caps.daily_max} onChange={(v) => setCaps((s) => ({ ...s, daily_max: v }))} />
          <CapInput label={tx("dualApproval")} value={caps.dual_approval_threshold} onChange={(v) => setCaps((s) => ({ ...s, dual_approval_threshold: v }))} />
          <CapInput label={tx("autoApprove")} value={caps.auto_approve_below} onChange={(v) => setCaps((s) => ({ ...s, auto_approve_below: v }))} />
        </div>
        <p className="text-xs text-text-3">{tx("capsOrderingNote")}</p>
        <div>
          <Button size="sm" onClick={saveCaps}>
            {tx("saveCaps")}
          </Button>
        </div>
      </Card>

      <TotpActionDialog
        open={Boolean(pending)}
        onClose={() => setPending(null)}
        title={tx("confirmChangeTitle")}
        description={tx("confirmChangeDesc")}
        actionLabel={tx("applyChange")}
        requireTotp={Boolean(me?.totpEnabled)}
        busy={busy}
        error={error}
        onConfirm={confirm}
      />
    </div>
  );
}

function CapInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}): React.JSX.Element {
  return (
    <Field label={label}>
      {(p) => (
        <Input
          {...p}
          mono
          inputMode="decimal"
          suffix="USDT"
          value={value}
          onChange={(e) => onChange(e.target.value.replace(/[^\d.]/g, ""))}
        />
      )}
    </Field>
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
