"use client";

import { useTranslations } from "next-intl";
import { ArrowDownToLine, ArrowUpFromLine, ExternalLink } from "lucide-react";
import type { Deposit, Withdrawal } from "@quatatrade/shared";
import { Dialog } from "@/components/ui/dialog";
import { Usdt } from "@/components/ui/amount";
import { Badge } from "@/components/ui/badge";
import { DepositStatusBadge, WithdrawalStatusBadge } from "@/components/ui/status-badge";
import { CopyButton } from "@/components/ui/copy-button";
import { formatDateTime } from "@/lib/format";

/** Public block explorer for the on-chain tx id (mainnet at launch). */
const EXPLORER = "https://tronscan.org/#/transaction/";

type Props =
  | { kind: "deposit"; data: Deposit; open: boolean; onClose: () => void }
  | { kind: "withdrawal"; data: Withdrawal; open: boolean; onClose: () => void };

/**
 * Permanent transaction receipt (client spec: amount, fees, network cost, final
 * amount, date, status, tx id, type). Read-only breakdown shown from wallet
 * history — every value the platform charged, transparently.
 */
export function TransactionReceipt(props: Props): React.JSX.Element {
  const tx = useTranslations("walletReceipt");
  const title = props.kind === "deposit" ? tx("titleDeposit") : tx("titleWithdrawal");
  return (
    <Dialog open={props.open} onClose={props.onClose} title={title} description={tx("subtitle")}>
      <div className="space-y-2.5">{props.kind === "deposit" ? <DepositBody d={props.data} /> : <WithdrawalBody w={props.data} />}</div>
    </Dialog>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }): React.JSX.Element {
  return (
    <div className="flex items-start justify-between gap-4 text-sm">
      <span className="text-text-3">{label}</span>
      <span className="text-right font-medium text-text-1">{children}</span>
    </div>
  );
}

function TxId({ hash }: { hash: string }): React.JSX.Element {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="font-money text-xs">
        {hash.slice(0, 8)}…{hash.slice(-6)}
      </span>
      <CopyButton value={hash} />
      <a href={`${EXPLORER}${hash}`} target="_blank" rel="noopener noreferrer" className="text-accent-400" aria-label="explorer">
        <ExternalLink size={13} />
      </a>
    </span>
  );
}

function DepositBody({ d }: { d: Deposit }): React.JSX.Element {
  const tx = useTranslations("walletReceipt");
  return (
    <>
      <Row label={tx("type")}>
        <Badge tone="success" icon={<ArrowDownToLine size={12} />}>
          {tx("deposit")}
        </Badge>
      </Row>
      <Row label={tx("amount")}>
        <Usdt value={d.amount} size="sm" />
      </Row>
      <Row label={tx("platformFee")}>
        <Usdt value={d.fee} size="sm" />
      </Row>
      <hr className="border-border" />
      <Row label={tx("netCredited")}>
        <Usdt value={d.net} size="sm" />
      </Row>
      <Row label={tx("status")}>
        <DepositStatusBadge status={d.status} />
      </Row>
      <Row label={tx("confirmations")}>{d.confirmations}</Row>
      <Row label={tx("txId")}>
        <TxId hash={d.txHash} />
      </Row>
      <Row label={tx("date")}>{formatDateTime(d.createdAt)}</Row>
    </>
  );
}

function WithdrawalBody({ w }: { w: Withdrawal }): React.JSX.Element {
  const tx = useTranslations("walletReceipt");
  const total = (BigInt(w.amount) + BigInt(w.fee)).toString();
  return (
    <>
      <Row label={tx("type")}>
        <Badge tone="warning" icon={<ArrowUpFromLine size={12} />}>
          {tx("withdrawal")}
        </Badge>
      </Row>
      <Row label={tx("amount")}>
        <Usdt value={w.amount} size="sm" />
      </Row>
      <Row label={tx("platformFee")}>
        <Usdt value={w.fee} size="sm" />
      </Row>
      <Row label={tx("networkFee")}>
        <Usdt value={w.networkFeeEstimate} size="sm" />
      </Row>
      <hr className="border-border" />
      <Row label={tx("totalDebited")}>
        <Usdt value={total} size="sm" />
      </Row>
      <Row label={tx("destination")}>
        <span className="inline-flex items-center gap-1.5">
          <span className="font-money text-xs">
            {w.toAddress.slice(0, 6)}…{w.toAddress.slice(-4)}
          </span>
          <CopyButton value={w.toAddress} />
        </span>
      </Row>
      <Row label={tx("status")}>
        <WithdrawalStatusBadge status={w.status} />
      </Row>
      <Row label={tx("txId")}>{w.txHash ? <TxId hash={w.txHash} /> : <span className="text-text-3">{tx("pending")}</span>}</Row>
      {w.failureReason && <Row label={tx("failure")}>{w.failureReason}</Row>}
      <Row label={tx("date")}>{formatDateTime(w.createdAt)}</Row>
    </>
  );
}
