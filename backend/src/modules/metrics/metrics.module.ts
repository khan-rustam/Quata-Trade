import { Module } from "@nestjs/common";
import { APP_INTERCEPTOR } from "@nestjs/core";
import { MetricsController } from "./metrics.controller";
import { MetricsService } from "./metrics.service";
import { MetricsInterceptor } from "./metrics.interceptor";

/**
 * Prometheus metrics. DB is @Global, so MetricsService needs no explicit imports.
 * The interceptor is registered app-wide via APP_INTERCEPTOR (HTTP timing on every route).
 */
@Module({
  controllers: [MetricsController],
  providers: [MetricsService, { provide: APP_INTERCEPTOR, useClass: MetricsInterceptor }],
})
export class MetricsModule {}
