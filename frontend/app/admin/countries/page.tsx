"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { ShieldCheck } from "lucide-react";
import { PAYMENT_METHODS, type AdminCountry, type PaymentMethod } from "@quatatrade/shared";
import { AdminTitle } from "@/components/admin/admin-ui";
import { Dialog } from "@/components/ui/dialog";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Textarea } from "@/components/ui/input";
import { OtpInput } from "@/components/ui/otp-input";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert } from "@/components/ui/alert";
import { Spinner } from "@/components/ui/spinner";
import { useToast } from "@/components/ui/toast";
import { PaymentMethodChip } from "@/components/trade/payment-method-chip";
import { useAdminMe } from "@/hooks/use-admin";
import { useAdminCountries, useUpdateCountry } from "@/hooks/use-countries";
import { apiErrorMessage } from "@/lib/api/errors";
import { cn } from "@/lib/utils";

/**
 * Phased market rollout console. Configure each market's enabled state AND its
 * available payment rails; enabling opens sign-up + trading, disabling freezes
 * new trades. Every change is TOTP step-up + audited server-side.
 */
export default function AdminCountriesPage(): React.JSX.Element {
  const tx = useTranslations("adminCountries");
  const locale = useLocale();
  const { data, isLoading } = useAdminCountries();
  const { data: me } = useAdminMe();
  const [editing, setEditing] = useState<AdminCountry | null>(null);
  const name = (c: AdminCountry) => (locale === "fr" ? c.nameFr : c.nameEn);

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
          <table className="w-full min-w-170 text-sm">
            <thead>
              <tr className="border-b border-border text-left text-text-3">
                <th className="px-4 py-3 font-medium">{tx("colCountry")}</th>
                <th className="px-4 py-3 font-medium">{tx("colDial")}</th>
                <th className="px-4 py-3 font-medium">{tx("colCurrency")}</th>
                <th className="px-4 py-3 font-medium">{tx("colRails")}</th>
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
                    <div className="flex flex-wrap gap-1">
                      {c.paymentMethods.length > 0 ? (
                        c.paymentMethods.map((m) => <PaymentMethodChip key={m} method={m} />)
                      ) : (
                        <span className="text-xs text-text-3">{tx("noRails")}</span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <Badge tone={c.enabled ? "success" : "neutral"}>
                      {c.enabled ? tx("badgeLive") : tx("badgeOff")}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Button size="sm" variant="secondary" onClick={() => setEditing(c)}>
                      {tx("configure")}
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      {editing && (
        <ConfigureDialog
          country={editing}
          name={name(editing)}
          requireTotp={Boolean(me?.totpEnabled)}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  );
}

function ConfigureDialog({
  country,
  name,
  requireTotp,
  onClose,
}: {
  country: AdminCountry;
  name: string;
  requireTotp: boolean;
  onClose: () => void;
}): React.JSX.Element {
  const tx = useTranslations("adminCountries");
  const toast = useToast();
  const update = useUpdateCountry();
  const [enabled, setEnabled] = useState(country.enabled);
  const [rails, setRails] = useState<PaymentMethod[]>(country.paymentMethods);
  const [reason, setReason] = useState("");
  const [totp, setTotp] = useState("");
  const [error, setError] = useState<string | null>(null);

  const toggleRail = (m: PaymentMethod) =>
    setRails((prev) => (prev.includes(m) ? prev.filter((x) => x !== m) : [...prev, m]));
  const reasonOk = reason.trim().length >= 5;
  const totpOk = !requireTotp || totp.length >= 6;
  const railsOk = !enabled || rails.length > 0; // an enabled market needs ≥1 rail

  const submit = async () => {
    setError(null);
    try {
      await update.mutateAsync({
        code: country.code,
        body: {
          enabled,
          paymentMethods: rails,
          totpCode: requireTotp ? totp : undefined,
          reason: reason.trim(),
        },
      });
      toast.success(tx("savedTitle"), tx("savedBody", { country: name }));
      onClose();
    } catch (err) {
      setError(apiErrorMessage(err, tx("errorUpdate")));
    }
  };

  return (
    <Dialog open onClose={onClose} title={tx("configureTitle", { country: name })} description={tx("configureDesc")}>
      <div className="space-y-4">
        {error && <Alert tone="danger">{error}</Alert>}

        <label className="flex items-center gap-2.5 text-sm">
          <input
            type="checkbox"
            className="h-4 w-4 rounded border-border accent-accent-400"
            checked={enabled}
            onChange={(e) => setEnabled(e.target.checked)}
          />
          <span className="font-medium">{tx("enabledLabel")}</span>
        </label>

        <div>
          <p className="mb-1.5 text-sm font-medium">{tx("railsLabel")}</p>
          <div className="flex flex-wrap gap-2">
            {PAYMENT_METHODS.map((m) => {
              const active = rails.includes(m);
              return (
                <button
                  key={m}
                  type="button"
                  onClick={() => toggleRail(m)}
                  aria-pressed={active}
                  className={cn(
                    "rounded-full border p-0.5 transition-colors",
                    active ? "border-accent-400" : "border-transparent opacity-60 hover:opacity-100",
                  )}
                >
                  <PaymentMethodChip method={m} />
                </button>
              );
            })}
          </div>
          {!railsOk && <p className="mt-1.5 text-xs text-danger">{tx("railsRequired")}</p>}
        </div>

        <Field label={tx("reasonLabel")} required>
          {(p) => (
            <Textarea {...p} value={reason} onChange={(e) => setReason(e.target.value)} placeholder={tx("reasonPlaceholder")} />
          )}
        </Field>

        {requireTotp && (
          <div className="space-y-2">
            <label className="flex items-center gap-1.5 text-sm font-medium">
              <ShieldCheck size={14} className="text-accent-400" /> {tx("totpLabel")}
            </label>
            <OtpInput value={totp} onChange={setTotp} aria-label={tx("totpLabel")} invalid={Boolean(error)} />
          </div>
        )}

        <div className="flex gap-2">
          <Button variant="secondary" className="flex-1" onClick={onClose} disabled={update.isPending}>
            {tx("cancel")}
          </Button>
          <Button
            className="flex-1"
            disabled={update.isPending || !reasonOk || !totpOk || !railsOk}
            onClick={submit}
          >
            {update.isPending ? <Spinner /> : tx("save")}
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
