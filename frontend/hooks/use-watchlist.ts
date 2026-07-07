"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api/client";
import { useAuthBootstrap, useMe } from "@/hooks/use-auth";

/**
 * Market watchlist state for the (public) Markets pages. Bootstraps auth first
 * so a logged-in visitor (refresh cookie) gets their stars; guests see none.
 */
export function useWatchlist(): { authed: boolean; ids: Set<string>; toggle: (id: string) => void } {
  const ready = useAuthBootstrap();
  const me = useMe(ready);
  const authed = Boolean(me.data);
  const qc = useQueryClient();

  const wl = useQuery({
    queryKey: ["markets", "watchlist"],
    queryFn: () => api.watchlist(),
    enabled: authed,
  });

  const onSuccess = (d: { coinIds: string[] }) => qc.setQueryData(["markets", "watchlist"], d);
  const add = useMutation({ mutationFn: (id: string) => api.watchlistAdd(id), onSuccess });
  const remove = useMutation({ mutationFn: (id: string) => api.watchlistRemove(id), onSuccess });

  const ids = new Set(wl.data?.coinIds ?? []);
  const toggle = (id: string) => (ids.has(id) ? remove.mutate(id) : add.mutate(id));

  return { authed, ids, toggle };
}
