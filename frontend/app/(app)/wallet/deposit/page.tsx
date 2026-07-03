"use client";

import { QRCodeSVG } from "qrcode.react";
import { AlertTriangle } from "lucide-react";
import { useTranslations } from "next-intl";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { Alert } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { CopyButton } from "@/components/ui/copy-button";
import { Usdt } from "@/components/ui/amount";
import { useDepositAddress } from "@/hooks/use-wallet";

export default function DepositPage(): React.JSX.Element {
  const tx = useTranslations("walletDeposit");
  const { data, isLoading, isError } = useDepositAddress("USDT_TRC20");

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
          <div className="flex h-44 w-44 items-center justify-center rounded-xl bg-surface-2 text-text-3">
            <AlertTriangle size={28} />
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
