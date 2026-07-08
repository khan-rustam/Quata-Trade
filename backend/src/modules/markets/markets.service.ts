import { Inject, Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type Redis from "ioredis";
import type {
  FearGreed,
  MarketChart,
  MarketCoin,
  MarketCoinDetail,
  MarketGlobal,
  MarketMovers,
  NewsItem,
  NewsResponse,
  TrendingCoin,
} from "@quatatrade/shared";
import type { Env } from "../../config/env";
import { REDIS } from "../../common/redis/redis.module";
import { MARKET_PROVIDERS } from "./markets.tokens";
import type { ListCoinsParams, MarketDataProvider } from "./markets.provider";

export class MarketDataUnavailableError extends Error {
  constructor() {
    super("market data is temporarily unavailable");
    this.name = "MarketDataUnavailableError";
  }
}

/**
 * Read-through Redis cache over the market-data provider chain (spec: Redis
 * caching + automatic failover). Fresh within TTL; on a total provider outage
 * it serves the last-good ("stale") copy so the Markets page degrades to
 * slightly-old data instead of an error. Money-path rule N/A: these are
 * informational USD figures, never ledger amounts.
 */
@Injectable()
export class MarketsService {
  private readonly logger = new Logger(MarketsService.name);
  private readonly ttl: number;
  private readonly newsKey: string;

  constructor(
    @Inject(REDIS) private readonly redis: Redis,
    @Inject(MARKET_PROVIDERS) private readonly providers: MarketDataProvider[],
    config: ConfigService<Env, true>,
  ) {
    this.ttl = config.get("MARKETS_CACHE_TTL_SECONDS", { infer: true });
    this.newsKey = config.get("CRYPTOPANIC_API_KEY", { infer: true });
  }

  global(): Promise<MarketGlobal> {
    return this.cached("markets:global", () => this.fromProviders((p) => p.globalOverview()));
  }

  coins(params: ListCoinsParams): Promise<MarketCoin[]> {
    const key = `markets:coins:${params.order}:${params.page}:${params.perPage}:${params.category ?? "all"}`;
    return this.cached(key, () => this.fromProviders((p) => p.listCoins(params)));
  }

  coin(id: string): Promise<MarketCoinDetail> {
    // Detail + charts change slowly and are the heaviest upstream calls — cache
    // them longer to stay well under the CoinGecko free-tier rate limit.
    return this.cached(`markets:coin:${id}`, () => this.fromProviders((p) => p.getCoin(id)), 300);
  }

  chart(id: string, range: string): Promise<MarketChart> {
    return this.cached(`markets:chart:${id}:${range}`, () => this.fromProviders((p) => p.getChart(id, range)), 300);
  }

  /** Trending + top gainers/losers/volume, derived from the top 250 by market cap. */
  movers(): Promise<MarketMovers> {
    return this.cached("markets:movers", async () => {
      const [top, trending] = await Promise.all([
        this.fromProviders((p) => p.listCoins({ order: "market_cap_desc", page: 1, perPage: 250 })),
        this.fromProviders((p) => p.trending()).catch(() => [] as TrendingCoin[]),
      ]);
      const withChange = top.filter((c) => c.change24h !== null);
      const byChange = [...withChange].sort((a, b) => (b.change24h ?? 0) - (a.change24h ?? 0));
      const byVolume = [...top].sort((a, b) => b.volume24h - a.volume24h);
      return {
        trending,
        gainers: byChange.slice(0, 7),
        losers: byChange.slice(-7).reverse(),
        topVolume: byVolume.slice(0, 7),
      };
    });
  }

  search(query: string): Promise<TrendingCoin[]> {
    return this.cached(`markets:search:${query.toLowerCase()}`, () => this.fromProviders((p) => p.search(query)), 120);
  }

  /** Crypto news (CryptoPanic). Empty list when no key is configured (feature off). */
  news(): Promise<NewsResponse> {
    if (this.newsKey.trim() === "") return Promise.resolve({ items: [] });
    return this.cached(
      "markets:news",
      async () => {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 8000);
        try {
          const url = `https://cryptopanic.com/api/v1/posts/?auth_token=${encodeURIComponent(this.newsKey)}&public=true&kind=news`;
          const res = await fetch(url, { signal: controller.signal });
          if (!res.ok) throw new Error(`cryptopanic ${res.status}`);
          const body = (await res.json()) as {
            results?: {
              title: string;
              url: string;
              published_at: string;
              source?: { title?: string };
              currencies?: { code?: string }[];
            }[];
          };
          const items: NewsItem[] = (body.results ?? []).slice(0, 20).map((r) => ({
            title: r.title,
            url: r.url,
            source: r.source?.title ?? "",
            publishedAt: r.published_at,
            currencies: (r.currencies ?? []).map((c) => c.code ?? "").filter(Boolean).slice(0, 4),
          }));
          return { items };
        } finally {
          clearTimeout(timer);
        }
      },
      300,
    );
  }

  /** Crypto Fear & Greed index (alternative.me — single free source, cached). */
  fearGreed(): Promise<FearGreed> {
    return this.cached("markets:fng", async () => {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 8000);
      try {
        const res = await fetch("https://api.alternative.me/fng/?limit=30", { signal: controller.signal });
        if (!res.ok) throw new Error(`fng ${res.status}`);
        const body = (await res.json()) as { data?: { value: string; value_classification: string; timestamp: string }[] };
        const data = body.data ?? [];
        const latest = data[0];
        return {
          value: latest ? Number(latest.value) : 0,
          classification: latest?.value_classification ?? "Unknown",
          // oldest → newest for the trend line
          history: [...data].reverse().map((d) => ({ t: Number(d.timestamp) * 1000, v: Number(d.value) })),
        };
      } finally {
        clearTimeout(timer);
      }
    });
  }

  /** Try each provider in order; the first success wins (automatic failover). */
  private async fromProviders<T>(call: (p: MarketDataProvider) => Promise<T>): Promise<T> {
    let lastErr: unknown;
    for (const provider of this.providers) {
      try {
        return await call(provider);
      } catch (err) {
        lastErr = err;
        this.logger.warn(`market provider ${provider.name} failed: ${err instanceof Error ? err.message : "unknown"}`);
      }
    }
    throw lastErr ?? new MarketDataUnavailableError();
  }

  private async cached<T>(key: string, fetchFresh: () => Promise<T>, ttl: number = this.ttl): Promise<T> {
    const hit = await this.redis.get(key).catch(() => null);
    if (hit) return JSON.parse(hit) as T;
    try {
      const fresh = await fetchFresh();
      const payload = JSON.stringify(fresh);
      // Fresh copy with TTL + a persistent last-good copy for outage fallback.
      await this.redis.set(key, payload, "EX", ttl).catch(() => undefined);
      await this.redis.set(`${key}:stale`, payload).catch(() => undefined);
      return fresh;
    } catch (err) {
      const stale = await this.redis.get(`${key}:stale`).catch(() => null);
      if (stale) {
        this.logger.warn(`serving stale market data for ${key}`);
        return JSON.parse(stale) as T;
      }
      throw err instanceof Error ? err : new MarketDataUnavailableError();
    }
  }
}
