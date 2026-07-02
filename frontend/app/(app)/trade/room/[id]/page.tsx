"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, CheckCircle2, Send } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { Input, Textarea } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
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
import { qk } from "@/lib/api/query-keys";
import { api } from "@/lib/api/client";
import { apiErrorMessage } from "@/lib/api/errors";
import { timeAgo } from "@/lib/format";

export default function TradeRoomPage(): React.JSX.Element {
  const { id } = useParams<{ id: string }>();
  const { data: me } = useMe();
  const { data, isLoading } = useTrade(id, true);
  const qc = useQueryClient();
  const toast = useToast();

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [disputeOpen, setDisputeOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [dialogError, setDialogError] = useState<string | null>(null);

  if (isLoading) return <Skeleton className="h-96 w-full rounded-xl" />;
  if (!data)
    return (
      <Alert tone="danger" title="Trade not found">
        This trade doesn&rsquo;t exist or you don&rsquo;t have access.
      </Alert>
    );

  const { trade } = data;
  const isSeller = me?.id === trade.seller.id;
  const isBuyer = me?.id === trade.buyer.id;
  const counterparty = isSeller ? trade.buyer : trade.seller;
  const refresh = () => void qc.invalidateQueries({ queryKey: qk.trade(id) });

  const confirmRelease = async (creds: { pin?: string; totpCode?: string }) => {
    setBusy(true);
    setDialogError(null);
    try {
      await api.confirmTrade(id, { ...creds, idempotencyKey: crypto.randomUUID() });
      setConfirmOpen(false);
      toast.success("Released", "Funds released to the buyer.");
      refresh();
    } catch (err) {
      setDialogError(apiErrorMessage(err, "Could not confirm"));
    } finally {
      setBusy(false);
    }
  };

  const cancel = async () => {
    setBusy(true);
    try {
      await api.cancelTrade(id, { idempotencyKey: crypto.randomUUID() });
      toast.success("Trade cancelled", "Escrow was returned to the seller.");
      refresh();
    } catch (err) {
      toast.error("Could not cancel", apiErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const terminal = ["COMPLETED", "CANCELLED", "EXPIRED", "RESOLVED_RELEASE", "RESOLVED_REFUND"].includes(trade.status);

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <PageHeader title={`Trade ${trade.shortRef}`} backHref="/trade" action={<TradeStatusBadge status={trade.status} />} />

      <Card>
        <StatusStepper status={trade.status} />
        {trade.status === "ESCROW_LOCKED" && trade.paymentDeadline && (
          <div className="mt-4 flex items-center justify-between rounded-lg bg-surface-2 px-3 py-2">
            <span className="flex items-center gap-1.5 text-sm text-text-2">
              <Keyhole size={16} className="text-accent-400" /> Escrow locked · pay before
            </span>
            <Countdown deadline={trade.paymentDeadline} onExpire={refresh} />
          </div>
        )}
      </Card>

      {/* summary */}
      <Card className="space-y-2 text-sm">
        <Row label="You trade" value={<Usdt value={trade.amount} size="sm" />} />
        <Row label="Fiat amount" value={<Xaf value={trade.fiatAmountXaf} />} />
        <Row label="Trading fee" value={<Usdt value={trade.feeAmount} size="sm" />} />
        <Row label={isBuyer ? "You receive" : "Buyer receives"} value={<Usdt value={trade.buyerCredit} size="sm" className="text-accent-400" />} />
        <div className="flex items-center justify-between pt-1">
          <span className="text-text-2">Payment method</span>
          <PaymentMethodChip method={trade.paymentMethod} />
        </div>
        <Row label={isSeller ? "Buyer" : "Seller"} value={counterparty.displayName} />
      </Card>

      {/* ACTIONS by role + status */}
      {isBuyer && trade.status === "ESCROW_LOCKED" && <BuyerPayPanel tradeId={id} onDone={refresh} />}

      {isBuyer && trade.status === "PAYMENT_SUBMITTED" && (
        <Alert tone="warning" title="Waiting for the seller">
          You&rsquo;ve marked payment sent. The seller will confirm once they see the funds in their account.
        </Alert>
      )}

      {isSeller && trade.status === "ESCROW_LOCKED" && (
        <Alert tone="info" title="Waiting for the buyer">
          The buyer is making the off-platform payment. Do not release until you&rsquo;ve confirmed the money in YOUR account.
        </Alert>
      )}

      {isSeller && trade.status === "PAYMENT_SUBMITTED" && (
        <Card className="space-y-3">
          {trade.payment && (
            <div className="space-y-1.5 rounded-lg bg-surface-2 p-3 text-sm">
              <p className="font-medium text-text-1">Buyer&rsquo;s payment details</p>
              <Row label="Reference" value={trade.payment.reference} />
              <Row label="Sender name" value={trade.payment.senderName} />
              <Row label="Sender number" value={trade.payment.senderNumber} />
            </div>
          )}
          <Alert tone="warning">
            Confirm you received <Xaf value={trade.fiatAmountXaf} /> in YOUR own account before releasing. A screenshot is not money.
          </Alert>
          <div className="flex gap-2">
            <Button variant="secondary" className="flex-1" onClick={() => setDisputeOpen(true)}>
              Not received
            </Button>
            <Button className="flex-1" onClick={() => setConfirmOpen(true)}>
              Payment received
            </Button>
          </div>
        </Card>
      )}

      {trade.status === "COMPLETED" && (
        <Alert tone="success" title="Trade complete">
          <span className="flex items-center gap-1.5">
            <CheckCircle2 size={16} /> Funds released. Thanks for trading safely.
          </span>
        </Alert>
      )}
      {(trade.status === "CANCELLED" || trade.status === "EXPIRED") && (
        <Alert tone="info" title={trade.status === "EXPIRED" ? "Trade expired" : "Trade cancelled"}>
          Escrow was returned to the seller.
        </Alert>
      )}
      {trade.status === "DISPUTED" && (
        <Alert tone="danger" title="In dispute">
          Escrow is frozen while an admin reviews the evidence. You&rsquo;ll be notified of the resolution.
        </Alert>
      )}

      {/* secondary actions */}
      {!terminal && trade.status !== "DISPUTED" && (
        <div className="flex flex-wrap gap-2">
          {isBuyer && (trade.status === "ESCROW_LOCKED" || trade.status === "PAYMENT_SUBMITTED") && (
            <Button variant="ghost" size="sm" onClick={cancel} disabled={busy} className="text-text-2">
              Cancel trade
            </Button>
          )}
          <Button variant="ghost" size="sm" onClick={() => setDisputeOpen(true)} className="text-danger">
            <AlertTriangle size={14} /> Open dispute
          </Button>
        </div>
      )}

      <ChatPanel tradeId={id} meId={me?.id} disabled={terminal} />

      <SecurityDialog
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        title="Release escrow to buyer"
        description="Only do this after the money is in your account."
        actionLabel="Release funds"
        requirePin={Boolean(me?.pinSet)}
        requireTotp={Boolean(me?.totpEnabled)}
        busy={busy}
        error={dialogError}
        onConfirm={confirmRelease}
      />

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

function BuyerPayPanel({ tradeId, onDone }: { tradeId: string; onDone: () => void }): React.JSX.Element {
  const toast = useToast();
  const [reference, setReference] = useState("");
  const [senderName, setSenderName] = useState("");
  const [senderNumber, setSenderNumber] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      await api.submitPayment(tradeId, { reference, senderName, senderNumber, proofFiles: [] });
      toast.success("Payment marked as sent", "The seller will confirm shortly.");
      onDone();
    } catch (err) {
      setError(apiErrorMessage(err, "Could not submit payment"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card className="space-y-3">
      <div>
        <p className="font-medium">Pay the seller off-platform</p>
        <p className="text-sm text-text-2">Send the exact fiat amount, then enter your payment details below.</p>
      </div>
      <Field label="Payment reference" required>
        {(p) => <Input placeholder="Transaction ID / reference" value={reference} onChange={(e) => setReference(e.target.value)} {...p} />}
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Sender name" required>
          {(p) => <Input placeholder="Your name" value={senderName} onChange={(e) => setSenderName(e.target.value)} {...p} />}
        </Field>
        <Field label="Sender number" required>
          {(p) => <Input placeholder="+2376..." value={senderNumber} onChange={(e) => setSenderNumber(e.target.value)} {...p} />}
        </Field>
      </div>
      {error && <Alert tone="danger">{error}</Alert>}
      <Button className="w-full" onClick={submit} disabled={busy || !reference || senderName.length < 2 || senderNumber.length < 5}>
        {busy ? <Spinner /> : "I've paid — notify seller"}
      </Button>
    </Card>
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
  const toast = useToast();
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      await api.openDispute(tradeId, { reason });
      toast.success("Dispute opened", "An admin will review the trade.");
      onDone();
    } catch (err) {
      setError(apiErrorMessage(err, "Could not open dispute"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} title="Open a dispute" description="Freeze the escrow and ask an admin to review.">
      <div className="space-y-3">
        {error && <Alert tone="danger">{error}</Alert>}
        <Field label="What went wrong?" hint="Be specific — this helps the admin resolve fairly.">
          {(p) => (
            <Textarea placeholder="Describe the issue (min 10 characters)…" value={reason} onChange={(e) => setReason(e.target.value)} {...p} />
          )}
        </Field>
        <div className="flex gap-2">
          <Button variant="secondary" className="flex-1" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button variant="danger" className="flex-1" onClick={submit} disabled={busy || reason.trim().length < 10}>
            {busy ? <Spinner /> : "Open dispute"}
          </Button>
        </div>
      </div>
    </Dialog>
  );
}

function ChatPanel({ tradeId, meId, disabled }: { tradeId: string; meId?: string; disabled: boolean }): React.JSX.Element {
  const { data } = useMessages(tradeId);
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
      <p className="mb-3 font-medium">Chat</p>
      <div className="flex max-h-72 min-h-24 flex-col gap-2 overflow-y-auto">
        {!data || data.messages.length === 0 ? (
          <p className="py-6 text-center text-sm text-text-3">No messages yet. Say hello 👋</p>
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
            placeholder="Type a message…"
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") onSend();
            }}
            aria-label="Message"
          />
          <Button size="sm" onClick={onSend} disabled={send.isPending || !text.trim()} aria-label="Send">
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
