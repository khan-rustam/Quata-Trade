import { Inject, Injectable, Logger } from "@nestjs/common";
import { sql, type Kysely, type RawBuilder } from "kysely";
import { Counter, Gauge, Histogram, Registry, collectDefaultMetrics } from "prom-client";
import { DB } from "../../db/database.module";
import type { Database } from "../../db/types";

/**
 * Prometheus metrics (Documents/03 §3 monitoring). Exposes:
 *  - default process metrics (cpu, memory, event-loop lag, gc)
 *  - HTTP request duration + count (labelled by handler, low cardinality)
 *  - business gauges computed from the DB AT SCRAPE TIME (grouped counts) so no
 *    money-path code is instrumented — the ledger stays untouched.
 *
 * Served at GET /metrics (root, Public). The API binds 127.0.0.1, so /metrics is
 * only reachable by Prometheus on the same host, never from the internet.
 */
@Injectable()
export class MetricsService {
  private readonly logger = new Logger(MetricsService.name);
  readonly registry = new Registry();
  readonly httpDuration: Histogram<"method" | "route" | "status">;
  readonly httpTotal: Counter<"method" | "route" | "status">;

  constructor(@Inject(DB) private readonly db: Kysely<Database>) {
    this.registry.setDefaultLabels({ app: "quatatrade-api" });
    collectDefaultMetrics({ register: this.registry });

    this.httpDuration = new Histogram({
      name: "quata_http_request_duration_seconds",
      help: "HTTP request duration in seconds",
      labelNames: ["method", "route", "status"],
      buckets: [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2, 5],
      registers: [this.registry],
    });
    this.httpTotal = new Counter({
      name: "quata_http_requests_total",
      help: "Total HTTP requests",
      labelNames: ["method", "route", "status"],
      registers: [this.registry],
    });

    // Grouped status counts — no hardcoded enum lists (GROUP BY status).
    this.groupedGauge("quata_withdrawals", "Withdrawals by status", "withdrawals");
    this.groupedGauge("quata_trades", "Trades by status", "trades");
    this.groupedGauge("quata_deposits", "Deposits by status", "deposits");

    // Scalar gauges for the incident signals.
    this.scalarGauge(
      "quata_stuck_broadcasts",
      "Withdrawals stuck in BROADCAST > 2h (needs human reconciliation)",
      sql`SELECT COUNT(*)::int AS n FROM withdrawals WHERE status = 'BROADCAST' AND updated_at < now() - interval '2 hours'`,
    );
    this.scalarGauge("quata_users_total", "Total users", sql`SELECT COUNT(*)::int AS n FROM users`);
    this.scalarGauge(
      "quata_alerts_last_hour",
      "Alerts raised in the last hour",
      sql`SELECT COUNT(*)::int AS n FROM alerts WHERE created_at > now() - interval '1 hour'`,
    );
  }

  /** Serialize the registry for the /metrics endpoint. */
  metrics(): Promise<string> {
    return this.registry.metrics();
  }

  contentType(): string {
    return this.registry.contentType;
  }

  private groupedGauge(name: string, help: string, table: "withdrawals" | "trades" | "deposits"): void {
    const db = this.db;
    const log = this.logger;
    new Gauge({
      name,
      help,
      labelNames: ["status"],
      registers: [this.registry],
      async collect(): Promise<void> {
        try {
          const rows = await sql<{ status: string; n: number }>`
            SELECT status::text AS status, COUNT(*)::int AS n FROM ${sql.table(table)} GROUP BY status
          `.execute(db);
          this.reset();
          for (const r of rows.rows) this.set({ status: r.status }, Number(r.n));
        } catch (err) {
          log.warn(`metric ${name} collect failed: ${err instanceof Error ? err.message : "unknown"}`);
        }
      },
    });
  }

  private scalarGauge(name: string, help: string, query: RawBuilder<{ n: number }>): void {
    const db = this.db;
    const log = this.logger;
    new Gauge({
      name,
      help,
      registers: [this.registry],
      async collect(): Promise<void> {
        try {
          const res = await query.execute(db);
          this.set(Number(res.rows[0]?.n ?? 0));
        } catch (err) {
          log.warn(`metric ${name} collect failed: ${err instanceof Error ? err.message : "unknown"}`);
        }
      },
    });
  }
}
