import { z } from "zod";

/**
 * Market-data contract (informational Markets page). These are external USD
 * figures for display only — NOT ledger/custody amounts, so `number` is correct
 * here (the BIGINT-string money rule applies to QuataTrade balances, not to
 * third-party market prices).
 */
export const zMarketGlobal = z.object({
  totalMarketCap: z.number(),
  totalVolume24h: z.number(),
  btcDominance: z.number(),
  ethDominance: z.number(),
  activeCryptos: z.number(),
  markets: z.number(),
  marketCapChange24h: z.number(),
});
export type MarketGlobal = z.infer<typeof zMarketGlobal>;

export const zMarketCoin = z.object({
  id: z.string(),
  symbol: z.string(),
  name: z.string(),
  image: z.string(),
  price: z.number(),
  change1h: z.number().nullable(),
  change24h: z.number().nullable(),
  change7d: z.number().nullable(),
  marketCap: z.number(),
  volume24h: z.number(),
  rank: z.number().nullable(),
  circulatingSupply: z.number().nullable(),
  sparkline: z.array(z.number()),
});
export type MarketCoin = z.infer<typeof zMarketCoin>;

export const zMarketCoinsQuery = z.object({
  // CoinGecko-native orders; other column sorts are applied client-side per page.
  order: z.enum(["market_cap_desc", "market_cap_asc", "volume_desc"]).default("market_cap_desc"),
  page: z.coerce.number().int().min(1).default(1),
  perPage: z.coerce.number().int().min(1).max(250).default(100),
});
export type MarketCoinsQuery = z.infer<typeof zMarketCoinsQuery>;

export const zMarketCoinsResponse = z.object({
  items: z.array(zMarketCoin),
  page: z.number().int(),
  perPage: z.number().int(),
});
export type MarketCoinsResponse = z.infer<typeof zMarketCoinsResponse>;
