"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSyncExternalStore } from "react";
import type { AdminLoginRequest } from "@quatatrade/shared";
import { adminApi, getAdminToken, setAdminToken, subscribeAdminToken } from "@/lib/api/admin-client";

/** Reactive admin-token presence (no localStorage; memory only). */
export function useAdminToken(): string | null {
  return useSyncExternalStore(subscribeAdminToken, getAdminToken, () => null);
}

export function useAdminMe(enabled = true) {
  return useQuery({ queryKey: ["admin", "me"], queryFn: () => adminApi.adminMe(), retry: false, enabled });
}

export function useAdminLogin() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: AdminLoginRequest) => adminApi.adminLogin(body),
    onSuccess: (res) => {
      if (res.accessToken) setAdminToken(res.accessToken);
      void qc.invalidateQueries({ queryKey: ["admin"] });
    },
  });
}

export function adminLogout(qcClear: () => void): void {
  setAdminToken(null);
  qcClear();
}

export function useAdminKpis() {
  return useQuery({ queryKey: ["admin", "kpis"], queryFn: () => adminApi.adminKpis(), refetchInterval: 30_000 });
}
export function useAdminMetrics(days: number) {
  return useQuery({ queryKey: ["admin", "metrics", days], queryFn: () => adminApi.adminMetrics({ days }) });
}
export function useAdminUsers(page: number, search?: string) {
  return useQuery({
    queryKey: ["admin", "users", page, search ?? ""],
    queryFn: () => adminApi.adminUsers({ page, pageSize: 20, ...(search ? { search } : {}) }),
  });
}
export function useAdminUserDetail(id: string) {
  return useQuery({
    queryKey: ["admin", "user", id],
    queryFn: () => adminApi.adminUserDetail(id),
    enabled: Boolean(id),
  });
}
// Type aliases (not interfaces) so they carry an implicit index signature and
// are assignable to Record<string, string | undefined> for `clean`.
export type TradesFilters = {
  status?: string;
  from?: string;
  to?: string;
};
export type WithdrawalsFilters = {
  status?: string;
  from?: string;
  to?: string;
};
export type AuditFilters = {
  actorType?: string;
  action?: string;
  from?: string;
  to?: string;
};
/** Drop empty-string filter values so they aren't sent as blank query params. */
function clean(f: Record<string, string | undefined>): Record<string, string | undefined> {
  const out: Record<string, string | undefined> = {};
  for (const [k, v] of Object.entries(f)) out[k] = v && v.length > 0 ? v : undefined;
  return out;
}

export function useAdminWithdrawals(page: number, pageSize = 20, filters: WithdrawalsFilters = {}) {
  return useQuery({
    queryKey: ["admin", "withdrawals", page, pageSize, filters],
    queryFn: () => adminApi.adminWithdrawals({ page, pageSize, ...clean(filters) }),
  });
}
export function useAdminDisputes(page: number) {
  return useQuery({ queryKey: ["admin", "disputes", page], queryFn: () => adminApi.adminDisputes({ page, pageSize: 20 }) });
}
export function useAdminKycQueue(page: number) {
  return useQuery({ queryKey: ["admin", "kyc", page], queryFn: () => adminApi.adminKycQueue({ page, pageSize: 20 }) });
}
export function useAdminTrades(page: number, pageSize = 20, filters: TradesFilters = {}) {
  return useQuery({
    queryKey: ["admin", "trades", page, pageSize, filters],
    queryFn: () => adminApi.adminTrades({ page, pageSize, ...clean(filters) }),
  });
}
export function useAdminKillSwitch() {
  return useQuery({ queryKey: ["admin", "kill-switch"], queryFn: () => adminApi.adminKillSwitch() });
}
export function useAdminRevenue() {
  return useQuery({ queryKey: ["admin", "revenue"], queryFn: () => adminApi.adminRevenue() });
}
export function useAdminTreasury() {
  return useQuery({ queryKey: ["admin", "treasury"], queryFn: () => adminApi.adminTreasury() });
}
export function useAdminAuditLogs(page: number, pageSize = 30, filters: AuditFilters = {}) {
  return useQuery({
    queryKey: ["admin", "audit", page, pageSize, filters],
    queryFn: () => adminApi.adminAuditLogs({ page, pageSize, ...clean(filters) }),
  });
}
