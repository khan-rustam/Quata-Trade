"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { ArrowDownCircle, ArrowUpCircle, CheckCircle2, Scale, Search } from "lucide-react";
import { fromDisplay, toDisplay, zLedgerAdjustmentRequest } from "@quatatrade/shared";
import { AdminTitle } from "@/components/admin/admin-ui";
import { TotpActionDialog } from "@/components/admin/totp-dialog";
import { Card } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { Input, Textarea } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Segmented } from "@/components/ui/segmented";
import { Alert } from "@/components/ui/alert";
import { Spinner } from "@/components/ui/spinner";
import { useToast } from "@/components/ui/toast";
import { adminApi } from "@/lib/api/admin-client";
import { apiErrorMessage } from "@/lib/api/errors";

type Target = { id: string; email: string; available: string };
type Direction = "credit" | "debit";

const fmtUsdt = (raw: string) => `${toDisplay(raw, "USDT_TRC20", 6).replace(/\.?0+$/, "")} USDT`;

/**
 * The ONLY manual money surface — SUPER_ADMIN only (server-enforced), TOTP step-up,
 * mandatory reason, idempotent. A balance preview + typed echo-confirm guard against
 * wrong-target / wrong-amount real-money moves; the idempotency key is minted once
 * per intent and reused across retries so a double-submit can't post twice.
 */
export default function LedgerAdjustmentPage(): React.JSX.Element {
  const tx = useTranslations("adminLedgerAdjustment");
  const toast = useToast();

  const [email, setEmail] = useState("");
  const [target, setTarget] = useState<Target | null>(null);
  const [lookupBusy, setLookupBusy] = useState(false);
  const [lookupError, setLookupError] = useState<string | null>(null);

  const [direction, setDirection] = useState<Direction>("credit");
  const [magnitude, setMagnitude] = useState("");
  const [reason, setReason] = useState("");

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [idemKey, setIdemKey] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{ journalId: string } | null>(null);

  // `reset` clears the form/target; the post-success balance refresh passes false so the
  // "posted" confirmation (done) survives while the balance still updates.
  const lookup = async (reset = true) => {
    setLookupError(null);
    if (reset) {
      setTarget(null);
      setDone(null);
      setIdemKey(null); // a different target is a different intent
    }
    const q = email.trim();
    if (!q) return;
    setLookupBusy(true);
    try {
      const res = await adminApi.adminUsers({ search: q });
      // Substring search — require an EXACT email match; never silently aim a
      // money move at an arbitrary items[0].
      const match = res.items.find((u) => u.email.toLowerCase() === q.toLowerCase());
      if (!match) {
        setLookupError(tx("noUser"));
        return;
      }
      const detail = await adminApi.adminUserDetail(match.id);
      const bal = detail.balances.find((b) => b.kind === "user_available" && b.asset === "USDT_TRC20");
      setTarget({ id: match.id, email: detail.user.email, available: bal?.balance ?? "0" });
    } catch (err) {
      setLookupError(apiErrorMessage(err, tx("lookupError")));
    } finally {
      setLookupBusy(false);
    }
  };

  // Changing any intent field invalidates the pinned idempotency key.
  const onIntentChange = () => setIdemKey(null);

  // Signed smallest-units amount (positive credit, negative debit). Never Number().
  const signedAmount = (): bigint | null => {
    try {
      const mag = fromDisplay(magnitude || "0");
      if (mag <= 0n) return null;
      return direction === "debit" ? -mag : mag;
    } catch {
      return null;
    }
  };
  const amt = signedAmount();
  const projected = target && amt !== null ? BigInt(target.available) + amt : null;
  const reasonOk = reason.trim().length >= 10;
  const overdraws = projected !== null && projected < 0n;
  const canReview = Boolean(target) && amt !== null && reasonOk && !overdraws;

  const openReview = () => {
    setError(null);
    if (!canReview) return;
    // Mint a key only if this intent doesn't already have one, so re-opening Review
    // (e.g. after a network error) reuses the SAME key and the backend replays rather
    // than posting a second journal. onIntentChange() clears it when the intent changes.
    setIdemKey((k) => k ?? `ledgeradj-${crypto.randomUUID()}`);
    setConfirmOpen(true);
  };

  const confirm = async (v: { totpCode?: string }) => {
    if (!target || amt === null || !idemKey) return;
    setBusy(true);
    setError(null);
    const parsed = zLedgerAdjustmentRequest.safeParse({
      userId: target.id,
      accountKind: "user_available",
      asset: "USDT_TRC20",
      amount: amt.toString(),
      reason: reason.trim(),
      idempotencyKey: idemKey,
      totpCode: v.totpCode,
    });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? tx("invalid"));
      setBusy(false);
      return;
    }
    try {
      const res = await adminApi.adminLedgerAdjustment(parsed.data);
      setConfirmOpen(false);
      setDone({ journalId: res.journalId });
      toast.success(tx("successTitle"), tx("successBody"));
      setMagnitude("");
      setReason("");
      setIdemKey(null);
      void lookup(false); // refresh the balance WITHOUT clearing the "posted" panel
    } catch (err) {
      // Keep idemKey on a network/5xx error — a retry must reuse it (the post may have
      // committed). It is cleared only on success or when the intent changes.
      setError(apiErrorMessage(err, tx("submitError")));
    } finally {
      setBusy(false);
    }
  };

  const DirIcon = direction === "credit" ? ArrowUpCircle : ArrowDownCircle;

  return (
    <div className="mx-auto max-w-xl space-y-5">
      <AdminTitle title={tx("pageTitle")} subtitle={tx("pageSubtitle")} />

      <Alert tone="warning" title={tx("warnTitle")}>
        {tx("warnBody")}
      </Alert>

      {/* 1. target user */}
      <Card className="space-y-3">
        <p className="font-medium">{tx("targetTitle")}</p>
        <div className="flex flex-wrap items-end gap-3">
          <Field label={tx("emailLabel")}>
            {(p) => (
              <Input
                {...p}
                type="email"
                placeholder={tx("emailPlaceholder")}
                value={email}
                onChange={(e) => setEmail(e.target.value.trim())}
                onKeyDown={(e) => e.key === "Enter" && lookup()}
                className="w-72"
              />
            )}
          </Field>
          <Button size="sm" variant="secondary" onClick={() => lookup()} disabled={lookupBusy || !email.trim()}>
            {lookupBusy ? <Spinner /> : <Search size={15} />} {tx("lookup")}
          </Button>
        </div>
        {lookupError && <Alert tone="danger">{lookupError}</Alert>}
        {target && (
          <div className="rounded-lg bg-surface-2 px-3 py-2 text-sm">
            <p className="font-medium text-text-1">{target.email}</p>
            <p className="text-text-2">
              {tx("currentBalance")}: <span className="font-money text-text-1">{fmtUsdt(target.available)}</span>
            </p>
          </div>
        )}
      </Card>

      {/* 2. adjustment */}
      {target && !done && (
        <Card className="space-y-4">
          <p className="font-medium">{tx("adjustmentTitle")}</p>
          <div>
            <p className="mb-1.5 text-sm font-medium">{tx("directionLabel")}</p>
            <Segmented
              value={direction}
              onChange={(d) => {
                setDirection(d);
                onIntentChange();
              }}
              aria-label={tx("directionLabel")}
              options={[
                { value: "credit", label: tx("credit"), tone: "success" },
                { value: "debit", label: tx("debit"), tone: "danger" },
              ]}
            />
          </div>
          <Field label={tx("amountLabel")}>
            {(p) => (
              <Input
                {...p}
                mono
                inputMode="decimal"
                suffix="USDT"
                placeholder="0.00"
                value={magnitude}
                onChange={(e) => {
                  setMagnitude(e.target.value.replace(/[^\d.]/g, ""));
                  onIntentChange();
                }}
                className="w-56"
              />
            )}
          </Field>
          <Field label={tx("reasonLabel")} hint={tx("reasonHint")}>
            {(p) => (
              <Textarea
                {...p}
                value={reason}
                onChange={(e) => {
                  setReason(e.target.value);
                  onIntentChange();
                }}
                placeholder={tx("reasonPlaceholder")}
                maxLength={1000}
              />
            )}
          </Field>

          {amt !== null && projected !== null && (
            <div className="rounded-lg border border-border bg-bg px-3 py-2.5 text-sm">
              <p className="mb-1 flex items-center gap-1.5 font-medium">
                <DirIcon size={15} className={direction === "credit" ? "text-success" : "text-danger"} />
                {tx(direction === "credit" ? "previewCredit" : "previewDebit", { amount: fmtUsdt((amt < 0n ? -amt : amt).toString()) })}
              </p>
              <p className="text-text-2">
                {fmtUsdt(target.available)} → <span className={overdraws ? "font-money text-danger" : "font-money text-text-1"}>{fmtUsdt(projected.toString())}</span>
              </p>
              {overdraws && <p className="mt-1 text-xs text-danger">{tx("overdrawWarn")}</p>}
            </div>
          )}

          <Button onClick={openReview} disabled={!canReview}>
            {tx("review")}
          </Button>
        </Card>
      )}

      {done && (
        <Card className="flex flex-col items-center gap-2 py-6 text-center">
          <CheckCircle2 size={36} className="text-success" />
          <p className="font-medium">{tx("postedTitle")}</p>
          <p className="text-xs text-text-3">
            {tx("journalRef")}: <span className="font-money">{done.journalId}</span>
          </p>
          <Button size="sm" variant="secondary" onClick={() => setDone(null)}>
            {tx("newAdjustment")}
          </Button>
        </Card>
      )}

      <TotpActionDialog
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        title={tx("confirmTitle")}
        description={
          target && amt !== null
            ? tx("confirmEcho", {
                direction: tx(direction === "credit" ? "creditWord" : "debitWord"),
                amount: fmtUsdt((amt < 0n ? -amt : amt).toString()),
                email: target.email,
              })
            : ""
        }
        actionLabel={tx("confirmAction")}
        destructive={direction === "debit"}
        requireTotp
        busy={busy}
        error={error}
        onConfirm={confirm}
      />

      <p className="flex items-center gap-1.5 text-xs text-text-3">
        <Scale size={12} /> {tx("footNote")}
      </p>
    </div>
  );
}
