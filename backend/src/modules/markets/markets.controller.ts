import { Controller, Get, Param, Query, ServiceUnavailableException } from "@nestjs/common";
import { z } from "zod";
import {
  zMarketCoinsQuery,
  zChartRangeQuery,
  type ChartRangeQuery,
  type MarketChart,
  type MarketCoinDetail,
  type MarketCoinsQuery,
  type MarketCoinsResponse,
  type MarketGlobal,
} from "@quatatrade/shared";
import { Public } from "../../common/auth/decorators";
import { ZodPipe } from "../../common/zod.pipe";
import { MarketsService, MarketDataUnavailableError } from "./markets.service";

/** Coin ids from CoinGecko are lowercase slugs (e.g. "bitcoin", "tron"). */
const zCoinId = z.string().trim().min(1).max(120).regex(/^[a-z0-9-]+$/);

/**
 * markets — public, read-only market data (informational; independent of the
 * P2P engine). Responses are Redis-cached in the service; a total upstream
 * outage surfaces as 503 only when there is not even a stale copy to serve.
 */
@Controller("markets")
export class MarketsController {
  constructor(private readonly markets: MarketsService) {}

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
      const items = await this.markets.coins({ order: q.order, page: q.page, perPage: q.perPage });
      return { items, page: q.page, perPage: q.perPage };
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
