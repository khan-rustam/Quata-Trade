"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { AlertTriangle, CheckCircle2, Paperclip, Send, X } from "lucide-react";
import type { Trade } from "@quatatrade/shared";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { Input, Textarea } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { CopyButton } from "@/components/ui/copy-button";
import { Alert } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { Usdt, Xaf } from "@/components/ui/amount";
import { TradeStatusBadge } from "@/components/ui/status-badge";
import { SecurityDialog } from "@/components/security/security-dialog";
import { Dialog } from "@/components/ui/dialog";
import { Spinner } from "@/components/ui/spinner";
import { StatusStepper } from "@/components/trade/status-stepper";
import { Countdown } from "@/components/trade/countdown";
import { PaymentMethodChip } from "@/components/trade/payment-method-chip";
import { Keyhole } from "@/components/brand/keyhole";
import { useToast } from "@/components/ui/toast";
import { useMe } from "@/hooks/use-auth";
import { useMessages, useSendMessage, useTrade } from "@/hooks/use-trade";
import { useDispute, useSubmitEvidence } from "@/hooks/use-dispute";
import { qk } from "@/lib/api/query-keys";
import { api } from "@/lib/api/client";
import { apiErrorMessage } from "@/lib/api/errors";
import { timeAgo } from "@/lib/format";
import { cn } from "@/lib/utils";

export default function TradeRoomPage(): React.JSX.Element {
  const tx = useTranslations("tradeRoom");
  const { id } = useParams<{ id: string }>();
  const { data: me } = useMe();
  const { data, isLoading } = useTrade(id, true);
  const qc = useQueryClient();
  const toast = useToast();

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [disputeOpen, setDisputeOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [dialogError, setDialogError] = useState<string | null>(null);

  if (isLoading) return <Skeleton className="h-96 w-full rounded-xl" />;
  if (!data)
    return (
      <Alert tone="danger" title={tx("notFoundTitle")}>
        {tx("notFoundBody")}
      </Alert>
    );

  const { trade } = data;
  const isSeller = me?.id === trade.seller.id;
  const isBuyer = me?.id === trade.buyer.id;
  const counterparty = isSeller ? trade.buyer : trade.seller;
  const refresh = () => {
    void qc.invalidateQueries({ queryKey: qk.trade(id) });
    // Confirm (escrow release → buyer credit) and cancel/refund (→ seller) both move
    // money, so the cached wallet balance must be re-fetched too.
    void qc.invalidateQueries({ queryKey: qk.balances });
  };

  const confirmRelease = async (creds: { pin?: string; totpCode?: string }) => {
    setBusy(true);
    setDialogError(null);
    try {
      await api.confirmTrade(id, { ...creds, idempotencyKey: crypto.randomUUID() });
      setConfirmOpen(false);
      toast.success(tx("releasedTitle"), tx("releasedBody"));
      refresh();
    } catch (err) {
      setDialogError(apiErrorMessage(err, tx("couldNotConfirm")));
    } finally {
      setBusy(false);
    }
  };

  const cancel = async () => {
    setBusy(true);
    try {
      await api.cancelTrade(id, { idempotencyKey: crypto.randomUUID() });
      setCancelOpen(false);
      toast.success(tx("cancelledTitle"), tx("cancelledBody"));
      refresh();
    } catch (err) {
      toast.error(tx("couldNotCancel"), apiErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const terminal = ["COMPLETED", "CANCELLED", "EXPIRED", "RESOLVED_RELEASE", "RESOLVED_REFUND"].includes(trade.status);

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <PageHeader title={tx("headerTitle", { ref: trade.shortRef })} backHref="/trade" action={<TradeStatusBadge status={trade.status} />} />

      <Card>
        <StatusStepper status={trade.status} />
        {trade.status === "ESCROW_LOCKED" && trade.paymentDeadline && (
          <div className="mt-4 flex items-center justify-between rounded-lg bg-surface-2 px-3 py-2">
            <span className="flex items-center gap-1.5 text-sm text-text-2">
              <Keyhole size={16} className="text-accent-400" /> {tx("escrowLockedPayBefore")}
            </span>
            <Countdown deadline={trade.paymentDeadline} onExpire={refresh} />
          </div>
        )}
      </Card>

      {/* summary */}
      <Card className="space-y-2 text-sm">
        <Row label={tx("youTrade")} value={<Usdt value={trade.amount} size="sm" />} />
        <Row label={tx("fiatAmount")} value={<Xaf value={trade.fiatAmountXaf} />} />
        <Row label={tx("tradingFee")} value={<Usdt value={trade.feeAmount} size="sm" />} />
        {isSeller && trade.sellerFeeAmount !== "0" && (
          <Row label={tx("sellerFee")} value={<Usdt value={trade.sellerFeeAmount} size="sm" />} />
        )}
        <Row label={isBuyer ? tx("youReceive") : tx("buyerReceives")} value={<Usdt value={trade.buyerCredit} size="sm" className="text-accent-400" />} />
        <div className="flex items-center justify-between pt-1">
          <span className="text-text-2">{tx("paymentMethod")}</span>
          <PaymentMethodChip method={trade.paymentMethod} />
        </div>
        <Row label={isSeller ? tx("buyer") : tx("seller")} value={counterparty.displayName} />
      </Card>

      {/* ACTIONS by role + status */}
      {isBuyer && trade.status === "ESCROW_LOCKED" && <BuyerPayPanel trade={trade} onDone={refresh} />}

      {isBuyer && trade.status === "PAYMENT_SUBMITTED" && (
        <Alert tone="warning" title={tx("waitingSellerTitle")}>
          {tx("waitingSellerBody")}
        </Alert>
      )}

      {isSeller && trade.status === "ESCROW_LOCKED" && (
        <Alert tone="info" title={tx("waitingBuyerTitle")}>
          {tx("waitingBuyerBody")}
        </Alert>
      )}

      {isSeller && trade.status === "PAYMENT_SUBMITTED" && (
        <Card className="space-y-3">
          {trade.payment && (
            <div className="space-y-1.5 rounded-lg bg-surface-2 p-3 text-sm">
              <p className="font-medium text-text-1">{tx("buyerPaymentDetails")}</p>
              <Row label={tx("reference")} value={trade.payment.reference} />
              <Row label={tx("senderName")} value={trade.payment.senderName} />
              <Row label={tx("senderNumber")} value={trade.payment.senderNumber} />
            </div>
          )}
          {trade.payment && trade.payment.proofFiles.length > 0 && <ProofGallery tradeId={trade.id} />}
          <Alert tone="warning">
            {tx("confirmReceivedPrefix")} <Xaf value={trade.fiatAmountXaf} /> {tx("confirmReceivedSuffix")}
          </Alert>
          <div className="flex gap-2">
            <Button variant="secondary" className="flex-1" onClick={() => setDisputeOpen(true)}>
              {tx("notReceived")}
            </Button>
            <Button className="flex-1" onClick={() => setConfirmOpen(true)}>
              {tx("paymentReceived")}
            </Button>
          </div>
        </Card>
      )}

      {trade.status === "COMPLETED" && (
        <Alert tone="success" title={tx("tradeCompleteTitle")}>
          <span className="flex items-center gap-1.5">
            <CheckCircle2 size={16} /> {tx("tradeCompleteBody")}
          </span>
        </Alert>
      )}
      {(trade.status === "CANCELLED" || trade.status === "EXPIRED") && (
        <Alert tone="info" title={trade.status === "EXPIRED" ? tx("tradeExpiredTitle") : tx("tradeCancelledTitle")}>
          {tx("escrowReturned")}
        </Alert>
      )}
      {trade.status === "DISPUTED" && (
        <DisputePanel tradeId={id} disputeId={data.disputeId} meId={me?.id} />
      )}

      {/* secondary actions */}
      {!terminal && trade.status !== "DISPUTED" && (
        <div className="flex flex-wrap gap-2">
          {isBuyer && (trade.status === "ESCROW_LOCKED" || trade.status === "PAYMENT_SUBMITTED") && (
            <Button variant="ghost" size="sm" onClick={() => setCancelOpen(true)} disabled={busy} className="text-text-2">
              {tx("cancelTrade")}
            </Button>
          )}
          <Button variant="ghost" size="sm" onClick={() => setDisputeOpen(true)} className="text-danger">
            <AlertTriangle size={14} /> {tx("openDispute")}
          </Button>
        </div>
      )}

      <ChatPanel tradeId={id} meId={me?.id} disabled={terminal} />

      <SecurityDialog
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        title={tx("releaseDialogTitle")}
        description={tx("releaseDialogDesc")}
        actionLabel={tx("releaseFunds")}
        requirePin={Boolean(me?.pinSet)}
        requireTotp={Boolean(me?.totpEnabled)}
        busy={busy}
        error={dialogError}
        onConfirm={confirmRelease}
      />

      {/*
        Cancelling at PAYMENT_SUBMITTED refunds the escrow to the SELLER, and the
        buyer only reaches that status by declaring they already sent the fiat
        off-platform. Firing that straight off a ghost button — the only money
        action in this room without a confirmation — meant one stray tap could
        hand back the crypto after the money had left the buyer's bank. The
        warning is status-specific because at ESCROW_LOCKED nothing has been paid
        yet and cancelling is genuinely harmless.
      */}
      <Dialog
        open={cancelOpen}
        onClose={() => setCancelOpen(false)}
        title={tx("cancelDialogTitle")}
        description={
          trade.status === "PAYMENT_SUBMITTED" ? tx("cancelDialogDescPaid") : tx("cancelDialogDesc")
        }
      >
        <div className="space-y-4">
          {trade.status === "PAYMENT_SUBMITTED" && (
            <Alert tone="danger" title={tx("cancelWarnTitle")}>
              {tx("cancelWarnBody")}
            </Alert>
          )}
          <div className="flex gap-2">
            <Button variant="secondary" className="flex-1" onClick={() => setCancelOpen(false)} disabled={busy}>
              {tx("cancelDialogBack")}
            </Button>
            <Button variant="danger" className="flex-1" onClick={cancel} disabled={busy}>
              {busy ? <Spinner /> : tx("cancelDialogConfirm")}
            </Button>
          </div>
          {trade.status === "PAYMENT_SUBMITTED" && (
            <button
              type="button"
              className="w-full text-center text-xs text-text-3 underline underline-offset-2"
              onClick={() => {
                setCancelOpen(false);
                setDisputeOpen(true);
              }}
            >
              {tx("cancelDialogDisputeInstead")}
            </button>
          )}
        </div>
      </Dialog>

      <DisputeDialog
        open={disputeOpen}
        onClose={() => setDisputeOpen(false)}
        tradeId={id}
        onDone={() => {
          setDisputeOpen(false);
          refresh();
        }}
      />
    </div>
  );
}

function BuyerPayPanel({ trade, onDone }: { trade: Trade; onDone: () => void }): React.JSX.Element {
  const tx = useTranslations("tradeRoom");
  const toast = useToast();
  // Prefill the reference with the trade's short ref — the buyer should quote it so the seller can match.
  const [reference, setReference] = useState(trade.shortRef);
  const [senderName, setSenderName] = useState("");
  const [senderNumber, setSenderNumber] = useState("");
  const [proofFiles, setProofFiles] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const payTo = trade.sellerPayTo;

  const onPickProof = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setError(null);
    setUploading(true);
    try {
      for (const file of Array.from(files).slice(0, 5 - proofFiles.length)) {
        const dataUrl = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(String(reader.result));
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });
        const base64 = dataUrl.split(",")[1] ?? "";
        const { key } = await api.uploadTradeProof(trade.id, base64);
        setProofFiles((prev) => [...prev, key]);
      }
    } catch (err) {
      setError(apiErrorMessage(err, tx("proofUploadError")));
    } finally {
      setUploading(false);
    }
  };

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      await api.submitPayment(trade.id, { reference, senderName, senderNumber, proofFiles });
      toast.success(tx("paymentSentTitle"), tx("paymentSentBody"));
      onDone();
    } catch (err) {
      setError(apiErrorMessage(err, tx("couldNotSubmitPayment")));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card className="space-y-3">
      <div>
        <p className="font-medium">{tx("payOffPlatform")}</p>
        <p className="text-sm text-text-2">{tx("payOffPlatformBody")}</p>
      </div>

      {/* WHERE + HOW MUCH to pay */}
      <div className="space-y-3 rounded-xl border border-accent-400/30 bg-accent-400/5 p-4">
        <div className="flex items-center justify-between">
          <span className="text-sm text-text-2">{tx("amountToSend")}</span>
          <span className="font-money text-xl font-semibold">
            <Xaf value={trade.fiatAmountXaf} />
          </span>
        </div>
        {payTo ? (
          <>
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm text-text-2">{tx("payTo")}</span>
              <PaymentMethodChip method={payTo.method} />
            </div>
            <div className="flex items-center justify-between gap-2 rounded-lg bg-surface-2 px-3 py-2">
              <div className="min-w-0">
                <p className="font-money text-base font-semibold text-text-1">{payTo.number}</p>
                <p className="truncate text-xs text-text-3">{payTo.name}</p>
              </div>
              <CopyButton value={payTo.number} label={tx("copyNumber")} />
            </div>
            <div className="flex items-center justify-between gap-2 rounded-lg bg-surface-2 px-3 py-2">
              <div className="min-w-0">
                <p className="text-xs text-text-3">{tx("useReference")}</p>
                <p className="font-money text-sm font-medium text-text-1">{trade.shortRef}</p>
              </div>
              <CopyButton value={trade.shortRef} />
            </div>
          </>
        ) : (
          <Alert tone="warning">{tx("noSellerAccount")}</Alert>
        )}
      </div>

      <Field label={tx("paymentReference")} required>
        {(p) => <Input placeholder={tx("paymentReferencePlaceholder")} value={reference} onChange={(e) => setReference(e.target.value)} {...p} />}
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label={tx("senderName")} required>
          {(p) => <Input placeholder={tx("senderNamePlaceholder")} value={senderName} onChange={(e) => setSenderName(e.target.value)} {...p} />}
        </Field>
        <Field label={tx("senderNumber")} required>
          {(p) => <Input placeholder={tx("senderNumberPlaceholder")} value={senderNumber} onChange={(e) => setSenderNumber(e.target.value)} {...p} />}
        </Field>
      </div>

      {/* payment proof (optional receipt upload) */}
      <div>
        <p className="text-sm font-medium">{tx("proofFiles")}</p>
        <p className="mb-2 text-xs text-text-3">{tx("proofOptional")}</p>
        <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm transition-colors hover:bg-surface-2">
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            multiple
            className="hidden"
            disabled={uploading || proofFiles.length >= 5}
            onChange={(e) => void onPickProof(e.target.files)}
          />
          {uploading ? <Spinner /> : <Paperclip size={14} />} {tx("addProof")}
        </label>
        {proofFiles.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {proofFiles.map((key, i) => (
              <span key={key} className="inline-flex items-center gap-1 rounded-full bg-surface-2 px-2.5 py-1 text-xs">
                {tx("receipt")} {i + 1}
                <button
                  type="button"
                  aria-label={tx("remove")}
                  onClick={() => setProofFiles((prev) => prev.filter((k) => k !== key))}
                  className="text-text-3 hover:text-danger"
                >
                  <X size={12} />
                </button>
              </span>
            ))}
          </div>
        )}
      </div>

      {error && <Alert tone="danger">{error}</Alert>}
      <Button className="w-full" onClick={submit} disabled={busy || !reference || senderName.length < 2 || senderNumber.length < 5}>
        {busy ? <Spinner /> : tx("paidNotifySeller")}
      </Button>
    </Card>
  );
}

/** Seller/admin view of the buyer's uploaded receipts (short-TTL presigned image URLs). */
function ProofGallery({ tradeId }: { tradeId: string }): React.JSX.Element | null {
  const tx = useTranslations("tradeRoom");
  const { data } = useQuery({
    queryKey: ["trades", tradeId, "proof-urls"],
    queryFn: () => api.tradeProofUrls(tradeId),
  });
  if (!data || data.urls.length === 0) return null;
  return (
    <div>
      <p className="text-sm font-medium">{tx("proofFiles")}</p>
      <div className="mt-2 flex flex-wrap gap-2">
        {data.urls.map((url, i) => (
          <a key={i} href={url} target="_blank" rel="noreferrer noopener" className="block">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={url}
              alt={`${tx("receipt")} ${i + 1}`}
              className="h-20 w-20 rounded-lg border border-border object-cover transition-opacity hover:opacity-80"
            />
          </a>
        ))}
      </div>
    </div>
  );
}

function DisputeDialog({
  open,
  onClose,
  tradeId,
  onDone,
}: {
  open: boolean;
  onClose: () => void;
  tradeId: string;
  onDone: () => void;
}): React.JSX.Element {
  const tx = useTranslations("tradeRoom");
  const toast = useToast();
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      await api.openDispute(tradeId, { reason });
      toast.success(tx("disputeOpenedTitle"), tx("disputeOpenedBody"));
      onDone();
    } catch (err) {
      setError(apiErrorMessage(err, tx("couldNotOpenDispute")));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} title={tx("openDisputeDialogTitle")} description={tx("openDisputeDialogDesc")}>
      <div className="space-y-3">
        {error && <Alert tone="danger">{error}</Alert>}
        <Field label={tx("whatWentWrong")} hint={tx("whatWentWrongHint")}>
          {(p) => (
            <Textarea placeholder={tx("disputeReasonPlaceholder")} value={reason} onChange={(e) => setReason(e.target.value)} {...p} />
          )}
        </Field>
        <div className="flex gap-2">
          <Button variant="secondary" className="flex-1" onClick={onClose} disabled={busy}>
            {tx("cancel")}
          </Button>
          <Button variant="danger" className="flex-1" onClick={submit} disabled={busy || reason.trim().length < 10}>
            {busy ? <Spinner /> : tx("openDispute")}
          </Button>
        </div>
      </div>
    </Dialog>
  );
}

const EVIDENCE_KINDS = ["payment_proof", "chat_screenshot", "bank_statement", "other"] as const;
type EvidenceKind = (typeof EVIDENCE_KINDS)[number];

/**
 * The DISPUTED-state panel: view the dispute (reason, status, both parties' evidence
 * timeline) and submit new evidence (kind + note + uploaded files). Previously the
 * room only showed a static "in dispute" alert — the dispute could be opened but never
 * viewed or evidenced. Loads via the disputeId now surfaced on the trade detail.
 */
function DisputePanel({
  tradeId,
  disputeId,
  meId,
}: {
  tradeId: string;
  disputeId: string | null;
  meId?: string;
}): React.JSX.Element {
  const tx = useTranslations("tradeRoom");
  const toast = useToast();
  const { data: dispute, isLoading } = useDispute(disputeId);
  const submitEvidence = useSubmitEvidence(disputeId ?? "", tradeId);

  const [kind, setKind] = useState<EvidenceKind>("payment_proof");
  const [note, setNote] = useState("");
  const [files, setFiles] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onPickFiles = async (picked: FileList | null) => {
    if (!picked || picked.length === 0 || !disputeId) return;
    setError(null);
    setUploading(true);
    try {
      for (const file of Array.from(picked).slice(0, 10 - files.length)) {
        const dataUrl = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(String(reader.result));
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });
        const base64 = dataUrl.split(",")[1] ?? "";
        const { key } = await api.uploadDisputeEvidence(disputeId, base64);
        setFiles((prev) => [...prev, key]);
      }
    } catch (err) {
      setError(apiErrorMessage(err, tx("evidenceUploadError")));
    } finally {
      setUploading(false);
    }
  };

  const submit = () => {
    if (!disputeId) return;
    setError(null);
    submitEvidence.mutate(
      { kind, note: note.trim() || undefined, files },
      {
        onSuccess: () => {
          toast.success(tx("evidenceSubmittedTitle"), tx("evidenceSubmittedBody"));
          setNote("");
          setFiles([]);
          setKind("payment_proof");
        },
        onError: (err) => setError(apiErrorMessage(err, tx("evidenceSubmitError"))),
      },
    );
  };

  const resolved = Boolean(dispute?.resolvedAt);
  const canSubmit = !submitEvidence.isPending && !uploading && (note.trim() !== "" || files.length > 0);

  return (
    <div className="space-y-3">
      <Alert tone="danger" title={tx("inDisputeTitle")}>
        {tx("inDisputeBody")}
      </Alert>

      <Card className="space-y-4">
        {isLoading || !dispute ? (
          <Skeleton className="h-24 w-full rounded-xl" />
        ) : (
          <>
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-medium">{tx("disputeReasonLabel")}</span>
              <span
                className={cn(
                  "rounded-full px-2 py-0.5 text-xs",
                  resolved ? "bg-success/15 text-success" : "bg-warning/15 text-warning",
                )}
              >
                {resolved ? tx("disputeResolved") : tx("disputeUnderReview")}
              </span>
            </div>
            <p className="rounded-lg border border-border bg-surface-1 p-3 text-sm text-text-2">{dispute.reason}</p>

            <div>
              <p className="mb-2 text-sm font-medium">{tx("evidenceHeading")}</p>
              {dispute.evidence.length === 0 ? (
                <p className="text-sm text-text-3">{tx("evidenceEmpty")}</p>
              ) : (
                <ul className="space-y-2">
                  {dispute.evidence.map((e) => (
                    <li key={e.id} className="rounded-lg border border-border bg-surface-1 p-3 text-sm">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-medium">{tx(`kind_${e.kind}` as `kind_${EvidenceKind}`)}</span>
                        <span className="text-xs text-text-3">
                          {e.submittedBy === meId ? tx("youLabel") : tx("otherPartyLabel")} · {timeAgo(e.createdAt)}
                        </span>
                      </div>
                      {e.note && <p className="mt-1 text-text-2">{e.note}</p>}
                      {e.files.length > 0 && (
                        <p className="mt-1 flex items-center gap-1 text-xs text-text-3">
                          <Paperclip size={12} /> {tx("filesCount", { count: e.files.length })}
                        </p>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {!resolved && (
              <div className="space-y-3 border-t border-border pt-4">
                <p className="text-sm font-medium">{tx("addEvidenceTitle")}</p>
                {error && <Alert tone="danger">{error}</Alert>}
                <div>
                  <p className="mb-1.5 text-xs font-medium text-text-2">{tx("evidenceKindLabel")}</p>
                  <div className="flex flex-wrap gap-2">
                    {EVIDENCE_KINDS.map((k) => (
                      <button
                        key={k}
                        type="button"
                        onClick={() => setKind(k)}
                        aria-pressed={kind === k}
                        className={cn(
                          "rounded-full border px-3 py-1 text-xs transition-colors",
                          kind === k ? "border-accent-400 text-text-1" : "border-border text-text-2 hover:text-text-1",
                        )}
                      >
                        {tx(`kind_${k}`)}
                      </button>
                    ))}
                  </div>
                </div>
                <Field label={tx("evidenceNoteLabel")}>
                  {(p) => (
                    <Textarea
                      {...p}
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                      placeholder={tx("evidenceNotePlaceholder")}
                      maxLength={2000}
                      rows={3}
                    />
                  )}
                </Field>
                <div className="flex flex-wrap items-center gap-3">
                  <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm text-text-2 transition-colors hover:text-text-1">
                    <Paperclip size={15} /> {tx("attachFiles")}
                    <input
                      type="file"
                      multiple
                      accept="image/*,application/pdf"
                      className="hidden"
                      onChange={(e) => onPickFiles(e.target.files)}
                    />
                  </label>
                  {uploading && <Spinner />}
                  {files.length > 0 && (
                    <span className="text-xs text-text-3">{tx("filesCount", { count: files.length })}</span>
                  )}
                </div>
                <div className="flex justify-end">
                  <Button variant="danger" onClick={submit} disabled={!canSubmit}>
                    {submitEvidence.isPending ? <Spinner /> : tx("submitEvidenceBtn")}
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </Card>
    </div>
  );
}

function ChatPanel({ tradeId, meId, disabled }: { tradeId: string; meId?: string; disabled: boolean }): React.JSX.Element {
  const tx = useTranslations("tradeRoom");
  const { data } = useMessages(tradeId, !disabled);
  const send = useSendMessage(tradeId);
  const [text, setText] = useState("");

  const onSend = () => {
    const body = text.trim();
    if (!body) return;
    send.mutate({ body });
    setText("");
  };

  return (
    <Card className="flex flex-col">
      <p className="mb-3 font-medium">{tx("chat")}</p>
      <div
        className="flex max-h-72 min-h-24 flex-col gap-2 overflow-y-auto"
        role="log"
        aria-live="polite"
        aria-relevant="additions"
        aria-label={tx("chat")}
      >
        {!data || data.messages.length === 0 ? (
          <p className="py-6 text-center text-sm text-text-3">{tx("noMessages")}</p>
        ) : (
          data.messages.map((m) => {
            const mine = m.senderId === meId;
            return (
              <div key={m.id} className={mine ? "flex justify-end" : "flex justify-start"}>
                <div
                  className={
                    mine
                      ? "max-w-[80%] rounded-2xl rounded-br-sm bg-accent-400/15 px-3 py-1.5 text-sm text-text-1"
                      : "max-w-[80%] rounded-2xl rounded-bl-sm bg-surface-2 px-3 py-1.5 text-sm text-text-1"
                  }
                >
                  {m.body}
                  <span className="mt-0.5 block text-[10px] text-text-3">{timeAgo(m.createdAt)}</span>
                </div>
              </div>
            );
          })
        )}
      </div>
      {!disabled && (
        <div className="mt-3 flex gap-2">
          <Input
            placeholder={tx("messagePlaceholder")}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") onSend();
            }}
            aria-label={tx("messageAriaLabel")}
          />
          <Button size="sm" onClick={onSend} disabled={send.isPending || !text.trim()} aria-label={tx("sendAriaLabel")}>
            <Send size={16} />
          </Button>
        </div>
      )}
    </Card>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }): React.JSX.Element {
  return (
    <div className="flex items-center justify-between">
      <span className="text-text-2">{label}</span>
      <span className="font-medium text-text-1">{value}</span>
    </div>
  );
}
