import { Inject, Injectable } from "@nestjs/common";
import type { Kysely, Selectable } from "kysely";
import type { AlertItem, AlertsQuery, AlertsResponse, AlertSeverity } from "@quatatrade/shared";
import { DB } from "../../db/database.module";
import type { Database, AlertsTable } from "../../db/types";
import { AlertNotFoundError } from "./admin.errors";

type AlertRow = Selectable<AlertsTable>;

function toItem(r: AlertRow): AlertItem {
  return {
    id: r.id,
    severity: r.severity as AlertSeverity,
    eventType: r.event_type,
    title: r.title,
    metadata: (r.metadata as Record<string, unknown> | null) ?? null,
    acknowledgedAt: r.acknowledged_at ? r.acknowledged_at.toISOString() : null,
    acknowledgedBy: r.acknowledged_by,
    createdAt: r.created_at.toISOString(),
  };
}

/**
 * Read + acknowledge side of the persisted ops alerts (Documents/09 §G).
 * Any admin can view/acknowledge; AlertsService (common) owns writes.
 */
@Injectable()
export class AlertsAdminService {
  constructor(@Inject(DB) private readonly db: Kysely<Database>) {}

  async list(query: AlertsQuery): Promise<AlertsResponse> {
    let base = this.db.selectFrom("alerts");
    if (query.severity) base = base.where("severity", "=", query.severity);
    if (query.acknowledged === "true") base = base.where("acknowledged_at", "is not", null);
    if (query.acknowledged === "false") base = base.where("acknowledged_at", "is", null);

    const [items, total, unack] = await Promise.all([
      base
        .selectAll()
        .orderBy("created_at", "desc")
        .limit(query.pageSize)
        .offset((query.page - 1) * query.pageSize)
        .execute(),
      base.select((eb) => eb.fn.countAll<bigint>().as("n")).executeTakeFirstOrThrow(),
      this.db
        .selectFrom("alerts")
        .select((eb) => eb.fn.countAll<bigint>().as("n"))
        .where("acknowledged_at", "is", null)
        .executeTakeFirstOrThrow(),
    ]);

    return { items: items.map(toItem), total: Number(total.n), unacknowledged: Number(unack.n) };
  }

  /** Mark acknowledged (idempotent — the first ack wins; re-ack returns the row unchanged). */
  async acknowledge(adminId: string, id: string): Promise<AlertItem> {
    const existing = await this.db.selectFrom("alerts").selectAll().where("id", "=", id).executeTakeFirst();
    if (!existing) throw new AlertNotFoundError();
    if (existing.acknowledged_at) return toItem(existing);

    const updated = await this.db
      .updateTable("alerts")
      .set({ acknowledged_at: new Date(), acknowledged_by: adminId })
      .where("id", "=", id)
      .where("acknowledged_at", "is", null)
      .returningAll()
      .executeTakeFirst();
    return toItem(updated ?? existing);
  }
}
