import { Inject, Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type Redis from "ioredis";
import type { MarketChart, MarketCoin, MarketCoinDetail, MarketGlobal } from "@quatatrade/shared";
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

  constructor(
    @Inject(REDIS) private readonly redis: Redis,
    @Inject(MARKET_PROVIDERS) private readonly providers: MarketDataProvider[],
    config: ConfigService<Env, true>,
  ) {
    this.ttl = config.get("MARKETS_CACHE_TTL_SECONDS", { infer: true });
  }

  global(): Promise<MarketGlobal> {
    return this.cached("markets:global", () => this.fromProviders((p) => p.globalOverview()));
  }

  coins(params: ListCoinsParams): Promise<MarketCoin[]> {
    const key = `markets:coins:${params.order}:${params.page}:${params.perPage}`;
    return this.cached(key, () => this.fromProviders((p) => p.listCoins(params)));
  }

  coin(id: string): Promise<MarketCoinDetail> {
    return this.cached(`markets:coin:${id}`, () => this.fromProviders((p) => p.getCoin(id)));
  }

  chart(id: string, range: string): Promise<MarketChart> {
    return this.cached(`markets:chart:${id}:${range}`, () => this.fromProviders((p) => p.getChart(id, range)));
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

  private async cached<T>(key: string, fetchFresh: () => Promise<T>): Promise<T> {
    const hit = await this.redis.get(key).catch(() => null);
    if (hit) return JSON.parse(hit) as T;
    try {
      const fresh = await fetchFresh();
      const payload = JSON.stringify(fresh);
      // Fresh copy with TTL + a persistent last-good copy for outage fallback.
      await this.redis.set(key, payload, "EX", this.ttl).catch(() => undefined);
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
