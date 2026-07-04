"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { SetCountryEnabledRequest } from "@quatatrade/shared";
import { api } from "@/lib/api/client";
import { adminApi } from "@/lib/api/admin-client";

/** Public: enabled markets for the sign-up picker (rarely changes → long stale time). */
export function useCountries() {
  return useQuery({ queryKey: ["countries"], queryFn: () => api.countries(), staleTime: 5 * 60_000 });
}

/** Admin: every market (enabled or not) for the rollout console. */
export function useAdminCountries() {
  return useQuery({ queryKey: ["admin", "countries"], queryFn: () => adminApi.adminCountries() });
}

export function useSetCountryEnabled() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ code, body }: { code: string; body: SetCountryEnabledRequest }) =>
      adminApi.adminSetCountryEnabled(code, body),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["admin", "countries"] });
      void qc.invalidateQueries({ queryKey: ["countries"] });
    },
  });
}
