import { Controller, Get, Header } from "@nestjs/common";
import { Public } from "../../common/auth/decorators";
import { MetricsService } from "./metrics.service";

/**
 * Prometheus scrape endpoint. Root path (no /api/v1 prefix), Public. Only reachable
 * by Prometheus on the same host — the API binds 127.0.0.1 and Nginx does not proxy it.
 */
@Controller()
export class MetricsController {
  constructor(private readonly metrics: MetricsService) {}

  @Public()
  @Get("metrics")
  @Header("Content-Type", "text/plain; version=0.0.4; charset=utf-8")
  scrape(): Promise<string> {
    return this.metrics.metrics();
  }
}
