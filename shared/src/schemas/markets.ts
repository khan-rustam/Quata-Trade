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
  // CoinGecko category id (e.g. "decentralized-finance-defi"). Empty = all.
  category: z
    .string()
    .trim()
    .max(60)
    .regex(/^[a-z0-9-]+$/)
    .optional(),
});
export type MarketCoinsQuery = z.infer<typeof zMarketCoinsQuery>;

export const zMarketCoinsResponse = z.object({
  items: z.array(zMarketCoin),
  page: z.number().int(),
  perPage: z.number().int(),
});
export type MarketCoinsResponse = z.infer<typeof zMarketCoinsResponse>;

// ---- asset detail (Phase B, enriched Phase E) ----
export const zMarketCoinDetail = z.object({
  id: z.string(),
  symbol: z.string(),
  name: z.string(),
  image: z.string(),
  description: z.string(),
  price: z.number(),
  change24h: z.number().nullable(),
  high24h: z.number().nullable(),
  low24h: z.number().nullable(),
  ath: z.number().nullable(),
  athDate: z.string().nullable(),
  atl: z.number().nullable(),
  atlDate: z.string().nullable(),
  marketCap: z.number(),
  fdv: z.number().nullable(),
  circulatingSupply: z.number().nullable(),
  totalSupply: z.number().nullable(),
  maxSupply: z.number().nullable(),
  volume24h: z.number(),
  rank: z.number().nullable(),
  // Phase E extras (from the CoinGecko detail payload)
  homepage: z.string().nullable(),
  explorer: z.string().nullable(),
  twitter: z.string().nullable(),
  reddit: z.string().nullable(),
  categories: z.array(z.string()),
  sentimentUp: z.number().nullable(),
});
export type MarketCoinDetail = z.infer<typeof zMarketCoinDetail>;

export const zChartRange = z.enum(["24h", "7d", "30d", "90d", "1y", "all"]);
export type ChartRange = z.infer<typeof zChartRange>;

export const zChartRangeQuery = z.object({ range: zChartRange.default("7d") });
export type ChartRangeQuery = z.infer<typeof zChartRangeQuery>;

export const zMarketChart = z.object({
  range: z.string(),
  line: z.array(z.object({ t: z.number(), v: z.number() })),
  candles: z.array(z.object({ t: z.number(), o: z.number(), h: z.number(), l: z.number(), c: z.number() })),
});
export type MarketChart = z.infer<typeof zMarketChart>;

// ---- watchlist (Phase C, authenticated) ----
export const zWatchlistResponse = z.object({ coinIds: z.array(z.string()) });
export type WatchlistResponse = z.infer<typeof zWatchlistResponse>;

// ---- movers + search (Phase E) ----
export const zTrendingCoin = z.object({
  id: z.string(),
  symbol: z.string(),
  name: z.string(),
  image: z.string(),
  rank: z.number().nullable(),
});
export type TrendingCoin = z.infer<typeof zTrendingCoin>;

export const zMarketMovers = z.object({
  trending: z.array(zTrendingCoin),
  gainers: z.array(zMarketCoin),
  losers: z.array(zMarketCoin),
  topVolume: z.array(zMarketCoin),
});
export type MarketMovers = z.infer<typeof zMarketMovers>;

export const zMarketSearchQuery = z.object({ q: z.string().trim().min(1).max(80) });
export type MarketSearchQuery = z.infer<typeof zMarketSearchQuery>;

export const zMarketSearchResponse = z.object({ coins: z.array(zTrendingCoin) });
export type MarketSearchResponse = z.infer<typeof zMarketSearchResponse>;

// ---- price alerts (Phase G, authenticated) ----
export const zAlertDirection = z.enum(["above", "below"]);
export type AlertDirection = z.infer<typeof zAlertDirection>;

export const zPriceAlert = z.object({
  id: z.string(),
  coinId: z.string(),
  symbol: z.string(),
  direction: zAlertDirection,
  target: z.number().positive(),
  active: z.boolean(),
  triggeredAt: z.string().nullable(),
  createdAt: z.string(),
});
export type PriceAlert = z.infer<typeof zPriceAlert>;

export const zPriceAlertsResponse = z.object({ items: z.array(zPriceAlert) });
export type PriceAlertsResponse = z.infer<typeof zPriceAlertsResponse>;

export const zCreatePriceAlertRequest = z
  .object({
    coinId: z
      .string()
      .trim()
      .min(1)
      .max(120)
      .regex(/^[a-z0-9-]+$/),
    symbol: z.string().trim().min(1).max(20),
    direction: zAlertDirection,
    target: z.number().positive(),
  })
  .strict();
export type CreatePriceAlertRequest = z.infer<typeof zCreatePriceAlertRequest>;

// ---- news (Phase F, CryptoPanic) ----
export const zNewsItem = z.object({
  title: z.string(),
  url: z.string(),
  source: z.string(),
  publishedAt: z.string(),
  currencies: z.array(z.string()),
});
export type NewsItem = z.infer<typeof zNewsItem>;

export const zNewsResponse = z.object({ items: z.array(zNewsItem) });
export type NewsResponse = z.infer<typeof zNewsResponse>;

// ---- fear & greed (Phase D) ----
export const zFearGreed = z.object({
  value: z.number(), // 0..100
  classification: z.string(),
  history: z.array(z.object({ t: z.number(), v: z.number() })),
});
export type FearGreed = z.infer<typeof zFearGreed>;
