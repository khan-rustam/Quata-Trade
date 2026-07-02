"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
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

const DOC_LABELS: Record<(typeof KYC_DOC_TYPES)[number], string> = {
  national_id: "National ID card",
  passport: "Passport",
  drivers_license: "Driver's license",
};

const STATUS_TONE = {
  APPROVED: "success",
  PENDING: "warning",
  REJECTED: "danger",
  RESUBMIT: "warning",
  NONE: "neutral",
} as const;

export default function KycPage(): React.JSX.Element {
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

  const nextTier = (me?.kycTier ?? 0) + 1;
  const files = [front, back, selfie].filter(Boolean) as string[];
  const canSubmit = Boolean(front && selfie && consent && (docType === "passport" || back));

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      await api.kycSubmit({ tier: Math.min(nextTier, 3), docType, files, consent: true });
      await qc.invalidateQueries({ queryKey: qk.kycStatus });
      toast.success("Submitted for review", "We'll notify you once a reviewer checks your documents.");
    } catch (err) {
      setError(apiErrorMessage(err, "Could not submit your documents"));
    } finally {
      setBusy(false);
    }
  };

  const pending = status?.status === "PENDING" || Boolean(status?.pendingSubmission);
  const approved = status?.status === "APPROVED";

  return (
    <div className="mx-auto max-w-lg space-y-5">
      <PageHeader title="Verification" subtitle="Raise your trade and withdrawal limits." backHref="/account" />

      <Card className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <ShieldCheck size={20} className="text-accent-400" />
          <div>
            <p className="font-medium">Current tier</p>
            <p className="text-sm text-text-2">Tier {me?.kycTier ?? 0}</p>
          </div>
        </div>
        {isLoading ? (
          <Skeleton className="h-5 w-16" />
        ) : (
          status && <Badge tone={STATUS_TONE[status.status]}>{status.status.toLowerCase()}</Badge>
        )}
      </Card>

      {status?.reviewNotes && status.status === "REJECTED" && (
        <Alert tone="danger" title="Reviewer notes">
          {status.reviewNotes}
        </Alert>
      )}

      {approved ? (
        <Alert tone="success" title="You're verified">
          <span className="flex items-center gap-1.5">
            <BadgeCheck size={16} /> Your identity is confirmed. Enjoy higher limits.
          </span>
        </Alert>
      ) : pending ? (
        <Alert tone="info" title="Under review">
          Your documents are with a reviewer. Decisions are made by a person — never automatically.
        </Alert>
      ) : (
        <Card className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Document type</label>
            <Select
              aria-label="Document type"
              value={docType}
              onChange={(e) => setDocType(e.target.value as (typeof KYC_DOC_TYPES)[number])}
              options={KYC_DOC_TYPES.map((d) => ({ value: d, label: DOC_LABELS[d] }))}
            />
          </div>

          <div className="space-y-2">
            <DocumentUpload label="Document — front" onUploaded={setFront} onCleared={() => setFront(undefined)} />
            {docType !== "passport" && (
              <DocumentUpload label="Document — back" onUploaded={setBack} onCleared={() => setBack(undefined)} />
            )}
            <DocumentUpload label="Selfie holding your document" onUploaded={setSelfie} onCleared={() => setSelfie(undefined)} />
          </div>

          <label className="flex items-start gap-2.5 text-sm text-text-2">
            <input
              type="checkbox"
              checked={consent}
              onChange={(e) => setConsent(e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-border accent-accent-400"
            />
            <span>
              I consent to QuataTrade processing these documents to verify my identity, kept only for the legal
              retention period.
            </span>
          </label>

          {error && <Alert tone="danger">{error}</Alert>}

          <Button className="w-full" onClick={submit} disabled={!canSubmit || busy}>
            {busy ? "Submitting…" : "Submit for review"}
          </Button>
        </Card>
      )}
    </div>
  );
}
