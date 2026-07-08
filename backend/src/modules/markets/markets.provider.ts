import { Inject, Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { MarketChart, MarketCoin, MarketCoinDetail, MarketGlobal, TrendingCoin } from "@quatatrade/shared";
import type { Env } from "../../config/env";

export interface ListCoinsParams {
  /** CoinGecko-native order (market cap / volume). Other sorts are done client-side per page. */
  order: "market_cap_desc" | "market_cap_asc" | "volume_desc";
  page: number;
  perPage: number;
}

/** How many days of history a chart range maps to (CoinGecko `days` param). */
export const RANGE_DAYS: Record<string, string> = {
  "24h": "1",
  "7d": "7",
  "30d": "30",
  "90d": "90",
  "1y": "365",
  all: "max",
};

/**
 * Market-data provider boundary. A new provider (CoinCap, CoinMarketCap) just
 * implements this and is added to the MarketsService failover chain — the rest
 * of the app is provider-agnostic (spec: "automatic failover", modular).
 */
export interface MarketDataProvider {
  readonly name: string;
  globalOverview(): Promise<MarketGlobal>;
  listCoins(params: ListCoinsParams): Promise<MarketCoin[]>;
  getCoin(id: string): Promise<MarketCoinDetail>;
  getChart(id: string, range: string): Promise<MarketChart>;
  trending(): Promise<TrendingCoin[]>;
  search(query: string): Promise<TrendingCoin[]>;
}

/** First non-empty URL from a CoinGecko link array (they include empty strings). */
function firstUrl(arr?: (string | null)[]): string | null {
  return arr?.find((u): u is string => typeof u === "string" && u.length > 0) ?? null;
}

interface CgTrendingItem {
  id: string;
  symbol?: string;
  name?: string;
  thumb?: string;
  small?: string;
  large?: string;
  market_cap_rank?: number | null;
}

function mapTrending(i: CgTrendingItem): TrendingCoin {
  return {
    id: i.id,
    symbol: (i.symbol ?? "").toUpperCase(),
    name: i.name ?? i.id,
    image: i.large ?? i.small ?? i.thumb ?? "",
    rank: i.market_cap_rank ?? null,
  };
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

interface CgUsd {
  usd?: number;
}
interface CgCoinDetail {
  id: string;
  symbol: string;
  name: string;
  image?: { large?: string; small?: string };
  description?: { en?: string };
  categories?: (string | null)[];
  sentiment_votes_up_percentage?: number | null;
  links?: {
    homepage?: (string | null)[];
    blockchain_site?: (string | null)[];
    twitter_screen_name?: string | null;
    subreddit_url?: string | null;
  };
  market_data?: {
    current_price?: CgUsd;
    high_24h?: CgUsd;
    low_24h?: CgUsd;
    price_change_percentage_24h?: number;
    ath?: CgUsd;
    ath_date?: { usd?: string };
    atl?: CgUsd;
    atl_date?: { usd?: string };
    market_cap?: CgUsd;
    fully_diluted_valuation?: CgUsd;
    circulating_supply?: number | null;
    total_supply?: number | null;
    max_supply?: number | null;
    total_volume?: CgUsd;
    market_cap_rank?: number | null;
  };
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

  async getCoin(id: string): Promise<MarketCoinDetail> {
    const url = `${this.baseUrl}/coins/${encodeURIComponent(id)}?localization=false&tickers=false&market_data=true&community_data=false&developer_data=false&sparkline=false`;
    const c = await fetchJson<CgCoinDetail>(url, this.headers);
    const m = c.market_data ?? {};
    // Strip HTML tags/links from the description; keep it plain and short-ish.
    const description = (c.description?.en ?? "").replace(/<[^>]*>/g, "").trim();
    return {
      id: c.id,
      symbol: c.symbol.toUpperCase(),
      name: c.name,
      image: c.image?.large ?? c.image?.small ?? "",
      description,
      price: m.current_price?.usd ?? 0,
      change24h: m.price_change_percentage_24h ?? null,
      high24h: m.high_24h?.usd ?? null,
      low24h: m.low_24h?.usd ?? null,
      ath: m.ath?.usd ?? null,
      athDate: m.ath_date?.usd ?? null,
      atl: m.atl?.usd ?? null,
      atlDate: m.atl_date?.usd ?? null,
      marketCap: m.market_cap?.usd ?? 0,
      fdv: m.fully_diluted_valuation?.usd ?? null,
      circulatingSupply: m.circulating_supply ?? null,
      totalSupply: m.total_supply ?? null,
      maxSupply: m.max_supply ?? null,
      volume24h: m.total_volume?.usd ?? 0,
      rank: m.market_cap_rank ?? null,
      homepage: firstUrl(c.links?.homepage),
      explorer: firstUrl(c.links?.blockchain_site),
      twitter: c.links?.twitter_screen_name ? `https://twitter.com/${c.links.twitter_screen_name}` : null,
      reddit: c.links?.subreddit_url || null,
      categories: (c.categories ?? []).filter((x): x is string => typeof x === "string" && x.length > 0).slice(0, 8),
      sentimentUp: typeof c.sentiment_votes_up_percentage === "number" ? c.sentiment_votes_up_percentage : null,
    };
  }

  async trending(): Promise<TrendingCoin[]> {
    const body = await fetchJson<{ coins?: { item?: CgTrendingItem }[] }>(`${this.baseUrl}/search/trending`, this.headers);
    return (body.coins ?? []).map((c) => c.item).filter((i): i is CgTrendingItem => Boolean(i)).map(mapTrending);
  }

  async search(query: string): Promise<TrendingCoin[]> {
    const body = await fetchJson<{ coins?: CgTrendingItem[] }>(
      `${this.baseUrl}/search?query=${encodeURIComponent(query)}`,
      this.headers,
    );
    return (body.coins ?? []).slice(0, 15).map(mapTrending);
  }

  async getChart(id: string, range: string): Promise<MarketChart> {
    const days = RANGE_DAYS[range] ?? "7";
    const cid = encodeURIComponent(id);
    const [chart, ohlc] = await Promise.all([
      fetchJson<{ prices?: [number, number][] }>(
        `${this.baseUrl}/coins/${cid}/market_chart?vs_currency=usd&days=${days}`,
        this.headers,
      ),
      // OHLC (candlesticks). Best-effort — some ranges/coins may not return it.
      fetchJson<[number, number, number, number, number][]>(
        `${this.baseUrl}/coins/${cid}/ohlc?vs_currency=usd&days=${days}`,
        this.headers,
      ).catch(() => [] as [number, number, number, number, number][]),
    ]);
    return {
      range,
      line: (chart.prices ?? []).map(([t, v]) => ({ t, v })),
      candles: ohlc.map(([t, o, h, l, c]) => ({ t, o, h, l, c })),
    };
  }
}
