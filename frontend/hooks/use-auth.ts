"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import type { LoginRequest, RegisterRequest } from "@quatatrade/shared";
import { api } from "@/lib/api/client";
import { getAccessToken, setAccessToken } from "@/lib/api/auth-store";
import { qk } from "@/lib/api/query-keys";

/** Current user profile (enabled once auth bootstrap has run). */
export function useMe(enabled = true) {
  return useQuery({ queryKey: qk.me, queryFn: () => api.me(), retry: false, enabled });
}

/**
 * On first mount, try a silent refresh so a returning user (holding the
 * httpOnly refresh cookie) gets an in-memory access token before /me runs.
 */
export function useAuthBootstrap(): boolean {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    let active = true;
    void (async () => {
      if (!getAccessToken()) {
        try {
          const r = await api.refresh();
          setAccessToken(r.accessToken);
        } catch {
          /* not signed in — leave token null */
        }
      }
      if (active) setReady(true);
    })();
    return () => {
      active = false;
    };
  }, []);
  return ready;
}

export function useLogin() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: LoginRequest) => api.login(body),
    onSuccess: (res) => {
      if (res.accessToken) setAccessToken(res.accessToken);
      void qc.invalidateQueries({ queryKey: qk.me });
    },
  });
}

export function useRegister() {
  return useMutation({ mutationFn: (body: RegisterRequest) => api.register(body) });
}

export function useLogout() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.logout(),
    onSettled: () => {
      setAccessToken(null);
      qc.clear();
    },
  });
}
