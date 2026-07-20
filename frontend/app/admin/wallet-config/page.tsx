"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { KeyRound, ShieldCheck, CheckCircle2, CircleSlash } from "lucide-react";
import { zActivateWalletConfigRequest, type WalletConfigSummary } from "@quatatrade/shared";
import { AdminTitle, TableFrame } from "@/components/admin/admin-ui";
import { TotpActionDialog } from "@/components/admin/totp-dialog";
import { Card } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { Input, Textarea } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { CopyButton } from "@/components/ui/copy-button";
import { useToast } from "@/components/ui/toast";
import { adminApi } from "@/lib/api/admin-client";
import { apiErrorMessage } from "@/lib/api/errors";

const shortKey = (k: string) => (k.length > 18 ? `${k.slice(0, 10)}…${k.slice(-6)}` : k);
const fmtDate = (iso: string) => new Date(iso).toLocaleString();

/**
 * Custodial wallet configuration — key ceremony (Documents/10 D29). SUPER_ADMIN
 * only (server-enforced), TOTP step-up on activation, audited. Stores and shows
 * ONLY the account-level PUBLIC key (xpub); the backend refuses any private key.
 * Deposit derivation reads the active key here — env fallback until one is set.
 */
export default function WalletConfigPage(): React.JSX.Element {
  const tx = useTranslations("adminWalletConfig");
  const toast = useToast();
  const qc = useQueryClient();

  const { data, isLoading, error } = useQuery({
    queryKey: ["admin", "wallet-config"],
    queryFn: () => adminApi.adminWalletConfig(),
  });
  // requireTotp must follow the acting admin's own 2FA state: hardcoding it left
  // the freshly-seeded SUPER_ADMIN (totp_secret_enc null) staring at a permanently
  // greyed-out confirm button, unable to run the key ceremony at all.
  const { data: me } = useQuery({ queryKey: ["admin", "me"], queryFn: () => adminApi.adminMe() });

  const [xpub, setXpub] = useState("");
  const [label, setLabel] = useState("");
  const [reason, setReason] = useState("");
  const [ack, setAck] = useState(false);

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const xpubTrimmed = xpub.trim();
  const reasonOk = reason.trim().length >= 3;
  const canReview = xpubTrimmed.length >= 20 && reasonOk;

  const openReview = () => {
    setSubmitError(null);
    if (canReview) setConfirmOpen(true);
  };

  const confirm = async (v: { totpCode: string }) => {
    setBusy(true);
    setSubmitError(null);
    const parsed = zActivateWalletConfigRequest.safeParse({
      network: "tron",
      xpub: xpubTrimmed,
      label: label.trim() || undefined,
      reason: reason.trim(),
      acknowledgeReset: ack || undefined,
      totpCode: v.totpCode,
    });
    if (!parsed.success) {
      setSubmitError(parsed.error.issues[0]?.message ?? tx("submitError"));
      setBusy(false);
      return;
    }
    try {
      await adminApi.adminActivateWalletConfig(parsed.data);
      await qc.invalidateQueries({ queryKey: ["admin", "wallet-config"] });
      setConfirmOpen(false);
      toast.success(tx("successTitle"), tx("successBody"));
      setXpub("");
      setLabel("");
      setReason("");
      setAck(false);
    } catch (err) {
      // 400 invalid xpub / 409 rotation-blocked surface the server message in the
      // dialog; the admin can cancel, tick the acknowledgement, and re-review.
      setSubmitError(apiErrorMessage(err, tx("submitError")));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <AdminTitle title={tx("pageTitle")} subtitle={tx("pageSubtitle")} />

      <Alert tone="warning" title={tx("warnTitle")}>
        {tx("warnBody")}
      </Alert>

      {/* ── active wallet status ─────────────────────────────────────────── */}
      <Card className="space-y-3">
        <p className="font-medium">{tx("statusTitle")}</p>
        {isLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-6 w-40" />
            <Skeleton className="h-5 w-full" />
          </div>
        ) : error || !data ? (
          <Alert tone="danger">{apiErrorMessage(error, tx("loadError"))}</Alert>
        ) : data.usingEnvFallback ? (
          <>
            <Badge tone="warning" icon={<CircleSlash size={13} />}>
              {tx("envFallbackBadge")}
            </Badge>
            <Alert tone="info">{tx("envFallbackNote")}</Alert>
          </>
        ) : (
          <>
            <Badge tone="escrow" icon={<ShieldCheck size={13} />}>
              {tx("productionBadge")}
            </Badge>
            <dl className="grid gap-2 text-sm sm:grid-cols-[max-content_1fr] sm:gap-x-4">
              <dt className="text-text-3">{tx("activeXpubLabel")}</dt>
              <dd className="flex items-center gap-1.5">
                <span className="break-all font-money text-xs text-text-1">{data.activeXpub}</span>
                {data.activeXpub && <CopyButton value={data.activeXpub} />}
              </dd>
            </dl>
          </>
        )}
      </Card>

      {/* ── configuration history ────────────────────────────────────────── */}
      {data && data.configs.length > 0 && (
        <Card className="space-y-3">
          <p className="font-medium">{tx("historyTitle")}</p>
          <TableFrame
            head={
              <tr>
                <th className="px-3 py-2 font-medium">{tx("colKey")}</th>
                <th className="px-3 py-2 font-medium">{tx("colSample")}</th>
                <th className="px-3 py-2 font-medium">{tx("colSource")}</th>
                <th className="px-3 py-2 font-medium">{tx("colActive")}</th>
                <th className="px-3 py-2 font-medium">{tx("colDate")}</th>
              </tr>
            }
          >
            {data.configs.map((c: WalletConfigSummary) => (
              <tr key={c.id} className="align-top">
                <td className="px-3 py-2">
                  <span className="font-money text-xs text-text-1" title={c.xpub}>
                    {shortKey(c.xpub)}
                  </span>
                  {c.label && <span className="block text-xs text-text-3">{c.label}</span>}
                </td>
                <td className="px-3 py-2 font-money text-xs text-text-2">{shortKey(c.sampleAddress)}</td>
                <td className="px-3 py-2 text-text-2">
                  {c.source === "env" ? tx("sourceEnv") : tx("sourceCeremony")}
                </td>
                <td className="px-3 py-2">
                  {c.active ? (
                    <Badge tone="success" icon={<CheckCircle2 size={12} />}>
                      {tx("activeYes")}
                    </Badge>
                  ) : (
                    <Badge tone="neutral">{tx("activeNo")}</Badge>
                  )}
                </td>
                <td className="px-3 py-2 whitespace-nowrap text-text-3">{fmtDate(c.createdAt)}</td>
              </tr>
            ))}
          </TableFrame>
        </Card>
      )}

      {/* ── activate a production key ─────────────────────────────────────── */}
      <Card className="space-y-4">
        <p className="flex items-center gap-1.5 font-medium">
          <KeyRound size={16} className="text-accent-400" /> {tx("activateTitle")}
        </p>

        <Field label={tx("xpubLabel")} hint={tx("xpubHint")}>
          {(p) => (
            <Textarea
              {...p}
              value={xpub}
              onChange={(e) => setXpub(e.target.value)}
              placeholder={tx("xpubPlaceholder")}
              className="break-all font-money text-xs"
              rows={3}
              spellCheck={false}
              autoComplete="off"
            />
          )}
        </Field>

        <Field label={tx("configLabelLabel")} hint={tx("configLabelHint")}>
          {(p) => (
            <Input
              {...p}
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder={tx("configLabelPlaceholder")}
              maxLength={120}
            />
          )}
        </Field>

        <Field label={tx("reasonLabel")} hint={tx("reasonHint")}>
          {(p) => (
            <Input
              {...p}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder={tx("reasonPlaceholder")}
              maxLength={1000}
            />
          )}
        </Field>

        <label className="flex cursor-pointer items-start gap-2.5 rounded-lg bg-surface-2 px-3 py-2.5">
          <input
            type="checkbox"
            checked={ack}
            onChange={(e) => setAck(e.target.checked)}
            className="mt-0.5 size-4 shrink-0 accent-accent-400"
          />
          <span className="text-sm">
            <span className="font-medium text-text-1">{tx("ackLabel")}</span>
            <span className="mt-0.5 block text-xs text-text-3">{tx("ackHint")}</span>
          </span>
        </label>

        <Button onClick={openReview} disabled={!canReview}>
          {canReview ? tx("review") : tx("reviewInvalidXpub")}
        </Button>
      </Card>

      <p className="flex items-center gap-1.5 text-xs text-text-3">
        <ShieldCheck size={12} /> {tx("footNote")}
      </p>

      <TotpActionDialog
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        title={tx("confirmTitle")}
        description={tx("confirmEcho")}
        actionLabel={tx("confirmAction")}
        requireTotp={Boolean(me?.totpEnabled)}
        busy={busy}
        error={submitError}
        onConfirm={confirm}
      />
    </div>
  );
}
