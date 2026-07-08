"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell, Trash2 } from "lucide-react";
import type { AlertDirection } from "@quatatrade/shared";
import { Card } from "@/components/ui/card";
import { Segmented } from "@/components/ui/segmented";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/toast";
import { api } from "@/lib/api/client";
import { apiErrorMessage } from "@/lib/api/errors";

/**
 * Set + manage price alerts for a coin (Markets Phase G). Only rendered for
 * signed-in users; a fired alert deactivates and the user is emailed + in-app
 * notified by the worker.
 */
export function PriceAlertPanel({
  coinId,
  symbol,
  currentPrice,
}: {
  coinId: string;
  symbol: string;
  currentPrice: number;
}): React.JSX.Element {
  const tx = useTranslations("priceAlert");
  const toast = useToast();
  const qc = useQueryClient();
  const [dir, setDir] = useState<AlertDirection>("above");
  const [target, setTarget] = useState(currentPrice > 0 ? String(currentPrice) : "");

  const alerts = useQuery({ queryKey: ["markets", "alerts"], queryFn: () => api.priceAlerts() });
  const mine = (alerts.data?.items ?? []).filter((a) => a.coinId === coinId);

  const create = useMutation({
    mutationFn: () => api.createPriceAlert({ coinId, symbol, direction: dir, target: Number(target) }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["markets", "alerts"] });
      toast.success(tx("createdTitle"), tx("createdBody", { symbol }));
    },
    onError: (err) => toast.error(tx("error"), apiErrorMessage(err, "")),
  });
  const del = useMutation({
    mutationFn: (id: string) => api.deletePriceAlert(id),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["markets", "alerts"] }),
  });

  const valid = Number(target) > 0;

  return (
    <Card className="space-y-3">
      <p className="flex items-center gap-1.5 font-medium">
        <Bell size={16} className="text-accent-400" /> {tx("title")}
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <Segmented
          value={dir}
          onChange={(v) => setDir(v as AlertDirection)}
          aria-label={tx("title")}
          options={[
            { value: "above", label: tx("above") },
            { value: "below", label: tx("below") },
          ]}
        />
        <Input
          mono
          inputMode="decimal"
          prefix="$"
          value={target}
          onChange={(e) => setTarget(e.target.value.replace(/[^\d.]/g, ""))}
          placeholder="0.00"
          className="w-40"
          aria-label={tx("target")}
        />
        <Button size="sm" onClick={() => create.mutate()} disabled={!valid || create.isPending}>
          {tx("create")}
        </Button>
      </div>

      {mine.length > 0 && (
        <div className="space-y-1">
          {mine.map((a) => (
            <div key={a.id} className="flex items-center justify-between rounded-lg bg-surface-2 px-3 py-1.5 text-sm">
              <span className="flex items-center gap-2">
                <span className="font-money tabular-nums">
                  {tx(a.direction)} ${a.target.toLocaleString()}
                </span>
                {!a.active && <Badge tone="neutral">{tx("triggered")}</Badge>}
              </span>
              <button
                type="button"
                onClick={() => del.mutate(a.id)}
                aria-label={tx("delete")}
                className="text-text-3 hover:text-danger"
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
