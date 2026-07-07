import { Module } from "@nestjs/common";
import { MarketsController } from "./markets.controller";
import { MarketsService } from "./markets.service";
import { CoinGeckoProvider } from "./markets.provider";
import { MARKET_PROVIDERS } from "./markets.tokens";

/**
 * markets — informational market-data (Documents/02: Markets tab). Provider
 * chain is ordered = failover priority; add more providers to the array to
 * extend it without touching the service. Redis (global) supplies the cache.
 */
@Module({
  controllers: [MarketsController],
  providers: [
    CoinGeckoProvider,
    {
      provide: MARKET_PROVIDERS,
      inject: [CoinGeckoProvider],
      // Ordered failover chain — CoinGecko primary; add CoinCap/CMC here later.
      useFactory: (coingecko: CoinGeckoProvider) => [coingecko],
    },
    MarketsService,
  ],
  exports: [MarketsService],
})
export class MarketsModule {}
