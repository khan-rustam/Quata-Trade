"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { BlockAddressRequest } from "@quatatrade/shared";
import { adminApi } from "@/lib/api/admin-client";

const KEY = ["admin", "screening"] as const;

/** AML blocklist — the addresses screened on every deposit/withdrawal (compliance-managed). */
export function useBlockedAddresses() {
  return useQuery({ queryKey: KEY, queryFn: () => adminApi.adminBlockedAddresses() });
}

export function useBlockAddress() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: BlockAddressRequest) => adminApi.adminBlockAddress(body),
    onSuccess: () => void qc.invalidateQueries({ queryKey: KEY }),
  });
}

export function useUnblockAddress() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => adminApi.adminUnblockAddress(id),
    onSuccess: () => void qc.invalidateQueries({ queryKey: KEY }),
  });
}
