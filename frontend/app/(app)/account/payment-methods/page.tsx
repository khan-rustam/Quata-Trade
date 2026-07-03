"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { PAYMENT_METHODS, type PaymentMethod, type UpdatePaymentAccountsRequest } from "@quatatrade/shared";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { Spinner } from "@/components/ui/spinner";
import { Skeleton } from "@/components/ui/skeleton";
import { PaymentMethodChip } from "@/components/trade/payment-method-chip";
import { useToast } from "@/components/ui/toast";
import { useMe } from "@/hooks/use-auth";
import { api } from "@/lib/api/client";
import { qk } from "@/lib/api/query-keys";
import { apiErrorMessage } from "@/lib/api/errors";

type Draft = Record<PaymentMethod, { number: string; name: string }>;

const emptyDraft = (): Draft =>
  Object.fromEntries(PAYMENT_METHODS.map((m) => [m, { number: "", name: "" }])) as Draft;

export default function PaymentMethodsPage(): React.JSX.Element {
  const tx = useTranslations("paymentMethods");
  const { data: me, isLoading } = useMe();
  const qc = useQueryClient();
  const toast = useToast();
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  // Seed the form from the profile once it loads (adjust-state-during-render, guarded by id).
  const [seededFor, setSeededFor] = useState<string | null>(null);
  if (me && seededFor !== me.id) {
    const next = emptyDraft();
    for (const m of PAYMENT_METHODS) {
      const acct = me.paymentAccounts[m];
      if (acct) next[m] = { number: acct.number, name: acct.name };
    }
    setDraft(next);
    setSeededFor(me.id);
  }

  const set = (m: PaymentMethod, field: "number" | "name", value: string) =>
    setDraft((d) => ({ ...d, [m]: { ...d[m], [field]: value } }));

  const save = useMutation({
    mutationFn: () => {
      const accounts: UpdatePaymentAccountsRequest["accounts"] = {};
      for (const m of PAYMENT_METHODS) {
        const { number, name } = draft[m];
        accounts[m] = number.trim() && name.trim() ? { number: number.trim(), name: name.trim() } : null;
      }
      return api.updatePaymentAccounts({ accounts });
    },
    onSuccess: (profile) => {
      qc.setQueryData(qk.me, profile);
      toast.success(tx("savedTitle"), tx("savedBody"));
    },
    onError: (err) => toast.error(tx("errorTitle"), apiErrorMessage(err)),
  });

  return (
    <div className="mx-auto max-w-lg space-y-5">
      <PageHeader title={tx("title")} subtitle={tx("subtitle")} backHref="/account" />

      <Alert tone="info">{tx("hint")}</Alert>

      {isLoading ? (
        <div className="space-y-3">
          {PAYMENT_METHODS.map((m) => (
            <Skeleton key={m} className="h-40 w-full rounded-xl" />
          ))}
        </div>
      ) : (
        <div className="space-y-3">
          {PAYMENT_METHODS.map((m) => (
            <Card key={m} className="space-y-3">
              <PaymentMethodChip method={m} />
              <Field label={tx("numberLabel")}>
                {(p) => (
                  <Input
                    {...p}
                    inputMode="tel"
                    placeholder={tx("numberPlaceholder")}
                    value={draft[m].number}
                    onChange={(e) => set(m, "number", e.target.value)}
                    maxLength={30}
                  />
                )}
              </Field>
              <Field label={tx("nameLabel")}>
                {(p) => (
                  <Input
                    {...p}
                    placeholder={tx("namePlaceholder")}
                    value={draft[m].name}
                    onChange={(e) => set(m, "name", e.target.value)}
                    maxLength={80}
                  />
                )}
              </Field>
            </Card>
          ))}

          <Button className="w-full" onClick={() => save.mutate()} disabled={save.isPending}>
            {save.isPending ? <Spinner /> : tx("save")}
          </Button>
        </div>
      )}
    </div>
  );
}
