"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { ShieldX, Trash2 } from "lucide-react";
import type { BlockCategory, BlockedAddress } from "@quatatrade/shared";
import { AdminTitle } from "@/components/admin/admin-ui";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Segmented } from "@/components/ui/segmented";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert } from "@/components/ui/alert";
import { Spinner } from "@/components/ui/spinner";
import { useToast } from "@/components/ui/toast";
import { useBlockAddress, useBlockedAddresses, useUnblockAddress } from "@/hooks/use-screening";
import { apiErrorMessage } from "@/lib/api/errors";

const CATEGORIES: BlockCategory[] = ["sanctions", "blacklist", "manual"];
const TRON_ADDRESS = /^T[1-9A-HJ-NP-Za-km-z]{33}$/;

/**
 * AML sanctions/blocklist console. The screening chokepoint (deposit + withdrawal)
 * was fully built server-side but had no UI, so compliance could not populate the
 * list. This wires the existing admin endpoints (kycReview-gated).
 */
export default function AdminScreeningPage(): React.JSX.Element {
  const tx = useTranslations("adminScreening");
  const toast = useToast();
  const { data, isLoading } = useBlockedAddresses();
  const block = useBlockAddress();
  const unblock = useUnblockAddress();

  const [address, setAddress] = useState("");
  const [category, setCategory] = useState<BlockCategory>("sanctions");
  const [reason, setReason] = useState("");
  const [source, setSource] = useState("");
  const [error, setError] = useState<string | null>(null);

  const canSubmit = TRON_ADDRESS.test(address.trim()) && reason.trim().length >= 1;

  const submit = async () => {
    setError(null);
    try {
      await block.mutateAsync({
        asset: "USDT_TRC20",
        address: address.trim(),
        category,
        reason: reason.trim(),
        source: source.trim() || undefined,
      });
      toast.success(tx("blockedToastTitle"), tx("blockedToastBody"));
      setAddress("");
      setReason("");
      setSource("");
    } catch (err) {
      setError(apiErrorMessage(err, tx("errorBlock")));
    }
  };

  const doUnblock = (a: BlockedAddress) =>
    unblock.mutate(a.id, {
      onSuccess: () => toast.success(tx("unblockedToast")),
      onError: (err) => toast.error(tx("errorUnblock"), apiErrorMessage(err)),
    });

  const addresses = (data?.addresses ?? []).filter((a) => a.active);

  return (
    <div className="space-y-5">
      <AdminTitle title={tx("pageTitle")} subtitle={tx("pageSubtitle")} />

      <Alert tone="info" title={tx("alertTitle")}>
        {tx("alertBody")}
      </Alert>

      <Card className="space-y-4">
        <h2 className="font-display text-base font-semibold">{tx("addTitle")}</h2>
        {error && <Alert tone="danger">{error}</Alert>}

        <Field label={tx("addressLabel")} required>
          {(p) => (
            <Input
              {...p}
              mono
              value={address}
              onChange={(e) => setAddress(e.target.value.trim())}
              placeholder={tx("addressPlaceholder")}
            />
          )}
        </Field>

        <div>
          <p className="mb-1.5 text-sm font-medium">{tx("categoryLabel")}</p>
          <Segmented
            value={category}
            onChange={setCategory}
            aria-label={tx("categoryLabel")}
            options={CATEGORIES.map((c) => ({ value: c, label: tx(`cat_${c}`) }))}
          />
        </div>

        <Field label={tx("reasonLabel")} required>
          {(p) => (
            <Input
              {...p}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder={tx("reasonPlaceholder")}
              maxLength={500}
            />
          )}
        </Field>

        <Field label={tx("sourceLabel")}>
          {(p) => (
            <Input
              {...p}
              value={source}
              onChange={(e) => setSource(e.target.value)}
              placeholder={tx("sourcePlaceholder")}
              maxLength={100}
            />
          )}
        </Field>

        <div className="flex justify-end">
          <Button onClick={submit} disabled={!canSubmit || block.isPending}>
            {block.isPending ? (
              <Spinner />
            ) : (
              <>
                <ShieldX size={16} /> {tx("block")}
              </>
            )}
          </Button>
        </div>
      </Card>

      <div>
        <h2 className="mb-3 font-display text-base font-semibold">{tx("blockedTitle")}</h2>
        {isLoading ? (
          <Skeleton className="h-40 w-full rounded-xl" />
        ) : addresses.length === 0 ? (
          <Card>
            <p className="text-sm text-text-2">{tx("empty")}</p>
          </Card>
        ) : (
          <Card className="overflow-x-auto p-0">
            <table className="w-full min-w-170 text-sm">
              <thead>
                <tr className="border-b border-border text-left text-text-3">
                  <th className="px-4 py-3 font-medium">{tx("colAddress")}</th>
                  <th className="px-4 py-3 font-medium">{tx("colCategory")}</th>
                  <th className="px-4 py-3 font-medium">{tx("colReason")}</th>
                  <th className="px-4 py-3 font-medium">{tx("colSource")}</th>
                  <th className="px-4 py-3 font-medium">{tx("colAdded")}</th>
                  <th className="px-4 py-3 text-right font-medium">{tx("colAction")}</th>
                </tr>
              </thead>
              <tbody>
                {addresses.map((a) => (
                  <tr key={a.id} className="border-b border-border/60 last:border-0">
                    <td className="px-4 py-3 font-money text-xs break-all text-text-1">{a.address}</td>
                    <td className="px-4 py-3">
                      <Badge tone={a.category === "sanctions" ? "danger" : a.category === "blacklist" ? "warning" : "neutral"}>
                        {tx(`cat_${a.category}`)}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-text-2">{a.reason}</td>
                    <td className="px-4 py-3 text-text-3">{a.source || "—"}</td>
                    <td className="px-4 py-3 text-text-3 tabular-nums">{a.createdAt.slice(0, 10)}</td>
                    <td className="px-4 py-3 text-right">
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-danger"
                        onClick={() => doUnblock(a)}
                        disabled={unblock.isPending}
                      >
                        <Trash2 size={14} /> {tx("unblock")}
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        )}
      </div>
    </div>
  );
}
