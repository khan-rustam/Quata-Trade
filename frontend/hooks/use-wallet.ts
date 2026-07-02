"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api/client";
import { qk } from "@/lib/api/query-keys";

export function useBalances() {
  return useQuery({ queryKey: qk.balances, queryFn: () => api.balances() });
}

export function useDepositAddress(asset: string, enabled = true) {
  return useQuery({
    queryKey: qk.depositAddress(asset),
    queryFn: () => api.depositAddress(asset),
    enabled,
  });
}

export function useWithdrawals(page = 1) {
  return useQuery({ queryKey: qk.withdrawals(page), queryFn: () => api.withdrawals({ page }) });
}

export function useDeposits(page = 1) {
  return useQuery({ queryKey: qk.deposits(page), queryFn: () => api.deposits({ page }) });
}
