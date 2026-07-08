import { Controller, Delete, Get, Param, Put, Query, ServiceUnavailableException } from "@nestjs/common";
import { z } from "zod";
import {
  zMarketCoinsQuery,
  zChartRangeQuery,
  zMarketSearchQuery,
  type ChartRangeQuery,
  type MarketChart,
  type MarketCoinDetail,
  type MarketCoinsQuery,
  type MarketCoinsResponse,
  type MarketGlobal,
  type MarketMovers,
  type MarketSearchQuery,
  type MarketSearchResponse,
  type NewsResponse,
  type WatchlistResponse,
  type FearGreed,
} from "@quatatrade/shared";
import { CurrentUserId, Public } from "../../common/auth/decorators";
import { ZodPipe } from "../../common/zod.pipe";
import { MarketsService, MarketDataUnavailableError } from "./markets.service";
import { WatchlistService } from "./watchlist.service";

/** Coin ids from CoinGecko are lowercase slugs (e.g. "bitcoin", "tron"). */
const zCoinId = z.string().trim().min(1).max(120).regex(/^[a-z0-9-]+$/);

/**
 * markets — public, read-only market data (informational; independent of the
 * P2P engine). Responses are Redis-cached in the service; a total upstream
 * outage surfaces as 503 only when there is not even a stale copy to serve.
 */
@Controller("markets")
export class MarketsController {
  constructor(
    private readonly markets: MarketsService,
    private readonly watchlist: WatchlistService,
  ) {}

  // ── watchlist (authenticated user — NOT @Public) ─────────────────────────
  @Get("watchlist")
  async watchlistList(@CurrentUserId() userId: string): Promise<WatchlistResponse> {
    return { coinIds: await this.watchlist.list(userId) };
  }

  @Put("watchlist/:id")
  async watchlistAdd(@CurrentUserId() userId: string, @Param("id", new ZodPipe(zCoinId)) id: string): Promise<WatchlistResponse> {
    return { coinIds: await this.watchlist.add(userId, id) };
  }

  @Delete("watchlist/:id")
  async watchlistRemove(
    @CurrentUserId() userId: string,
    @Param("id", new ZodPipe(zCoinId)) id: string,
  ): Promise<WatchlistResponse> {
    return { coinIds: await this.watchlist.remove(userId, id) };
  }

  @Public()
  @Get("global")
  async global(): Promise<MarketGlobal> {
    try {
      return await this.markets.global();
    } catch (err) {
      throw this.map(err);
    }
  }

  @Public()
  @Get("coins")
  async coins(@Query(new ZodPipe(zMarketCoinsQuery)) q: MarketCoinsQuery): Promise<MarketCoinsResponse> {
    try {
      const items = await this.markets.coins({ order: q.order, page: q.page, perPage: q.perPage, category: q.category });
      return { items, page: q.page, perPage: q.perPage };
    } catch (err) {
      throw this.map(err);
    }
  }

  @Public()
  @Get("movers")
  async movers(): Promise<MarketMovers> {
    try {
      return await this.markets.movers();
    } catch (err) {
      throw this.map(err);
    }
  }

  @Public()
  @Get("search")
  async search(@Query(new ZodPipe(zMarketSearchQuery)) q: MarketSearchQuery): Promise<MarketSearchResponse> {
    try {
      return { coins: await this.markets.search(q.q) };
    } catch (err) {
      throw this.map(err);
    }
  }

  @Public()
  @Get("news")
  async news(): Promise<NewsResponse> {
    try {
      return await this.markets.news();
    } catch (err) {
      throw this.map(err);
    }
  }

  @Public()
  @Get("fear-greed")
  async fearGreed(): Promise<FearGreed> {
    try {
      return await this.markets.fearGreed();
    } catch (err) {
      throw this.map(err);
    }
  }

  @Public()
  @Get("coins/:id")
  async coin(@Param("id", new ZodPipe(zCoinId)) id: string): Promise<MarketCoinDetail> {
    try {
      return await this.markets.coin(id);
    } catch (err) {
      throw this.map(err);
    }
  }

  @Public()
  @Get("coins/:id/chart")
  async chart(
    @Param("id", new ZodPipe(zCoinId)) id: string,
    @Query(new ZodPipe(zChartRangeQuery)) q: ChartRangeQuery,
  ): Promise<MarketChart> {
    try {
      return await this.markets.chart(id, q.range);
    } catch (err) {
      throw this.map(err);
    }
  }

  private map(err: unknown): Error {
    if (err instanceof MarketDataUnavailableError) return new ServiceUnavailableException(err.message);
    return err instanceof Error ? err : new Error(String(err));
  }
}
