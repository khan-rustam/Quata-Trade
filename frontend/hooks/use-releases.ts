"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { PublishReleaseRequest, ReleaseStatusRequest } from "@quatatrade/shared";
import { adminApi } from "@/lib/api/admin-client";

const KEY = ["admin", "releases"] as const;

/** Every release (all statuses) — the Release Management dashboard. */
export function useReleases() {
  return useQuery({ queryKey: KEY, queryFn: () => adminApi.adminReleases() });
}

export function usePublishRelease() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: PublishReleaseRequest) => adminApi.adminPublishRelease(body),
    onSuccess: () => void qc.invalidateQueries({ queryKey: KEY }),
  });
}

export function useSetReleaseStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: ReleaseStatusRequest }) =>
      adminApi.adminSetReleaseStatus(id, body),
    onSuccess: () => void qc.invalidateQueries({ queryKey: KEY }),
  });
}
