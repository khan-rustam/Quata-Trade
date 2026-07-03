import type { ReactNode } from "react";
import { ChevronLeft, ChevronRight, Download, RefreshCw } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { toCsv, downloadCsv, type CsvColumn } from "@/lib/csv";

export function AdminTitle({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
}): React.JSX.Element {
  return (
    <div className="flex items-end justify-between gap-4">
      <div>
        <h1 className="font-display text-2xl font-bold tracking-tight">{title}</h1>
        {subtitle && <p className="text-sm text-text-2">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

export function Pagination({
  page,
  pageSize,
  total,
  onPage,
  onPageSize,
  pageSizeOptions = [20, 50, 100],
}: {
  page: number;
  pageSize: number;
  total: number;
  onPage: (p: number) => void;
  onPageSize?: (n: number) => void;
  pageSizeOptions?: number[];
}): React.JSX.Element | null {
  const tx = useTranslations("adminUi");
  const pages = Math.max(1, Math.ceil(total / pageSize));
  if (pages <= 1 && !onPageSize) return null;
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-sm text-text-2">
      <span>{tx("pageStatus", { page, pages, total })}</span>
      <div className="flex items-center gap-2">
        {onPageSize && (
          <select
            value={pageSize}
            onChange={(e) => onPageSize(Number(e.target.value))}
            aria-label={tx("perPageAria")}
            className="cursor-pointer rounded-lg border border-border bg-surface-2 px-2 py-1.5 text-sm text-text-1 outline-none focus-visible:border-accent-400"
          >
            {pageSizeOptions.map((n) => (
              <option key={n} value={n}>
                {tx("perPage", { n })}
              </option>
            ))}
          </select>
        )}
        <Button size="sm" variant="secondary" disabled={page <= 1} onClick={() => onPage(page - 1)} aria-label={tx("previousPage")}>
          <ChevronLeft size={16} />
        </Button>
        <Button size="sm" variant="secondary" disabled={page >= pages} onClick={() => onPage(page + 1)} aria-label={tx("nextPage")}>
          <ChevronRight size={16} />
        </Button>
      </div>
    </div>
  );
}

/** Container for a page's filter controls, with an optional Clear button. */
export function FilterBar({
  children,
  onReset,
  showReset,
}: {
  children: ReactNode;
  onReset?: () => void;
  showReset?: boolean;
}): React.JSX.Element {
  const tx = useTranslations("adminUi");
  return (
    <div className="flex flex-wrap items-end gap-2 rounded-xl border border-border bg-surface-1 p-3">
      {children}
      {onReset && showReset && (
        <Button size="sm" variant="ghost" onClick={onReset}>
          {tx("clearFilters")}
        </Button>
      )}
    </div>
  );
}

/** Refresh the current query. Spins while fetching. */
export function RefreshButton({ onClick, busy }: { onClick: () => void; busy?: boolean }): React.JSX.Element {
  const tx = useTranslations("adminUi");
  return (
    <Button size="sm" variant="secondary" onClick={onClick} disabled={busy} aria-label={tx("refresh")}>
      <RefreshCw size={14} className={busy ? "animate-spin" : ""} /> {tx("refresh")}
    </Button>
  );
}

/** Export the currently-loaded rows to a CSV file (client-side). */
export function ExportCsvButton<T>({
  rows,
  columns,
  filename,
}: {
  rows: readonly T[];
  columns: readonly CsvColumn<T>[];
  filename: string;
}): React.JSX.Element {
  const tx = useTranslations("adminUi");
  return (
    <Button
      size="sm"
      variant="secondary"
      disabled={rows.length === 0}
      onClick={() => downloadCsv(filename, toCsv(rows, columns))}
    >
      <Download size={14} /> {tx("export")}
    </Button>
  );
}

/** Responsive row of stat tiles. */
export function StatCards({ children }: { children: ReactNode }): React.JSX.Element {
  return <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{children}</div>;
}

/** Standard table frame for admin lists. */
export function TableFrame({ head, children }: { head: ReactNode; children: ReactNode }): React.JSX.Element {
  return (
    <div className="overflow-x-auto rounded-xl border border-border">
      <table className="w-full min-w-160 text-sm">
        <thead className="border-b border-border bg-surface-2 text-left text-xs uppercase tracking-wide text-text-3">
          {head}
        </thead>
        <tbody className="divide-y divide-border">{children}</tbody>
      </table>
    </div>
  );
}
