"use client";

import { QRCodeSVG } from "qrcode.react";
import { AlertTriangle } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { Alert } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { CopyButton } from "@/components/ui/copy-button";
import { Usdt } from "@/components/ui/amount";
import { useDepositAddress } from "@/hooks/use-wallet";

export default function DepositPage(): React.JSX.Element {
  const { data, isLoading, isError } = useDepositAddress("USDT_TRC20");

  return (
    <div className="mx-auto max-w-md space-y-5">
      <PageHeader title="Deposit USDT" subtitle="TRON network (TRC20)" backHref="/wallet" />

      <Alert tone="warning" title="Send only USDT on TRON (TRC20)">
        Sending any other token or network will result in permanent loss. This address is yours alone.
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
            <p className="text-xs uppercase tracking-wide text-text-3">Your USDT-TRC20 address</p>
            <p className="break-all font-money text-sm text-text-1">{data.address}</p>
            <div className="flex justify-center pt-1">
              <CopyButton value={data.address} label="Copy address" />
            </div>
          </div>
        )}
      </Card>

      {data && (
        <Card className="space-y-2 text-sm">
          <Row label="Network" value={data.network} />
          <Row label="Minimum deposit" value={<Usdt value={data.minDeposit} size="sm" />} />
          <Row label="Credited after" value={`${data.confirmationsRequired} confirmations`} />
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
