/** Centralized TanStack Query keys, one namespace per resource (Documents/02). */
export const qk = {
  me: ["me"] as const,
  sessions: ["sessions"] as const,
  kycStatus: ["kyc", "status"] as const,
  balances: ["wallet", "balances"] as const,
  depositAddress: (asset: string) => ["wallet", "deposit-address", asset] as const,
  deposits: (page: number) => ["wallet", "deposits", page] as const,
  withdrawals: (page: number) => ["withdrawals", page] as const,
  offers: (filters: Record<string, unknown>) => ["offers", filters] as const,
  myOffers: ["offers", "mine"] as const,
  offer: (id: string) => ["offers", id] as const,
  trades: (filters: Record<string, unknown>) => ["trades", filters] as const,
  trade: (id: string) => ["trades", id] as const,
  messages: (tradeId: string) => ["trades", tradeId, "messages"] as const,
  notifications: (page: number) => ["notifications", page] as const,
} as const;
