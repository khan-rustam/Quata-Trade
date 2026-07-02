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
export function useAdminUsers(page: number, search?: string) {
  return useQuery({
    queryKey: ["admin", "users", page, search ?? ""],
    queryFn: () => adminApi.adminUsers({ page, pageSize: 20, ...(search ? { search } : {}) }),
  });
}
export function useAdminWithdrawals(page: number) {
  return useQuery({ queryKey: ["admin", "withdrawals", page], queryFn: () => adminApi.adminWithdrawals({ page, pageSize: 20 }) });
}
export function useAdminDisputes(page: number) {
  return useQuery({ queryKey: ["admin", "disputes", page], queryFn: () => adminApi.adminDisputes({ page, pageSize: 20 }) });
}
export function useAdminKycQueue(page: number) {
  return useQuery({ queryKey: ["admin", "kyc", page], queryFn: () => adminApi.adminKycQueue({ page, pageSize: 20 }) });
}
export function useAdminTrades(page: number) {
  return useQuery({ queryKey: ["admin", "trades", page], queryFn: () => adminApi.adminTrades({ page, pageSize: 20 }) });
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
export function useAdminAuditLogs(page: number) {
  return useQuery({ queryKey: ["admin", "audit", page], queryFn: () => adminApi.adminAuditLogs({ page, pageSize: 30 }) });
}
