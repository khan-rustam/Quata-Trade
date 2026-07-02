"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCheck } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { api } from "@/lib/api/client";
import { qk } from "@/lib/api/query-keys";
import { apiErrorMessage } from "@/lib/api/errors";
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
  const toast = useToast();
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: qk.notifications(1),
    queryFn: () => api.notifications({ page: 1 }),
    refetchInterval: 60_000, // keep the list reasonably fresh
  });

  const items = data?.items ?? [];
  const unread = items.filter((n) => !n.readAt);
  const invalidate = () => qc.invalidateQueries({ queryKey: qk.notifications(1) });

  const markRead = async (id: string) => {
    try {
      await api.markNotificationRead(id);
      invalidate();
    } catch (err) {
      toast.error("Couldn't update", apiErrorMessage(err));
    }
  };

  const markAllRead = async () => {
    try {
      await Promise.all(unread.map((n) => api.markNotificationRead(n.id)));
      toast.success("All caught up", "Marked everything as read.");
      invalidate();
    } catch (err) {
      toast.error("Couldn't update", apiErrorMessage(err));
    }
  };

  return (
    <div className="mx-auto max-w-lg space-y-5">
      <PageHeader
        title="Notifications"
        backHref="/account"
        action={
          unread.length > 0 ? (
            <Button size="sm" variant="secondary" onClick={() => void markAllRead()}>
              <CheckCheck size={15} /> Mark all read
            </Button>
          ) : undefined
        }
      />

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full rounded-xl" />
          ))}
        </div>
      ) : isError ? (
        <Alert tone="danger" title="Couldn't load notifications">
          <button
            type="button"
            onClick={() => void refetch()}
            className="font-medium underline underline-offset-2 hover:no-underline"
          >
            Try again
          </button>
        </Alert>
      ) : items.length === 0 ? (
        <EmptyState
          image="/assets/empty-notifications.png"
          title="You're all caught up"
          description="Trade and wallet updates will show here."
        />
      ) : (
        <div className="divide-y divide-border overflow-hidden rounded-xl border border-border">
          {items.map((n) => {
            const isUnread = !n.readAt;
            return (
              <button
                key={n.id}
                type="button"
                onClick={() => isUnread && void markRead(n.id)}
                className={cn(
                  "flex w-full items-start gap-3 px-4 py-3.5 text-left transition-colors hover:bg-surface-2",
                  isUnread ? "bg-surface-1" : "bg-transparent",
                )}
              >
                <span className={cn("mt-1.5 h-2 w-2 shrink-0 rounded-full", isUnread ? "bg-accent-400" : "bg-transparent")} />
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
