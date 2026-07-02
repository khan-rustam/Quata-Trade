"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { OffersQuery, OpenTradeRequest } from "@quatatrade/shared";
import { api } from "@/lib/api/client";
import { qk } from "@/lib/api/query-keys";

export function useOffers(query: OffersQuery) {
  return useQuery({ queryKey: qk.offers(query), queryFn: () => api.offers(query) });
}

export function useOffer(id: string) {
  return useQuery({ queryKey: qk.offer(id), queryFn: () => api.offer(id), enabled: Boolean(id) });
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
