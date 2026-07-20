"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { AdminHeldDepositDecision } from "@quatatrade/shared";
import { adminHeldDepositsApi } from "@/lib/api/admin-client";

export type HoldFilter = "all" | "aml" | "policy";

/** Deposits parked by source screening (AML) or by the amount/limit policy. */
export function useAdminHeldDeposits(page: number, pageSize: number, hold: HoldFilter) {
  return useQuery({
    queryKey: ["admin", "held-deposits", page, pageSize, hold],
    queryFn: () => adminHeldDepositsApi.queue({ page, pageSize, hold }),
  });
}

/**
 * Release (credit despite the hold) or reject (never credit) a held deposit.
 * Both carry the compliance officer's reason — that reason is the audit record.
 */
export function useReviewHeldDeposit() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      decision,
      body,
    }: {
      id: string;
      decision: "release" | "reject";
      body: AdminHeldDepositDecision;
    }) =>
      decision === "release"
        ? adminHeldDepositsApi.release(id, body)
        : adminHeldDepositsApi.reject(id, body),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["admin"] }),
  });
}
