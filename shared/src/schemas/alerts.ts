import { z } from "zod";
import { zUuid } from "./common.js";

/** Ops/security alert severities (mirrors AlertsService). */
export const zAlertSeverity = z.enum(["info", "warning", "critical"]);
export type AlertSeverity = z.infer<typeof zAlertSeverity>;

/** A persisted alert shown on the admin Alerts page. Named *Item to avoid clashing with the UI Alert. */
export const zAlertItem = z.object({
  id: zUuid,
  severity: zAlertSeverity,
  eventType: z.string(),
  title: z.string(),
  metadata: z.record(z.unknown()).nullable(),
  acknowledgedAt: z.string().nullable(),
  acknowledgedBy: zUuid.nullable(),
  createdAt: z.string(),
});
export type AlertItem = z.infer<typeof zAlertItem>;

export const zAlertsResponse = z.object({
  items: z.array(zAlertItem),
  total: z.number().int(),
  unacknowledged: z.number().int(),
});
export type AlertsResponse = z.infer<typeof zAlertsResponse>;

export const zAlertsQuery = z.object({
  severity: zAlertSeverity.optional(),
  acknowledged: z.enum(["true", "false"]).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(50),
});
export type AlertsQuery = z.infer<typeof zAlertsQuery>;
