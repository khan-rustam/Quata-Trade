"use client";

import { useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { ArrowDownToLine, ArrowUpFromLine, History, Send } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { buttonClassName } from "@/components/ui/button";
import { Usdt } from "@/components/ui/amount";
import { Skeleton } from "@/components/ui/skeleton";
import { Segmented } from "@/components/ui/segmented";
import { EmptyState } from "@/components/ui/empty-state";
import { DepositStatusBadge, WithdrawalStatusBadge } from "@/components/ui/status-badge";
import { Keyhole } from "@/components/brand/keyhole";
import { shortHash, formatDateTime } from "@/lib/format";
import { toDisplay } from "@quatatrade/shared";
import { useBalances, useDeposits, useWithdrawals } from "@/hooks/use-wallet";

export default function WalletPage(): React.JSX.Element {
  const tx = useTranslations("wallet");
  const { data: balances, isLoading } = useBalances();
  const usdt = balances?.balances.find((b) => b.asset === "USDT_TRC20");
  const [tab, setTab] = useState<"deposits" | "withdrawals">("deposits");

  return (
    <div className="space-y-5">
      <PageHeader title={tx("title")} subtitle={tx("subtitle")} />

      <Card>
        <p className="text-sm text-text-2">{tx("available")}</p>
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
    <div className="divide-y divide-border overflow-hidden rounded-xl border border-border">
      {data.items.map((d) => (
        <div key={d.id} className="flex items-center justify-between px-4 py-3">
          <div className="min-w-0">
            <p className="font-money text-sm">{shortHash(d.txHash)}</p>
            <p className="text-xs text-text-3">{formatDateTime(d.createdAt)}</p>
            {d.fee !== "0" && (
              <p className="text-xs text-text-3">
                {tx("depositFeeNote", { fee: toDisplay(d.fee, "USDT_TRC20", 2), net: toDisplay(d.net, "USDT_TRC20", 2) })}
              </p>
            )}
          </div>
          <div className="flex items-center gap-3">
            <Usdt value={d.amount} size="sm" showUnit={false} />
            <DepositStatusBadge status={d.status} />
          </div>
        </div>
      ))}
    </div>
  );
}

function WithdrawalsList(): React.JSX.Element {
  const tx = useTranslations("wallet");
  const { data, isLoading } = useWithdrawals(1);
  if (isLoading) return <ListSkeleton />;
  if (!data || data.items.length === 0) {
    return <EmptyState icon={History} title={tx("noWithdrawalsTitle")} description={tx("noWithdrawalsDescription")} />;
  }
  return (
    <div className="divide-y divide-border overflow-hidden rounded-xl border border-border">
      {data.items.map((w) => (
        <div key={w.id} className="flex items-center justify-between px-4 py-3">
          <div className="min-w-0">
            <p className="font-money text-sm">{shortHash(w.toAddress)}</p>
            <p className="text-xs text-text-3">{formatDateTime(w.createdAt)}</p>
          </div>
          <div className="flex items-center gap-3">
            <Usdt value={w.amount} size="sm" showUnit={false} />
            <WithdrawalStatusBadge status={w.status} />
          </div>
        </div>
      ))}
    </div>
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
