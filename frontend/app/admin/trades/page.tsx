"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Repeat } from "lucide-react";
import { AdminTitle, ExportCsvButton, Pagination, RefreshButton, TableFrame } from "@/components/admin/admin-ui";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { Usdt } from "@/components/ui/amount";
import { TradeStatusBadge } from "@/components/ui/status-badge";
import { useAdminTrades } from "@/hooks/use-admin";
import { formatDateTime } from "@/lib/format";

export default function AdminTradesPage(): React.JSX.Element {
  const tx = useTranslations("adminTrades");
  const [page, setPage] = useState(1);
  const { data, isLoading, refetch, isFetching } = useAdminTrades(page);

  return (
    <div className="space-y-5">
      <AdminTitle
        title={tx("title")}
        subtitle={tx("subtitle")}
        action={
          <div className="flex gap-2">
            <RefreshButton onClick={() => void refetch()} busy={isFetching} />
            <ExportCsvButton
              rows={data?.items ?? []}
              filename="quatatrade-trades"
              columns={[
                { header: "Ref", value: (t) => t.shortRef },
                { header: "Seller", value: (t) => t.sellerEmail },
                { header: "Buyer", value: (t) => t.buyerEmail },
                { header: "Amount", value: (t) => t.amount },
                { header: "Fee", value: (t) => t.feeAmount },
                { header: "Status", value: (t) => t.status },
                { header: "Created", value: (t) => t.createdAt },
              ]}
            />
          </div>
        }
      />

      {isLoading ? (
        <Skeleton className="h-64 w-full rounded-xl" />
      ) : !data || data.items.length === 0 ? (
        <EmptyState icon={Repeat} title={tx("emptyTitle")} description={tx("emptyDescription")} />
      ) : (
        <>
          <TableFrame
            head={
              <tr>
                <th className="px-4 py-2.5">{tx("colRef")}</th>
                <th className="px-4 py-2.5">{tx("colSeller")}</th>
                <th className="px-4 py-2.5">{tx("colBuyer")}</th>
                <th className="px-4 py-2.5">{tx("colAmount")}</th>
                <th className="px-4 py-2.5">{tx("colFee")}</th>
                <th className="px-4 py-2.5">{tx("colStatus")}</th>
                <th className="px-4 py-2.5">{tx("colCreated")}</th>
              </tr>
            }
          >
            {data.items.map((t) => (
              <tr key={t.id}>
                <td className="px-4 py-3 font-money">{t.shortRef}</td>
                <td className="max-w-40 truncate px-4 py-3 text-text-2">{t.sellerEmail}</td>
                <td className="max-w-40 truncate px-4 py-3 text-text-2">{t.buyerEmail}</td>
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
