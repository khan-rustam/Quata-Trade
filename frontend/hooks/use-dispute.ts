"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { SubmitEvidenceRequest } from "@quatatrade/shared";
import { api } from "@/lib/api/client";
import { qk } from "@/lib/api/query-keys";

const disputeKey = (id: string) => ["disputes", id] as const;

/** The dispute for a trade (reason, status, evidence timeline). Enabled once the
 * trade detail surfaces its disputeId. */
export function useDispute(disputeId: string | null | undefined) {
  return useQuery({
    queryKey: disputeKey(disputeId ?? "none"),
    queryFn: () => api.dispute(disputeId as string),
    enabled: Boolean(disputeId),
  });
}

/** Submit evidence (kind + note + uploaded file keys), then refresh the dispute + trade. */
export function useSubmitEvidence(disputeId: string, tradeId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: SubmitEvidenceRequest) => api.submitEvidence(disputeId, body),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: disputeKey(disputeId) });
      void qc.invalidateQueries({ queryKey: qk.trade(tradeId) });
    },
  });
}
