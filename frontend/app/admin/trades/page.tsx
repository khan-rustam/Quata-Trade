"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Repeat } from "lucide-react";
import { toDisplay,TRADE_STATUSES } from "@quatatrade/shared";
import { AdminTitle, ExportCsvButton, FilterBar, Pagination, RefreshButton, TableFrame } from "@/components/admin/admin-ui";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { Select } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/field";
import { Usdt } from "@/components/ui/amount";
import { TradeStatusBadge } from "@/components/ui/status-badge";
import { useAdminTrades } from "@/hooks/use-admin";
import { formatDateTime } from "@/lib/format";

export default function AdminTradesPage(): React.JSX.Element {
  const tx = useTranslations("adminTrades");
  const tu = useTranslations("adminUi");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [status, setStatus] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const { data, isLoading, refetch, isFetching } = useAdminTrades(page, pageSize, { status, from, to });
  const hasFilters = Boolean(status || from || to);
  const reset = () => {
    setStatus("");
    setFrom("");
    setTo("");
    setPage(1);
  };

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
                { header: "Amount (USDT)", value: (t) => toDisplay(t.amount, "USDT_TRC20", 6) },
                { header: "Fee (USDT)", value: (t) => toDisplay(t.feeAmount, "USDT_TRC20", 6) },
                { header: "Status", value: (t) => t.status },
                { header: "Created", value: (t) => t.createdAt },
              ]}
            />
          </div>
        }
      />

      <FilterBar onReset={reset} showReset={hasFilters}>
        <Field label={tu("filterStatus")} className="w-44">
          {() => (
            <Select
              value={status}
              onChange={(e) => {
                setStatus(e.target.value);
                setPage(1);
              }}
              options={[
                { value: "", label: tu("filterAll") },
                ...TRADE_STATUSES.map((s) => ({ value: s, label: s })),
              ]}
            />
          )}
        </Field>
        <Field label={tu("dateFrom")} className="w-40">
          {() => (
            <Input
              type="date"
              value={from}
              onChange={(e) => {
                setFrom(e.target.value);
                setPage(1);
              }}
            />
          )}
        </Field>
        <Field label={tu("dateTo")} className="w-40">
          {() => (
            <Input
              type="date"
              value={to}
              onChange={(e) => {
                setTo(e.target.value);
                setPage(1);
              }}
            />
          )}
        </Field>
      </FilterBar>

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
          <Pagination
            page={data.page}
            pageSize={data.pageSize}
            total={data.total}
            onPage={setPage}
            onPageSize={(n) => {
              setPageSize(n);
              setPage(1);
            }}
          />
        </>
      )}
    </div>
  );
}
