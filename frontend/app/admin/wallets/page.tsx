"use client";

import { useTranslations } from "next-intl";
import { useQuery } from "@tanstack/react-query";
import { Wallet, ArrowDownToLine, ArrowUpFromLine, CheckCircle2, AlertTriangle, Snowflake, Radio } from "lucide-react";
import type { BlockchainHealthItem } from "@quatatrade/shared";
import { AdminTitle, RefreshButton, StatCards } from "@/components/admin/admin-ui";
import { StatTile } from "@/components/ui/stat-tile";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { Usdt } from "@/components/ui/amount";
import { CopyButton } from "@/components/ui/copy-button";
import { adminApi } from "@/lib/api/admin-client";
import { apiErrorMessage } from "@/lib/api/errors";

const REFRESH_MS = 20_000;

/** Admin Wallet Administration Center — custody overview (Documents/10 D30). */
export default function WalletsPage(): React.JSX.Element {
  const tx = useTranslations("adminWallets");
  const { data, isLoading, error, refetch, isFetching } = useQuery({
    queryKey: ["admin", "wallet-overview"],
    queryFn: () => adminApi.adminWalletOverview(),
    refetchInterval: REFRESH_MS,
  });

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <AdminTitle title={tx("pageTitle")} subtitle={tx("pageSubtitle")} />
        <RefreshButton onClick={() => void refetch()} busy={isFetching} />
      </div>

      {isLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-32 w-full" />
        </div>
      ) : error || !data ? (
        <Alert tone="danger">{apiErrorMessage(error, tx("loadError"))}</Alert>
      ) : (
        <>
          <div className="space-y-2">
            <p className="text-sm font-medium text-text-2">{tx("walletsTitle")}</p>
            <StatCards>
              <StatTile label={tx("totalWallets")} value={data.wallets.total} icon={<Wallet size={15} />} />
              <StatTile label={tx("activeWallets")} value={data.wallets.active} />
              <StatTile
                label={tx("restricted")}
                value={<span className={data.wallets.restricted > 0 ? "text-warning" : undefined}>{data.wallets.restricted}</span>}
              />
              <StatTile label={tx("depositVolume")} value={<Usdt value={data.deposits.volume} size="sm" />} icon={<ArrowDownToLine size={15} />} />
            </StatCards>
          </div>

          <div className="space-y-2">
            <p className="text-sm font-medium text-text-2">{tx("flowsTitle")}</p>
            <StatCards>
              <StatTile label={tx("pendingDeposits")} value={<span className={data.deposits.pending > 0 ? "text-warning" : undefined}>{data.deposits.pending}</span>} icon={<ArrowDownToLine size={15} />} />
              <StatTile label={tx("pendingWithdrawals")} value={<span className={data.withdrawals.pendingApproval > 0 ? "text-warning" : undefined}>{data.withdrawals.pendingApproval}</span>} icon={<ArrowUpFromLine size={15} />} footnote={tx("riskHold", { n: data.withdrawals.riskHold })} />
              <StatTile label={tx("failedWithdrawals")} value={<span className={data.withdrawals.failed > 0 ? "text-danger" : undefined}>{data.withdrawals.failed}</span>} icon={<AlertTriangle size={15} />} />
              <StatTile label={tx("withdrawalVolume")} value={<Usdt value={data.withdrawals.volume} size="sm" />} icon={<ArrowUpFromLine size={15} />} />
            </StatCards>
          </div>

          {/* hot wallet */}
          <Card className="space-y-3">
            <p className="flex items-center gap-1.5 font-medium">
              <Wallet size={16} className="text-accent-400" /> {tx("hotWalletTitle")}
            </p>
            {data.hotWallet.address ? (
              <dl className="grid gap-2 text-sm sm:grid-cols-[max-content_1fr] sm:gap-x-4">
                <dt className="text-text-3">{tx("address")}</dt>
                <dd className="flex items-center gap-1.5">
                  <span className="break-all font-money text-xs text-text-1">{data.hotWallet.address}</span>
                  <CopyButton value={data.hotWallet.address} />
                </dd>
                <dt className="text-text-3">{tx("onChainBalance")}</dt>
                <dd>{data.hotWallet.onChainBalance !== null ? <Usdt value={data.hotWallet.onChainBalance} size="sm" /> : <span className="text-text-3">{tx("unavailable")}</span>}</dd>
                <dt className="text-text-3">{tx("thresholds")}</dt>
                <dd className="text-text-2">
                  {tx("min")} <Usdt value={data.hotWallet.minBalance} size="sm" showUnit={false} /> · {tx("max")} <Usdt value={data.hotWallet.maxBalance} size="sm" showUnit={false} /> · {tx("reserve")} <Usdt value={data.hotWallet.reserve} size="sm" showUnit={false} />
                </dd>
              </dl>
            ) : (
              <Alert tone="info">{tx("noHotWallet")}</Alert>
            )}
          </Card>

          {/* blockchain nodes */}
          <Card className="space-y-3">
            <p className="flex items-center gap-1.5 font-medium">
              <Radio size={16} className="text-accent-400" /> {tx("nodesTitle")}
            </p>
            {data.blockchain.map((b: BlockchainHealthItem) => (
              <div key={b.network} className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-surface-2 px-3 py-2 text-sm">
                <span className="font-medium">{b.network}</span>
                <div className="flex flex-wrap items-center gap-2">
                  {b.reachable ? (
                    <Badge tone="success" icon={<CheckCircle2 size={12} />}>{tx("synced")}</Badge>
                  ) : (
                    <Badge tone="danger" icon={<AlertTriangle size={12} />}>{tx("unreachable")}</Badge>
                  )}
                  {b.usingFallback && <Badge tone="warning">{tx("fallback")}</Badge>}
                  <span className="font-money text-xs text-text-2">
                    {tx("block")} {b.blockHeight ?? "—"}{b.latencyMs !== null ? ` · ${b.latencyMs}ms` : ""}
                  </span>
                </div>
              </div>
            ))}
          </Card>

          {/* cold wallet */}
          <Card className="space-y-2">
            <p className="flex items-center gap-1.5 font-medium">
              <Snowflake size={16} className="text-info" /> {tx("coldWalletTitle")}
            </p>
            <div className="flex items-center gap-2">
              <Badge tone={data.coldWallet.enabled ? "success" : "neutral"}>{data.coldWallet.label}</Badge>
              {!data.coldWallet.enabled && <span className="text-xs text-text-3">{tx("disabled")}</span>}
            </div>
            <p className="text-sm text-text-2">{data.coldWallet.note}</p>
          </Card>

          <p className="text-xs text-text-3">{tx("checkedAt", { time: new Date(data.checkedAt).toLocaleTimeString() })}</p>
        </>
      )}
    </div>
  );
}
