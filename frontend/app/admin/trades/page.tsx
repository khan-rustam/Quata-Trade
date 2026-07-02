"use client";

import { useState } from "react";
import { Repeat } from "lucide-react";
import { AdminTitle, Pagination, TableFrame } from "@/components/admin/admin-ui";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { Usdt } from "@/components/ui/amount";
import { TradeStatusBadge } from "@/components/ui/status-badge";
import { useAdminTrades } from "@/hooks/use-admin";
import { formatDateTime } from "@/lib/format";

export default function AdminTradesPage(): React.JSX.Element {
  const [page, setPage] = useState(1);
  const { data, isLoading } = useAdminTrades(page);

  return (
    <div className="space-y-5">
      <AdminTitle title="Trades" subtitle="All trades and their current escrow state." />

      {isLoading ? (
        <Skeleton className="h-64 w-full rounded-xl" />
      ) : !data || data.items.length === 0 ? (
        <EmptyState icon={Repeat} title="No trades yet" description="Trades will appear here as users transact." />
      ) : (
        <>
          <TableFrame
            head={
              <tr>
                <th className="px-4 py-2.5">Ref</th>
                <th className="px-4 py-2.5">Seller</th>
                <th className="px-4 py-2.5">Buyer</th>
                <th className="px-4 py-2.5">Amount</th>
                <th className="px-4 py-2.5">Fee</th>
                <th className="px-4 py-2.5">Status</th>
                <th className="px-4 py-2.5">Created</th>
              </tr>
            }
          >
            {data.items.map((t) => (
              <tr key={t.id}>
                <td className="px-4 py-3 font-money">{t.shortRef}</td>
                <td className="max-w-[10rem] truncate px-4 py-3 text-text-2">{t.sellerEmail}</td>
                <td className="max-w-[10rem] truncate px-4 py-3 text-text-2">{t.buyerEmail}</td>
                <td className="px-4 py-3"><Usdt value={t.amount} size="sm" /></td>
                <td className="px-4 py-3"><Usdt value={t.feeAmount} size="sm" showUnit={false} /></td>
                <td className="px-4 py-3"><TradeStatusBadge status={t.status} /></td>
                <td className="px-4 py-3 text-xs text-text-3">{formatDateTime(t.createdAt)}</td>
              </tr>
            ))}
          </TableFrame>
          <Pagination page={data.page} pageSize={data.pageSize} total={data.total} onPage={setPage} />
        </>
      )}
    </div>
  );
}
