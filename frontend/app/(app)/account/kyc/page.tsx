"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { BadgeCheck, ShieldCheck } from "lucide-react";
import { KYC_DOC_TYPES } from "@quatatrade/shared";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert } from "@/components/ui/alert";
import { Select } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { DocumentUpload } from "@/components/account/document-upload";
import { useToast } from "@/components/ui/toast";
import { useMe } from "@/hooks/use-auth";
import { api } from "@/lib/api/client";
import { qk } from "@/lib/api/query-keys";
import { apiErrorMessage } from "@/lib/api/errors";

const STATUS_TONE = {
  APPROVED: "success",
  PENDING: "warning",
  REJECTED: "danger",
  RESUBMIT: "warning",
  NONE: "neutral",
} as const;

export default function KycPage(): React.JSX.Element {
  const tx = useTranslations("accountKyc");
  const { data: me } = useMe();
  const qc = useQueryClient();
  const toast = useToast();
  const { data: status, isLoading } = useQuery({ queryKey: qk.kycStatus, queryFn: () => api.kycStatus() });

  const [docType, setDocType] = useState<(typeof KYC_DOC_TYPES)[number]>("national_id");
  const [front, setFront] = useState<string>();
  const [back, setBack] = useState<string>();
  const [selfie, setSelfie] = useState<string>();
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const DOC_LABELS: Record<(typeof KYC_DOC_TYPES)[number], string> = {
    national_id: tx("docNationalId"),
    passport: tx("docPassport"),
    drivers_license: tx("docDriversLicense"),
  };

  const STATUS_LABELS: Record<keyof typeof STATUS_TONE, string> = {
    APPROVED: tx("statusApproved"),
    PENDING: tx("statusPending"),
    REJECTED: tx("statusRejected"),
    RESUBMIT: tx("statusResubmit"),
    NONE: tx("statusNone"),
  };

  const nextTier = (me?.kycTier ?? 0) + 1;
  const files = [front, back, selfie].filter(Boolean) as string[];
  const canSubmit = Boolean(front && selfie && consent && (docType === "passport" || back));

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      await api.kycSubmit({ tier: Math.min(nextTier, 3), docType, files, consent: true });
      await qc.invalidateQueries({ queryKey: qk.kycStatus });
      toast.success(tx("toastSuccessTitle"), tx("toastSuccessBody"));
    } catch (err) {
      setError(apiErrorMessage(err, tx("errorSubmit")));
    } finally {
      setBusy(false);
    }
  };

  const pending = status?.status === "PENDING" || Boolean(status?.pendingSubmission);
  const approved = status?.status === "APPROVED";

  return (
    <div className="mx-auto max-w-lg space-y-5">
      <PageHeader title={tx("title")} subtitle={tx("subtitle")} backHref="/account" />

      <Card className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <ShieldCheck size={20} className="text-accent-400" />
          <div>
            <p className="font-medium">{tx("currentTier")}</p>
            <p className="text-sm text-text-2">{tx("tierValue", { tier: me?.kycTier ?? 0 })}</p>
          </div>
        </div>
        {isLoading ? (
          <Skeleton className="h-5 w-16" />
        ) : (
          status && <Badge tone={STATUS_TONE[status.status]}>{STATUS_LABELS[status.status]}</Badge>
        )}
      </Card>

      {/* RESUBMIT is precisely the state where the notes matter: the reviewer is
          telling the user WHAT to fix. Showing them only on REJECTED meant a user
          asked to resubmit got no instructions at all. */}
      {status?.reviewNotes && (status.status === "REJECTED" || status.status === "RESUBMIT") && (
        <Alert tone={status.status === "REJECTED" ? "danger" : "warning"} title={tx("reviewerNotes")}>
          {status.reviewNotes}
        </Alert>
      )}

      {approved ? (
        <Alert tone="success" title={tx("verifiedTitle")}>
          <span className="flex items-center gap-1.5">
            <BadgeCheck size={16} /> {tx("verifiedBody")}
          </span>
        </Alert>
      ) : pending ? (
        <Alert tone="info" title={tx("underReviewTitle")}>
          {tx("underReviewBody")}
        </Alert>
      ) : (
        <Card className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-sm font-medium">{tx("documentType")}</label>
            <Select
              aria-label={tx("documentType")}
              value={docType}
              onChange={(e) => setDocType(e.target.value as (typeof KYC_DOC_TYPES)[number])}
              options={KYC_DOC_TYPES.map((d) => ({ value: d, label: DOC_LABELS[d] }))}
            />
          </div>

          <div className="space-y-2">
            <DocumentUpload label={tx("docFront")} onUploaded={setFront} onCleared={() => setFront(undefined)} />
            {docType !== "passport" && (
              <DocumentUpload label={tx("docBack")} onUploaded={setBack} onCleared={() => setBack(undefined)} />
            )}
            <DocumentUpload label={tx("selfie")} onUploaded={setSelfie} onCleared={() => setSelfie(undefined)} />
          </div>

          <label className="flex items-start gap-2.5 text-sm text-text-2">
            <input
              type="checkbox"
              checked={consent}
              onChange={(e) => setConsent(e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-border accent-accent-400"
            />
            <span>{tx("consent")}</span>
          </label>

          {error && <Alert tone="danger">{error}</Alert>}

          <Button className="w-full" onClick={submit} disabled={!canSubmit || busy}>
            {busy ? tx("submitting") : tx("submit")}
          </Button>
        </Card>
      )}
    </div>
  );
}
