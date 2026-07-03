"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { OffersQuery, OpenTradeRequest, UpdateOfferRequest } from "@quatatrade/shared";
import { api } from "@/lib/api/client";
import { qk } from "@/lib/api/query-keys";

export function useOffers(query: OffersQuery) {
  return useQuery({ queryKey: qk.offers(query), queryFn: () => api.offers(query) });
}

export function useOffer(id: string) {
  return useQuery({ queryKey: qk.offer(id), queryFn: () => api.offer(id), enabled: Boolean(id) });
}

/** The signed-in user's own offers (all statuses) for the management page. */
export function useMyOffers() {
  return useQuery({ queryKey: qk.myOffers, queryFn: () => api.myOffers() });
}

/** Invalidate both the owner's list and the public marketplace after any offer change. */
function useOfferMutation<TArgs>(fn: (args: TArgs) => Promise<unknown>) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: qk.myOffers });
      void qc.invalidateQueries({ queryKey: ["offers"] });
    },
  });
}

export function useUpdateOffer() {
  return useOfferMutation((v: { id: string; body: UpdateOfferRequest }) => api.updateOffer(v.id, v.body));
}

export function usePauseOffer() {
  return useOfferMutation((id: string) => api.pauseOffer(id));
}

export function useActivateOffer() {
  return useOfferMutation((id: string) => api.activateOffer(id));
}

export function useDeleteOffer() {
  return useOfferMutation((id: string) => api.deleteOffer(id));
}

export function useTrade(id: string, live = false) {
  return useQuery({
    queryKey: qk.trade(id),
    queryFn: () => api.trade(id),
    enabled: Boolean(id),
    refetchInterval: live ? 5000 : false,
  });
}

export function useOpenTrade() {
  return useMutation({ mutationFn: (body: OpenTradeRequest) => api.openTrade(body) });
}

export function useMessages(tradeId: string) {
  return useQuery({
    queryKey: qk.messages(tradeId),
    queryFn: () => api.messages(tradeId),
    enabled: Boolean(tradeId),
    refetchInterval: 4000,
  });
}

export function useSendMessage(tradeId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { body: string }) => api.sendMessage(tradeId, body),
    onSuccess: () => void qc.invalidateQueries({ queryKey: qk.messages(tradeId) }),
  });
}
