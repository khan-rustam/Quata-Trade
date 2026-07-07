"use client";

import { QRCodeSVG } from "qrcode.react";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { useTranslations } from "next-intl";
import { ApiClientError } from "@quatatrade/shared";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { CopyButton } from "@/components/ui/copy-button";
import { Usdt } from "@/components/ui/amount";
import { useDepositAddress } from "@/hooks/use-wallet";

export default function DepositPage(): React.JSX.Element {
  const tx = useTranslations("walletDeposit");
  const { data, isLoading, isError, error, refetch, isFetching } = useDepositAddress("USDT_TRC20");

  // A 503 means the wallet service can't derive an address right now (e.g. the
  // watch-only xpub isn't configured yet) — NOT a verification requirement.
  // Depositing never needs KYC, so we say so explicitly to avoid confusion.
  const unavailable = error instanceof ApiClientError && error.status === 503;

  return (
    <div className="mx-auto max-w-md space-y-5">
      <PageHeader title={tx("title")} subtitle={tx("subtitle")} backHref="/wallet" />

      <Alert tone="warning" title={tx("warningTitle")}>
        {tx("warningBody")}
      </Alert>

      <Card className="flex flex-col items-center gap-4">
        {isLoading ? (
          <Skeleton className="h-44 w-44 rounded-xl" />
        ) : isError || !data ? (
          <div className="flex flex-col items-center gap-3 py-4 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-surface-2 text-warning">
              <AlertTriangle size={26} aria-hidden />
            </div>
            <div className="space-y-1">
              <p className="font-medium text-text-1">
                {tx(unavailable ? "unavailableTitle" : "errorTitle")}
              </p>
              <p className="text-sm text-text-2">
                {tx(unavailable ? "unavailableBody" : "errorBody")}
              </p>
            </div>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => void refetch()}
              disabled={isFetching}
            >
              <RefreshCw size={15} className={isFetching ? "animate-spin" : ""} aria-hidden />
              {tx("retry")}
            </Button>
          </div>
        ) : (
          <div className="rounded-xl bg-white p-3">
            <QRCodeSVG value={data.address} size={168} level="M" />
          </div>
        )}

        {data && (
          <div className="w-full space-y-1 text-center">
            <p className="text-xs uppercase tracking-wide text-text-3">{tx("addressLabel")}</p>
            <p className="break-all font-money text-sm text-text-1">{data.address}</p>
            <div className="flex justify-center pt-1">
              <CopyButton value={data.address} label={tx("copyAddress")} />
            </div>
          </div>
        )}
      </Card>

      {data && (
        <Card className="space-y-2 text-sm">
          <Row label={tx("network")} value={data.network} />
          <Row label={tx("minDeposit")} value={<Usdt value={data.minDeposit} size="sm" />} />
          <Row label={tx("creditedAfter")} value={tx("confirmations", { count: data.confirmationsRequired })} />
        </Card>
      )}
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }): React.JSX.Element {
  return (
    <div className="flex items-center justify-between">
      <span className="text-text-2">{label}</span>
      <span className="font-medium text-text-1">{value}</span>
    </div>
  );
}
