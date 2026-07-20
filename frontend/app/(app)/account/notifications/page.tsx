"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCheck } from "lucide-react";
import { useTranslations } from "next-intl";
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

const TEMPLATE_KEYS: Record<string, string> = {
  email_verify: "templateEmailVerify",
  deposit_credited: "templateDepositCredited",
  withdrawal_requested: "templateWithdrawalRequested",
  withdrawal_confirmed: "templateWithdrawalConfirmed",
  trade_escrow_locked: "templateTradeEscrowLocked",
  trade_payment_submitted: "templateTradePaymentSubmitted",
  trade_completed: "templateTradeCompleted",
  trade_expired: "templateTradeExpired",
  trade_cancelled: "templateTradeCancelled",
  trade_disputed: "templateTradeDisputed",
  dispute_resolved: "templateDisputeResolved",
  kyc_reviewed: "templateKycReviewed",
  // These 8 existed in notify.templates.ts but not here, so the feed rendered the
  // raw id — a user whose withdrawal was rejected saw the literal text
  // "withdrawal_rejected".
  kyc_submitted: "templateKycSubmitted",
  wallet_created: "templateWalletCreated",
  withdrawal_approved: "templateWithdrawalApproved",
  withdrawal_rejected: "templateWithdrawalRejected",
  withdrawal_failed: "templateWithdrawalFailed",
  internal_transfer_received: "templateInternalTransferReceived",
  price_alert_triggered: "templatePriceAlertTriggered",
  password_reset: "templatePasswordReset",
};

/** "withdrawal_rejected" -> "Withdrawal rejected". Last-resort only. */
function humanize(template: string): string {
  const words = template.replace(/_/g, " ").trim();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

export default function NotificationsPage(): React.JSX.Element {
  const qc = useQueryClient();
  const toast = useToast();
  const tx = useTranslations("accountNotifications");
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
      toast.error(tx("updateErrorTitle"), apiErrorMessage(err));
    }
  };

  const markAllRead = async () => {
    try {
      await Promise.all(unread.map((n) => api.markNotificationRead(n.id)));
      toast.success(tx("markAllSuccessTitle"), tx("markAllSuccessBody"));
      invalidate();
    } catch (err) {
      toast.error(tx("updateErrorTitle"), apiErrorMessage(err));
    }
  };

  return (
    <div className="mx-auto max-w-lg space-y-5">
      <PageHeader
        title={tx("title")}
        backHref="/account"
        action={
          unread.length > 0 ? (
            <Button size="sm" variant="secondary" onClick={() => void markAllRead()}>
              <CheckCheck size={15} /> {tx("markAllRead")}
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
        <Alert tone="danger" title={tx("loadErrorTitle")}>
          <button
            type="button"
            onClick={() => void refetch()}
            className="font-medium underline underline-offset-2 hover:no-underline"
          >
            {tx("tryAgain")}
          </button>
        </Alert>
      ) : items.length === 0 ? (
        <EmptyState
          image="/assets/empty-notifications.png"
          title={tx("emptyTitle")}
          description={tx("emptyBody")}
        />
      ) : (
        <div className="divide-y divide-border overflow-hidden rounded-xl border border-border">
          {items.map((n) => {
            const isUnread = !n.readAt;
            const templateKey = TEMPLATE_KEYS[n.template];
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
                  {/* A template added backend-side that nobody maps here used to
                      render its raw id ("withdrawal_rejected"). Degrade to a
                      readable sentence instead, so future drift is untidy rather
                      than broken. */}
                  <p className="text-sm font-medium text-text-1">{templateKey ? tx(templateKey) : humanize(n.template)}</p>
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
