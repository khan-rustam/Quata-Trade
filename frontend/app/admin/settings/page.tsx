"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Ban, Pause, Play } from "lucide-react";
import {
  fromDisplay,
  MAX_FEE_BPS,
  toDisplay,
  zFeeBpsValue,
  zHotWalletValue,
  zLaunchLimitsValue,
  zWithdrawalCapsValue,
  zWithdrawalFeeValue,
  zWithdrawalNetworkFeeValue,
  zKycTierLimitsValue,
} from "@quatatrade/shared";
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

  const submit = async (v: { totpCode?: string; reason?: string }) => {
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
            paused={data?.withdrawalsPaused}
            onToggle={(paused) => { setError(null); setPending({ target: "withdrawals", paused }); }}
          />
          <KillCard
            title={tx("tradingTitle")}
            description={tx("tradingDesc")}
            paused={data?.tradesPaused}
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
  const depKey = Object.values(data.depositPolicy).join(",");
  const hotKey = Object.values(data.hotWallet).join(",");
  const limitsKey = Object.values(data.launchLimits).join(",");
  // The new editors must be in the key too. Without them the form kept stale
  // values after a refetch while saveWithdrawalFee spreads the FRESH snapshot and
  // overrides one asset with the stale field — silently reverting another admin's
  // concurrent change.
  const wFeeKey = JSON.stringify(data.withdrawalFee) + JSON.stringify(data.withdrawalNetworkFee);
  const tierKey = JSON.stringify(data.kycTierLimits);
  return (
    <ConfigForm
      key={`${data.paymentWindowMinutes}:${depKey}:${feeKey}:${capsKey}:${data.sellerFeeBps}:${hotKey}:${limitsKey}:${wFeeKey}:${tierKey}`}
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
  const usdt = (raw: string) => toDisplay(raw, "USDT_TRC20", 6).replace(/\.?0+$/, "");
  const [depMin, setDepMin] = useState(usdt(data.depositPolicy.minAmount));
  const [depMax, setDepMax] = useState(data.depositPolicy.maxAmount ? usdt(data.depositPolicy.maxAmount) : "");
  const [depFeeFixed, setDepFeeFixed] = useState(usdt(data.depositPolicy.feeFixed));
  const [depFeeBps, setDepFeeBps] = useState(String(data.depositPolicy.feeBps));
  const [depConf, setDepConf] = useState(String(data.depositPolicy.confirmations));
  // fee bps per rail (as input strings) + withdrawal caps (as USDT display strings)
  const [feeBps, setFeeBps] = useState<Record<string, string>>(
    Object.fromEntries(Object.entries(data.feeBps).map(([k, v]) => [k, String(v)])),
  );
  // Global SELLER trading fee (Phase 2) — a single bps, separate from the per-rail buyer fee.
  const [sellerFeeBps, setSellerFeeBps] = useState(String(data.sellerFeeBps));
  const capToDisplay = (raw: string) => toDisplay(raw, "USDT_TRC20", 6).replace(/\.?0+$/, "");
  const [caps, setCaps] = useState({
    per_tx_max: capToDisplay(data.withdrawalCaps.perTxMax),
    daily_max: capToDisplay(data.withdrawalCaps.dailyMax),
    dual_approval_threshold: capToDisplay(data.withdrawalCaps.dualApprovalThreshold),
    auto_approve_below: capToDisplay(data.withdrawalCaps.autoApproveBelow),
  });
  // Withdrawal fee actually charged on every withdrawal, and the per-tier KYC
  // ceilings. Both are enforced in the money path but had no console surface at
  // all — changing either meant a direct DB write.
  const [wfee, setWfee] = useState({
    fixed: usdt(data.withdrawalFee.USDT_TRC20?.fixed ?? "0"),
    bps: String(data.withdrawalFee.USDT_TRC20?.bps ?? 0),
    network: usdt(data.withdrawalNetworkFee.USDT_TRC20 ?? "0"),
  });
  // Single smallest-unit amounts; both are whitelisted for PATCH and were being
  // returned in the snapshot with nothing rendering them.
  const [actionFees, setActionFees] = useState({
    advertisement: usdt(data.advertisementFee),
    dispute: usdt(data.disputeFee),
  });
  const [tiers, setTiers] = useState(() =>
    Object.fromEntries(
      ["0", "1", "2", "3"].map((t) => [
        t,
        {
          maxTrade: usdt(data.kycTierLimits[t]?.maxTrade ?? "0"),
          dailyWithdrawal: usdt(data.kycTierLimits[t]?.dailyWithdrawal ?? "0"),
        },
      ]),
    ),
  );
  // Hot-wallet operating thresholds + launch-protection ceilings (D30-limits). 0 = disabled.
  const [hot, setHot] = useState({
    max_balance: usdt(data.hotWallet.maxBalance),
    min_balance: usdt(data.hotWallet.minBalance),
    reserve: usdt(data.hotWallet.reserve),
    daily_op_limit: usdt(data.hotWallet.dailyOpLimit),
    alert_threshold: usdt(data.hotWallet.alertThreshold),
  });
  const [limits, setLimits] = useState({
    max_user_balance: usdt(data.launchLimits.maxUserBalance),
    max_daily_deposit_per_user: usdt(data.launchLimits.maxDailyDepositPerUser),
    max_platform_custody: usdt(data.launchLimits.maxPlatformCustody),
    max_daily_withdrawal_volume: usdt(data.launchLimits.maxDailyWithdrawalVolume),
    max_pending_withdrawal_queue: String(data.launchLimits.maxPendingWithdrawalQueue),
    max_withdrawals_per_day: String(data.launchLimits.maxWithdrawalsPerDay),
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
        value: {
          min_amount: fromDisplay(depMin || "0").toString(),
          max_amount: depMax.trim() ? fromDisplay(depMax).toString() : null,
          fee_fixed: fromDisplay(depFeeFixed || "0").toString(),
          fee_bps: Number(depFeeBps || "0"),
          confirmations: Number(depConf),
        },
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
  const saveSellerFee = () => {
    setError(null);
    const value = Number(sellerFeeBps || "0");
    if (!Number.isInteger(value) || value < 0 || value > MAX_FEE_BPS) {
      setError(tx("errorUpdate"));
      return;
    }
    setPending({ key: "seller_fee_bps", value });
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
  const saveWithdrawalFee = () => {
    setError(null);
    try {
      // Full-value replace, like every other settings write: send the whole map so
      // a save can never silently drop an asset.
      const value = {
        ...data.withdrawalFee,
        USDT_TRC20: { fixed: fromDisplay(wfee.fixed || "0").toString(), bps: Number(wfee.bps || "0") },
      };
      const parsed = zWithdrawalFeeValue.safeParse(value);
      if (!parsed.success) {
        setError(parsed.error.issues[0]?.message ?? tx("errorUpdate"));
        return;
      }
      setPending({ key: "withdrawal_fee", value });
    } catch (err) {
      setError(apiErrorMessage(err, tx("errorUpdate")));
    }
  };
  const saveNetworkFee = () => {
    setError(null);
    try {
      const value = { ...data.withdrawalNetworkFee, USDT_TRC20: fromDisplay(wfee.network || "0").toString() };
      const parsed = zWithdrawalNetworkFeeValue.safeParse(value);
      if (!parsed.success) {
        setError(parsed.error.issues[0]?.message ?? tx("errorUpdate"));
        return;
      }
      setPending({ key: "withdrawal_network_fee", value });
    } catch (err) {
      setError(apiErrorMessage(err, tx("errorUpdate")));
    }
  };
  const saveTierLimits = () => {
    setError(null);
    try {
      // Field names must match the write gate exactly — snake_case here 400'd
      // every save. Validated with the SAME shared schema the gate uses, so the
      // two cannot drift again.
      const value = Object.fromEntries(
        Object.entries(tiers).map(([t, v]) => [
          t,
          {
            maxTrade: fromDisplay(v.maxTrade || "0").toString(),
            dailyWithdrawal: fromDisplay(v.dailyWithdrawal || "0").toString(),
          },
        ]),
      );
      const parsed = zKycTierLimitsValue.safeParse(value);
      if (!parsed.success) {
        setError(parsed.error.issues[0]?.message ?? tx("errorUpdate"));
        return;
      }
      setPending({ key: "kyc_tier_limits", value });
    } catch (err) {
      setError(apiErrorMessage(err, tx("errorUpdate")));
    }
  };
  const saveActionFee = (key: "advertisement_fee" | "dispute_fee", display: string) => {
    setError(null);
    try {
      setPending({ key, value: fromDisplay(display || "0").toString() });
    } catch (err) {
      setError(apiErrorMessage(err, tx("errorUpdate")));
    }
  };
  const saveHotWallet = () => {
    setError(null);
    try {
      const value = {
        max_balance: fromDisplay(hot.max_balance || "0").toString(),
        min_balance: fromDisplay(hot.min_balance || "0").toString(),
        reserve: fromDisplay(hot.reserve || "0").toString(),
        daily_op_limit: fromDisplay(hot.daily_op_limit || "0").toString(),
        alert_threshold: fromDisplay(hot.alert_threshold || "0").toString(),
      };
      const parsed = zHotWalletValue.safeParse(value);
      if (!parsed.success) {
        setError(parsed.error.issues[0]?.message ?? tx("errorUpdate"));
        return;
      }
      setPending({ key: "hot_wallet", value });
    } catch (err) {
      setError(apiErrorMessage(err, tx("errorUpdate")));
    }
  };
  const saveLaunchLimits = () => {
    setError(null);
    try {
      const value = {
        max_user_balance: fromDisplay(limits.max_user_balance || "0").toString(),
        max_daily_deposit_per_user: fromDisplay(limits.max_daily_deposit_per_user || "0").toString(),
        max_platform_custody: fromDisplay(limits.max_platform_custody || "0").toString(),
        max_daily_withdrawal_volume: fromDisplay(limits.max_daily_withdrawal_volume || "0").toString(),
        max_pending_withdrawal_queue: Number(limits.max_pending_withdrawal_queue || "0"),
        max_withdrawals_per_day: Number(limits.max_withdrawals_per_day || "0"),
      };
      const parsed = zLaunchLimitsValue.safeParse(value);
      if (!parsed.success) {
        setError(parsed.error.issues[0]?.message ?? tx("errorUpdate"));
        return;
      }
      setPending({ key: "launch_limits", value });
    } catch (err) {
      setError(apiErrorMessage(err, tx("errorUpdate")));
    }
  };

  const confirm = async (v: { totpCode?: string; reason?: string }) => {
    if (!pending) return;
    setBusy(true);
    setError(null);
    try {
      await adminApi.adminUpdateSetting({
        key: pending.key,
        value: pending.value,
        reason: v.reason?.trim() || "(no reason given)",
        totpCode: v.totpCode,
      });
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

      {/* editable: deposit policy + platform deposit fee */}
      <Card className="space-y-3">
        <div>
          <p className="font-medium">{tx("depositTitle")}</p>
          <p className="text-sm text-text-2">{tx("depositDesc")}</p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <Field label={tx("depositMinLabel")}>
            {(p) => (
              <Input {...p} mono inputMode="decimal" suffix="USDT" value={depMin} onChange={(e) => setDepMin(e.target.value.replace(/[^\d.]/g, ""))} />
            )}
          </Field>
          <Field label={tx("depositMaxLabel")} hint={tx("depositMaxHint")}>
            {(p) => (
              <Input {...p} mono inputMode="decimal" suffix="USDT" placeholder={tx("noLimit")} value={depMax} onChange={(e) => setDepMax(e.target.value.replace(/[^\d.]/g, ""))} />
            )}
          </Field>
          <Field label={tx("depositFeeFixedLabel")}>
            {(p) => (
              <Input {...p} mono inputMode="decimal" suffix="USDT" value={depFeeFixed} onChange={(e) => setDepFeeFixed(e.target.value.replace(/[^\d.]/g, ""))} />
            )}
          </Field>
          <Field label={tx("depositFeeBpsLabel")}>
            {(p) => (
              <Input {...p} mono inputMode="numeric" suffix={tx("bpsUnit")} value={depFeeBps} onChange={(e) => setDepFeeBps(e.target.value.replace(/[^\d]/g, ""))} />
            )}
          </Field>
          <Field label={tx("depositConfirmationsLabel")}>
            {(p) => (
              <Input {...p} mono inputMode="numeric" value={depConf} onChange={(e) => setDepConf(e.target.value.replace(/[^\d]/g, ""))} />
            )}
          </Field>
        </div>
        <div>
          <Button size="sm" onClick={saveDeposit} disabled={depConf === "" || depMin === ""}>
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
        <div className="border-t border-border pt-3 space-y-2">
          <p className="text-sm font-medium">{tx("sellerFeeTitle")}</p>
          <p className="text-xs text-text-3">{tx("sellerFeeDesc")}</p>
          <div className="flex items-end gap-3">
            <Field label={tx("sellerFeeLabel")}>
              {(p) => (
                <Input
                  {...p}
                  mono
                  inputMode="numeric"
                  suffix={tx("bpsUnit")}
                  value={sellerFeeBps}
                  onChange={(e) => setSellerFeeBps(e.target.value.replace(/[^\d]/g, ""))}
                />
              )}
            </Field>
            <Button size="sm" onClick={saveSellerFee}>
              {tx("saveChanges")}
            </Button>
          </div>
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

      {/* editable: the withdrawal fee actually charged, + the displayed network estimate */}
      <Card className="space-y-3">
        <div>
          <p className="font-medium">{tx("wFeeTitle")}</p>
          <p className="text-sm text-text-2">{tx("wFeeDesc")}</p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <CapInput label={tx("wFeeFixed")} value={wfee.fixed} onChange={(v) => setWfee((s2) => ({ ...s2, fixed: v }))} />
          <Field label={tx("wFeeBps")} hint={tx("wFeeBpsHint", { max: MAX_FEE_BPS })}>
            {(p) => (
              <Input
                {...p}
                inputMode="numeric"
                value={wfee.bps}
                onChange={(e) => setWfee((s2) => ({ ...s2, bps: e.target.value.replace(/\D/g, "") }))}
              />
            )}
          </Field>
        </div>
        <div>
          <Button size="sm" onClick={saveWithdrawalFee}>
            {tx("saveChanges")}
          </Button>
        </div>
        <div className="border-t border-border pt-3">
          <p className="text-sm font-medium">{tx("networkFeeTitle")}</p>
          <p className="mb-2 text-xs text-text-3">{tx("networkFeeDesc")}</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <CapInput label={tx("networkFeeEstimate")} value={wfee.network} onChange={(v) => setWfee((s2) => ({ ...s2, network: v }))} />
          </div>
          <Button size="sm" variant="secondary" className="mt-3" onClick={saveNetworkFee}>
            {tx("saveChanges")}
          </Button>
        </div>
      </Card>

      {/* editable: per-tier KYC ceilings enforced on trades and withdrawals */}
      <Card className="space-y-3">
        <div>
          <p className="font-medium">{tx("tierLimitsTitle")}</p>
          <p className="text-sm text-text-2">{tx("tierLimitsDesc")}</p>
        </div>
        <div className="space-y-3">
          {["0", "1", "2", "3"].map((t) => (
            <div key={t} className="grid gap-3 sm:grid-cols-[6rem_1fr_1fr] sm:items-end">
              <p className="text-sm font-medium text-text-2">{tx("tierLabel", { tier: t })}</p>
              <CapInput
                label={tx("tierMaxTrade")}
                value={tiers[t]?.maxTrade ?? "0"}
                onChange={(v) => setTiers((s2) => ({ ...s2, [t]: { ...s2[t]!, maxTrade: v } }))}
              />
              <CapInput
                label={tx("tierDailyWithdrawal")}
                value={tiers[t]?.dailyWithdrawal ?? "0"}
                onChange={(v) => setTiers((s2) => ({ ...s2, [t]: { ...s2[t]!, dailyWithdrawal: v } }))}
              />
            </div>
          ))}
        </div>
        <p className="text-xs text-text-3">{tx("tierZeroNote")}</p>
        <div>
          <Button size="sm" onClick={saveTierLimits}>
            {tx("saveChanges")}
          </Button>
        </div>
      </Card>

      {/* editable: per-action fees (0 = free) */}
      <Card className="space-y-3">
        <div>
          <p className="font-medium">{tx("actionFeesTitle")}</p>
          <p className="text-sm text-text-2">{tx("actionFeesDesc")}</p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-2">
            <CapInput
              label={tx("advertisementFee")}
              value={actionFees.advertisement}
              onChange={(v) => setActionFees((s2) => ({ ...s2, advertisement: v }))}
            />
            <Button size="sm" variant="secondary" onClick={() => saveActionFee("advertisement_fee", actionFees.advertisement)}>
              {tx("saveChanges")}
            </Button>
          </div>
          <div className="space-y-2">
            <CapInput
              label={tx("disputeFee")}
              value={actionFees.dispute}
              onChange={(v) => setActionFees((s2) => ({ ...s2, dispute: v }))}
            />
            <Button size="sm" variant="secondary" onClick={() => saveActionFee("dispute_fee", actionFees.dispute)}>
              {tx("saveChanges")}
            </Button>
          </div>
        </div>
        <p className="text-xs text-text-3">{tx("limitsZeroNote")}</p>
      </Card>

      {/* editable: hot-wallet operating thresholds */}
      <Card className="space-y-3">
        <div>
          <p className="font-medium">{tx("hotWalletTitle")}</p>
          <p className="text-sm text-text-2">{tx("hotWalletDesc")}</p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <CapInput label={tx("hwMax")} value={hot.max_balance} onChange={(v) => setHot((s) => ({ ...s, max_balance: v }))} />
          <CapInput label={tx("hwMin")} value={hot.min_balance} onChange={(v) => setHot((s) => ({ ...s, min_balance: v }))} />
          <CapInput label={tx("hwReserve")} value={hot.reserve} onChange={(v) => setHot((s) => ({ ...s, reserve: v }))} />
          <CapInput label={tx("hwDailyOp")} value={hot.daily_op_limit} onChange={(v) => setHot((s) => ({ ...s, daily_op_limit: v }))} />
          <CapInput label={tx("hwAlert")} value={hot.alert_threshold} onChange={(v) => setHot((s) => ({ ...s, alert_threshold: v }))} />
        </div>
        <p className="text-xs text-text-3">{tx("limitsZeroNote")}</p>
        <div>
          <Button size="sm" onClick={saveHotWallet}>
            {tx("saveChanges")}
          </Button>
        </div>
      </Card>

      {/* editable: launch-protection ceilings */}
      <Card className="space-y-3">
        <div>
          <p className="font-medium">{tx("launchLimitsTitle")}</p>
          <p className="text-sm text-text-2">{tx("launchLimitsDesc")}</p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <CapInput label={tx("llUserBalance")} value={limits.max_user_balance} onChange={(v) => setLimits((s) => ({ ...s, max_user_balance: v }))} />
          <CapInput label={tx("llDailyDeposit")} value={limits.max_daily_deposit_per_user} onChange={(v) => setLimits((s) => ({ ...s, max_daily_deposit_per_user: v }))} />
          <CapInput label={tx("llCustody")} value={limits.max_platform_custody} onChange={(v) => setLimits((s) => ({ ...s, max_platform_custody: v }))} />
          <CapInput label={tx("llDailyVolume")} value={limits.max_daily_withdrawal_volume} onChange={(v) => setLimits((s) => ({ ...s, max_daily_withdrawal_volume: v }))} />
          <Field label={tx("llPendingQueue")}>
            {(p) => (
              <Input
                {...p}
                mono
                inputMode="numeric"
                value={limits.max_pending_withdrawal_queue}
                onChange={(e) => setLimits((s) => ({ ...s, max_pending_withdrawal_queue: e.target.value.replace(/[^\d]/g, "") }))}
              />
            )}
          </Field>
          <Field label={tx("llPerDay")}>
            {(p) => (
              <Input
                {...p}
                mono
                inputMode="numeric"
                value={limits.max_withdrawals_per_day}
                onChange={(e) => setLimits((s) => ({ ...s, max_withdrawals_per_day: e.target.value.replace(/[^\d]/g, "") }))}
              />
            )}
          </Field>
        </div>
        <p className="text-xs text-text-3">{tx("limitsEnforcementNote")}</p>
        <div>
          <Button size="sm" onClick={saveLaunchLimits}>
            {tx("saveChanges")}
          </Button>
        </div>
      </Card>

      <TotpActionDialog
        open={Boolean(pending)}
        onClose={() => setPending(null)}
        title={tx("confirmChangeTitle")}
        description={tx("confirmChangeDesc")}
        actionLabel={tx("applyChange")}
        reasonLabel={tx("changeReasonLabel")}
        reasonRequired
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
  /** undefined = state could not be read. NOT the same as "running". */
  paused: boolean | undefined;
  onToggle: (paused: boolean) => void;
}): React.JSX.Element {
  const tx = useTranslations("adminSettings");
  // `?? false` painted a green LIVE badge whenever the read failed — telling an
  // operator trading is running when the console has no idea whether it is, on
  // the control they reach for in an incident.
  const unknown = paused === undefined;
  return (
    <Card className={paused ? "border-danger/30 bg-danger/5" : ""}>
      <div className="flex items-start justify-between">
        <div>
          <p className="font-medium">{title}</p>
          <p className="mt-0.5 text-sm text-text-2">{description}</p>
        </div>
        <Badge
          tone={unknown ? "neutral" : paused ? "danger" : "success"}
          icon={paused ? <Ban size={11} /> : undefined}
        >
          {unknown ? tx("badgeUnknown") : paused ? tx("badgePaused") : tx("badgeLive")}
        </Badge>
      </div>
      <div className="mt-4">
        {unknown ? (
          <p className="text-xs text-text-3">{tx("killStateUnknown")}</p>
        ) : paused ? (
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
