import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from "@nestjs/common";
import { type Observable, tap } from "rxjs";
import { MetricsService } from "./metrics.service";

/**
 * Records HTTP request duration + count into Prometheus. The `route` label is the
 * Nest handler (Class.method), NOT the raw URL — bounded cardinality, no path
 * params or ids leaking into metric labels.
 */
@Injectable()
export class MetricsInterceptor implements NestInterceptor {
  constructor(private readonly metrics: MetricsService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== "http") return next.handle();
    const http = context.switchToHttp();
    const method = String(http.getRequest<{ method?: string }>().method ?? "UNKNOWN");
    const route = `${context.getClass().name}.${context.getHandler().name}`;
    const endTimer = this.metrics.httpDuration.startTimer({ method, route });

    const record = (): void => {
      const status = String(http.getResponse<{ statusCode?: number }>().statusCode ?? 0);
      endTimer({ status });
      this.metrics.httpTotal.inc({ method, route, status });
    };
    return next.handle().pipe(tap({ next: record, error: record }));
  }
}
