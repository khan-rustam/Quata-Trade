import { Inject, Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { MarketCoin, MarketGlobal } from "@quatatrade/shared";
import type { Env } from "../../config/env";

export interface ListCoinsParams {
  /** CoinGecko-native order (market cap / volume). Other sorts are done client-side per page. */
  order: "market_cap_desc" | "market_cap_asc" | "volume_desc";
  page: number;
  perPage: number;
}

/**
 * Market-data provider boundary. A new provider (CoinCap, CoinMarketCap) just
 * implements this and is added to the MarketsService failover chain — the rest
 * of the app is provider-agnostic (spec: "automatic failover", modular).
 */
export interface MarketDataProvider {
  readonly name: string;
  globalOverview(): Promise<MarketGlobal>;
  listCoins(params: ListCoinsParams): Promise<MarketCoin[]>;
}

async function fetchJson<T>(url: string, headers: Record<string, string>): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    const res = await fetch(url, { headers, signal: controller.signal });
    if (!res.ok) throw new Error(`upstream ${res.status}`);
    return (await res.json()) as T;
  } finally {
    clearTimeout(timer);
  }
}

interface CgCoin {
  id: string;
  symbol: string;
  name: string;
  image: string;
  current_price: number | null;
  market_cap: number | null;
  market_cap_rank: number | null;
  total_volume: number | null;
  circulating_supply: number | null;
  price_change_percentage_1h_in_currency?: number | null;
  price_change_percentage_24h_in_currency?: number | null;
  price_change_percentage_7d_in_currency?: number | null;
  sparkline_in_7d?: { price?: number[] };
}

interface CgGlobal {
  data: {
    total_market_cap: Record<string, number>;
    total_volume: Record<string, number>;
    market_cap_percentage: Record<string, number>;
    active_cryptocurrencies: number;
    markets: number;
    market_cap_change_percentage_24h_usd: number;
  };
}

/** CoinGecko provider (free/demo tier works without a key; a key raises rate limits). */
@Injectable()
export class CoinGeckoProvider implements MarketDataProvider {
  readonly name = "coingecko";
  private readonly baseUrl: string;
  private readonly headers: Record<string, string>;

  constructor(@Inject(ConfigService) config: ConfigService<Env, true>) {
    this.baseUrl = config.get("COINGECKO_API_URL", { infer: true });
    const key = config.get("COINGECKO_API_KEY", { infer: true });
    this.headers = { accept: "application/json", ...(key ? { "x-cg-demo-api-key": key } : {}) };
  }

  async globalOverview(): Promise<MarketGlobal> {
    const g = await fetchJson<CgGlobal>(`${this.baseUrl}/global`, this.headers);
    const d = g.data;
    return {
      totalMarketCap: d.total_market_cap.usd ?? 0,
      totalVolume24h: d.total_volume.usd ?? 0,
      btcDominance: d.market_cap_percentage.btc ?? 0,
      ethDominance: d.market_cap_percentage.eth ?? 0,
      activeCryptos: d.active_cryptocurrencies ?? 0,
      markets: d.markets ?? 0,
      marketCapChange24h: d.market_cap_change_percentage_24h_usd ?? 0,
    };
  }

  async listCoins(params: ListCoinsParams): Promise<MarketCoin[]> {
    const q = new URLSearchParams({
      vs_currency: "usd",
      order: params.order,
      per_page: String(params.perPage),
      page: String(params.page),
      sparkline: "true",
      price_change_percentage: "1h,24h,7d",
    });
    const rows = await fetchJson<CgCoin[]>(`${this.baseUrl}/coins/markets?${q.toString()}`, this.headers);
    return rows.map((c) => ({
      id: c.id,
      symbol: c.symbol.toUpperCase(),
      name: c.name,
      image: c.image,
      price: c.current_price ?? 0,
      change1h: c.price_change_percentage_1h_in_currency ?? null,
      change24h: c.price_change_percentage_24h_in_currency ?? null,
      change7d: c.price_change_percentage_7d_in_currency ?? null,
      marketCap: c.market_cap ?? 0,
      volume24h: c.total_volume ?? 0,
      rank: c.market_cap_rank ?? null,
      circulatingSupply: c.circulating_supply ?? null,
      sparkline: c.sparkline_in_7d?.price ?? [],
    }));
  }
}
