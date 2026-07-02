"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { PageHeader } from "@/components/layout/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { api } from "@/lib/api/client";
import { qk } from "@/lib/api/query-keys";
import { timeAgo } from "@/lib/format";
import { cn } from "@/lib/utils";

const TITLES: Record<string, string> = {
  email_verify: "Verify your email",
  deposit_credited: "Deposit credited",
  withdrawal_requested: "Withdrawal requested",
  withdrawal_confirmed: "Withdrawal confirmed",
  trade_escrow_locked: "Escrow locked",
  trade_payment_submitted: "Payment submitted",
  trade_completed: "Trade completed",
  trade_expired: "Trade expired",
  trade_cancelled: "Trade cancelled",
  trade_disputed: "Trade disputed",
  dispute_resolved: "Dispute resolved",
  kyc_reviewed: "KYC reviewed",
};

export default function NotificationsPage(): React.JSX.Element {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: qk.notifications(1), queryFn: () => api.notifications({ page: 1 }) });

  const markRead = (id: string) => {
    void api.markNotificationRead(id).then(() => qc.invalidateQueries({ queryKey: qk.notifications(1) }));
  };

  return (
    <div className="mx-auto max-w-lg space-y-5">
      <PageHeader title="Notifications" backHref="/account" />

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full rounded-xl" />
          ))}
        </div>
      ) : !data || data.items.length === 0 ? (
        <EmptyState image="/assets/empty-notifications.png" title="You're all caught up" description="Trade and wallet updates will show here." />
      ) : (
        <div className="divide-y divide-border overflow-hidden rounded-xl border border-border">
          {data.items.map((n) => {
            const unread = !n.readAt;
            return (
              <button
                key={n.id}
                type="button"
                onClick={() => unread && markRead(n.id)}
                className={cn(
                  "flex w-full items-start gap-3 px-4 py-3.5 text-left transition-colors hover:bg-surface-2",
                  unread ? "bg-surface-1" : "bg-transparent",
                )}
              >
                <span className={cn("mt-1.5 h-2 w-2 shrink-0 rounded-full", unread ? "bg-accent-400" : "bg-transparent")} />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-text-1">{TITLES[n.template] ?? n.template}</p>
                  <p className="text-xs text-text-3">{timeAgo(n.createdAt)}</p>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
