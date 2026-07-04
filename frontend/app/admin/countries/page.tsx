"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import type { AdminCountry } from "@quatatrade/shared";
import { AdminTitle } from "@/components/admin/admin-ui";
import { TotpActionDialog } from "@/components/admin/totp-dialog";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert } from "@/components/ui/alert";
import { useToast } from "@/components/ui/toast";
import { useAdminMe } from "@/hooks/use-admin";
import { useAdminCountries, useSetCountryEnabled } from "@/hooks/use-countries";
import { apiErrorMessage } from "@/lib/api/errors";

/**
 * Phased market rollout console. Enabling a country opens sign-up + trading for
 * it; disabling freezes NEW trades there (openTrade re-checks). Same stakes as
 * the kill switch — TOTP step-up + a mandatory reason, audited server-side.
 */
export default function AdminCountriesPage(): React.JSX.Element {
  const tx = useTranslations("adminCountries");
  const locale = useLocale();
  const { data, isLoading } = useAdminCountries();
  const { data: me } = useAdminMe();
  const toggle = useSetCountryEnabled();
  const toast = useToast();
  const [pending, setPending] = useState<AdminCountry | null>(null);
  const [error, setError] = useState<string | null>(null);

  const name = (c: AdminCountry) => (locale === "fr" ? c.nameFr : c.nameEn);

  const submit = async (v: { totpCode: string; reason?: string }) => {
    if (!pending) return;
    setError(null);
    const next = !pending.enabled;
    try {
      await toggle.mutateAsync({
        code: pending.code,
        body: { enabled: next, totpCode: v.totpCode || undefined, reason: v.reason ?? "" },
      });
      toast.success(
        next ? tx("toastEnabledTitle") : tx("toastDisabledTitle"),
        tx(next ? "toastEnabledBody" : "toastDisabledBody", { country: name(pending) }),
      );
      setPending(null);
    } catch (err) {
      setError(apiErrorMessage(err, tx("errorUpdate")));
    }
  };

  return (
    <div className="space-y-5">
      <AdminTitle title={tx("pageTitle")} subtitle={tx("pageSubtitle")} />

      <Alert tone="info" title={tx("alertTitle")}>
        {tx("alertBody")}
      </Alert>

      {isLoading ? (
        <Skeleton className="h-64 w-full rounded-xl" />
      ) : (
        <Card className="overflow-x-auto p-0">
          <table className="w-full min-w-[560px] text-sm">
            <thead>
              <tr className="border-b border-border text-left text-text-3">
                <th className="px-4 py-3 font-medium">{tx("colCountry")}</th>
                <th className="px-4 py-3 font-medium">{tx("colDial")}</th>
                <th className="px-4 py-3 font-medium">{tx("colCurrency")}</th>
                <th className="px-4 py-3 font-medium">{tx("colStatus")}</th>
                <th className="px-4 py-3 text-right font-medium">{tx("colAction")}</th>
              </tr>
            </thead>
            <tbody>
              {data?.countries.map((c) => (
                <tr key={c.code} className="border-b border-border/60 last:border-0">
                  <td className="px-4 py-3">
                    <span className="font-medium text-text-1">{name(c)}</span>
                    <span className="ml-2 text-xs text-text-3">{c.code}</span>
                  </td>
                  <td className="px-4 py-3 tabular-nums text-text-2">{c.dialCode}</td>
                  <td className="px-4 py-3 text-text-2">{c.currencyCode}</td>
                  <td className="px-4 py-3">
                    <Badge tone={c.enabled ? "success" : "neutral"}>
                      {c.enabled ? tx("badgeLive") : tx("badgeOff")}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Button
                      size="sm"
                      variant={c.enabled ? "danger" : "primary"}
                      onClick={() => {
                        setError(null);
                        setPending(c);
                      }}
                    >
                      {c.enabled ? tx("disable") : tx("enable")}
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      <TotpActionDialog
        open={Boolean(pending)}
        onClose={() => setPending(null)}
        title={pending ? tx(pending.enabled ? "dialogTitleDisable" : "dialogTitleEnable", { country: name(pending) }) : ""}
        description={pending?.enabled ? tx("dialogDescDisable") : tx("dialogDescEnable")}
        actionLabel={pending?.enabled ? tx("disable") : tx("enable")}
        destructive={pending?.enabled}
        reasonLabel={tx("reasonLabel")}
        reasonRequired
        requireTotp={Boolean(me?.totpEnabled)}
        busy={toggle.isPending}
        error={error}
        onConfirm={submit}
      />
    </div>
  );
}
