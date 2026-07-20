"use client";

import { useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowDownToLine, ArrowUpFromLine, Download, History, RefreshCw, Send, ShieldAlert } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { Button, buttonClassName } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Usdt } from "@/components/ui/amount";
import { Skeleton } from "@/components/ui/skeleton";
import { Segmented } from "@/components/ui/segmented";
import { EmptyState } from "@/components/ui/empty-state";
import { DepositStatusBadge, WithdrawalStatusBadge } from "@/components/ui/status-badge";
import { Keyhole } from "@/components/brand/keyhole";
import { shortHash, formatDateTime } from "@/lib/format";
import { toCsv, downloadCsv, type CsvColumn } from "@/lib/csv";
import { qk } from "@/lib/api/query-keys";
import { toDisplay, type Deposit, type Withdrawal } from "@quatatrade/shared";
import { useBalances, useDeposits, useWithdrawals } from "@/hooks/use-wallet";
import { TransactionReceipt } from "@/components/wallet/transaction-receipt";

const usdtCell = (raw: string) => toDisplay(raw, "USDT_TRC20", 6);

/** CSV columns for the user's transaction-history export (English headers). */
const DEPOSIT_CSV: readonly CsvColumn<Deposit>[] = [
  { header: "Date", value: (d) => formatDateTime(d.createdAt) },
  { header: "Type", value: () => "Deposit" },
  { header: "Amount (USDT)", value: (d) => usdtCell(d.amount) },
  { header: "Fee (USDT)", value: (d) => usdtCell(d.fee) },
  { header: "Net (USDT)", value: (d) => usdtCell(d.net) },
  { header: "Status", value: (d) => d.status },
  { header: "Tx hash", value: (d) => d.txHash },
];
const WITHDRAWAL_CSV: readonly CsvColumn<Withdrawal>[] = [
  { header: "Date", value: (w) => formatDateTime(w.createdAt) },
  { header: "Type", value: () => "Withdrawal" },
  { header: "Amount (USDT)", value: (w) => usdtCell(w.amount) },
  { header: "Fee (USDT)", value: (w) => usdtCell(w.fee) },
  { header: "Network fee (USDT)", value: (w) => usdtCell(w.networkFeeEstimate) },
  { header: "Status", value: (w) => w.status },
  { header: "Destination", value: (w) => w.toAddress },
  { header: "Tx hash", value: (w) => w.txHash ?? "" },
];

export default function WalletPage(): React.JSX.Element {
  const tx = useTranslations("wallet");
  const qc = useQueryClient();
  const { data: balances, isLoading, isFetching } = useBalances();
  const usdt = balances?.balances.find((b) => b.asset === "USDT_TRC20");
  const restricted = balances?.status === "restricted";
  const pending = usdt?.pending ?? "0";
  const [tab, setTab] = useState<"deposits" | "withdrawals">("deposits");

  return (
    <div className="space-y-5">
      <PageHeader title={tx("title")} subtitle={tx("subtitle")} />

      {restricted && (
        <Badge tone="warning" icon={<ShieldAlert size={13} />}>
          {tx("accountRestricted")}
        </Badge>
      )}

      <Card>
        <div className="flex items-start justify-between">
          <p className="text-sm text-text-2">{tx("available")}</p>
          <button
            type="button"
            onClick={() => void qc.invalidateQueries({ queryKey: qk.balances })}
            className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-text-3 transition-colors hover:bg-surface-3 hover:text-text-1"
            aria-label={tx("refresh")}
          >
            <RefreshCw size={13} className={isFetching ? "animate-spin" : ""} /> {tx("refresh")}
          </button>
        </div>
        {isLoading ? (
          <Skeleton className="mt-2 h-8 w-44" />
        ) : (
          <div className="mt-1">
            <Usdt value={usdt?.available ?? "0"} size="xl" />
          </div>
        )}
        <div className="mt-3 flex items-center gap-2 rounded-lg bg-surface-2 px-3 py-2 text-sm">
          <Keyhole size={16} className="text-accent-400" />
          <span className="text-text-2">{tx("inEscrow")}</span>
          <Usdt value={usdt?.inEscrow ?? "0"} size="sm" className="ml-auto" />
        </div>
        {pending !== "0" && (
          <div className="mt-2 flex items-center gap-2 rounded-lg bg-surface-2 px-3 py-2 text-sm">
            <ArrowDownToLine size={16} className="text-warning" />
            <span className="text-text-2">{tx("pending")}</span>
            <Usdt value={pending} size="sm" className="ml-auto" />
          </div>
        )}
        <div className="mt-4 grid grid-cols-3 gap-2">
          <WalletAction href="/wallet/deposit" icon={<ArrowDownToLine size={18} />} label={tx("deposit")} />
          <WalletAction href="/wallet/withdraw" icon={<ArrowUpFromLine size={18} />} label={tx("withdraw")} />
          <WalletAction href="/wallet/transfer" icon={<Send size={18} />} label={tx("transfer")} />
        </div>
      </Card>

      <div className="flex items-center justify-between">
        <h2 className="font-display text-lg font-medium">{tx("history")}</h2>
        <Segmented
          value={tab}
          onChange={setTab}
          aria-label={tx("historyType")}
          options={[
            { value: "deposits", label: tx("deposits") },
            { value: "withdrawals", label: tx("withdrawals") },
          ]}
        />
      </div>

      {tab === "deposits" ? <DepositsList /> : <WithdrawalsList />}
    </div>
  );
}

function WalletAction({ href, icon, label }: { href: string; icon: React.ReactNode; label: string }): React.JSX.Element {
  return (
    <Link
      href={href}
      className="flex flex-col items-center gap-1.5 rounded-lg bg-surface-2 py-3 text-xs font-medium transition-colors hover:bg-surface-3"
    >
      <span className="text-accent-400">{icon}</span>
      {label}
    </Link>
  );
}

function DepositsList(): React.JSX.Element {
  const tx = useTranslations("wallet");
  const { data, isLoading } = useDeposits(1);
  const [receipt, setReceipt] = useState<Deposit | null>(null);
  if (isLoading) return <ListSkeleton />;
  if (!data || data.items.length === 0) {
    return (
      <EmptyState
        image="/assets/empty-wallet.png"
        title={tx("noDepositsTitle")}
        description={tx("noDepositsDescription")}
        action={
          <Link href="/wallet/deposit" className={buttonClassName({ size: "sm" })}>
            {tx("getDepositAddress")}
          </Link>
        }
      />
    );
  }
  return (
    <>
      <div className="mb-2 flex justify-end">
        <Button size="sm" variant="secondary" onClick={() => downloadCsv("quatatrade-deposits", toCsv(data.items, DEPOSIT_CSV))}>
          <Download size={13} /> {tx("export")}
        </Button>
      </div>
      <div className="divide-y divide-border overflow-hidden rounded-xl border border-border">
        {data.items.map((d) => (
          <button
            key={d.id}
            type="button"
            onClick={() => setReceipt(d)}
            className="flex w-full items-center justify-between px-4 py-3 text-left transition-colors hover:bg-surface-2"
            aria-label={tx("viewReceipt")}
          >
            <div className="min-w-0">
              <p className="font-money text-sm">{shortHash(d.txHash)}</p>
              <p className="text-xs text-text-3">{formatDateTime(d.createdAt)}</p>
              {d.fee !== "0" && (
                <p className="text-xs text-text-3">
                  {tx("depositFeeNote", { fee: toDisplay(d.fee, "USDT_TRC20", 2), net: toDisplay(d.net, "USDT_TRC20", 2) })}
                </p>
              )}
              {/* A badge alone doesn't tell someone why their money has stopped
                  moving or whether they need to do anything. */}
              {d.holdResolution === "REJECTED" ? (
                <p className="text-xs text-danger">{tx("depositRejectedNote")}</p>
              ) : d.onHold ? (
                <p className="text-xs text-warning">{tx("depositOnHoldNote")}</p>
              ) : null}
            </div>
            <div className="flex items-center gap-3">
              <Usdt value={d.amount} size="sm" showUnit={false} />
              <DepositStatusBadge status={d.status} onHold={d.onHold} holdResolution={d.holdResolution} />
            </div>
          </button>
        ))}
      </div>
      {receipt && <TransactionReceipt kind="deposit" data={receipt} open onClose={() => setReceipt(null)} />}
    </>
  );
}

function WithdrawalsList(): React.JSX.Element {
  const tx = useTranslations("wallet");
  const { data, isLoading } = useWithdrawals(1);
  const [receipt, setReceipt] = useState<Withdrawal | null>(null);
  if (isLoading) return <ListSkeleton />;
  if (!data || data.items.length === 0) {
    return <EmptyState icon={History} title={tx("noWithdrawalsTitle")} description={tx("noWithdrawalsDescription")} />;
  }
  return (
    <>
      <div className="mb-2 flex justify-end">
        <Button size="sm" variant="secondary" onClick={() => downloadCsv("quatatrade-withdrawals", toCsv(data.items, WITHDRAWAL_CSV))}>
          <Download size={13} /> {tx("export")}
        </Button>
      </div>
      <div className="divide-y divide-border overflow-hidden rounded-xl border border-border">
        {data.items.map((w) => (
          <button
            key={w.id}
            type="button"
            onClick={() => setReceipt(w)}
            className="flex w-full items-center justify-between px-4 py-3 text-left transition-colors hover:bg-surface-2"
            aria-label={tx("viewReceipt")}
          >
            <div className="min-w-0">
              <p className="font-money text-sm">{shortHash(w.toAddress)}</p>
              <p className="text-xs text-text-3">{formatDateTime(w.createdAt)}</p>
            </div>
            <div className="flex items-center gap-3">
              <Usdt value={w.amount} size="sm" showUnit={false} />
              <WithdrawalStatusBadge status={w.status} />
            </div>
          </button>
        ))}
      </div>
      {receipt && <TransactionReceipt kind="withdrawal" data={receipt} open onClose={() => setReceipt(null)} />}
    </>
  );
}

function ListSkeleton(): React.JSX.Element {
  return (
    <div className="space-y-2">
      {Array.from({ length: 3 }).map((_, i) => (
        <Skeleton key={i} className="h-14 w-full rounded-xl" />
      ))}
    </div>
  );
}
