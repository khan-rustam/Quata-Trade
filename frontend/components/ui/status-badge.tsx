import type { TradeStatus, WithdrawalStatus, DepositStatus } from "@quatatrade/shared";
import { Badge } from "./badge";

type Tone = "neutral" | "success" | "danger" | "warning" | "info" | "escrow";

const TRADE: Record<TradeStatus, { tone: Tone; label: string }> = {
  OPENED: { tone: "info", label: "Opened" },
  ESCROW_LOCKED: { tone: "escrow", label: "Escrow locked" },
  PAYMENT_SUBMITTED: { tone: "warning", label: "Payment submitted" },
  COMPLETED: { tone: "success", label: "Completed" },
  CANCELLED: { tone: "neutral", label: "Cancelled" },
  EXPIRED: { tone: "neutral", label: "Expired" },
  DISPUTED: { tone: "danger", label: "Disputed" },
  RESOLVED_RELEASE: { tone: "success", label: "Resolved · released" },
  RESOLVED_REFUND: { tone: "neutral", label: "Resolved · refunded" },
};

const WITHDRAWAL: Record<WithdrawalStatus, { tone: Tone; label: string }> = {
  REQUESTED: { tone: "info", label: "Requested" },
  RISK_HOLD: { tone: "warning", label: "Risk review" },
  PENDING_APPROVAL: { tone: "warning", label: "Pending approval" },
  APPROVED: { tone: "info", label: "Approved" },
  SIGNING: { tone: "info", label: "Signing" },
  BROADCAST: { tone: "info", label: "Broadcasting" },
  CONFIRMED: { tone: "success", label: "Confirmed" },
  REJECTED: { tone: "danger", label: "Rejected" },
  FAILED: { tone: "danger", label: "Failed" },
};

const DEPOSIT: Record<DepositStatus, { tone: Tone; label: string }> = {
  SEEN: { tone: "info", label: "Seen" },
  CONFIRMING: { tone: "warning", label: "Confirming" },
  CREDITED: { tone: "success", label: "Credited" },
  ORPHANED: { tone: "danger", label: "Orphaned" },
  IGNORED_DUST: { tone: "neutral", label: "Dust" },
};

export function TradeStatusBadge({ status }: { status: TradeStatus }): React.JSX.Element {
  const s = TRADE[status];
  return <Badge tone={s.tone}>{s.label}</Badge>;
}

export function WithdrawalStatusBadge({ status }: { status: WithdrawalStatus }): React.JSX.Element {
  const s = WITHDRAWAL[status];
  return <Badge tone={s.tone}>{s.label}</Badge>;
}

export function DepositStatusBadge({ status }: { status: DepositStatus }): React.JSX.Element {
  const s = DEPOSIT[status];
  return <Badge tone={s.tone}>{s.label}</Badge>;
}
