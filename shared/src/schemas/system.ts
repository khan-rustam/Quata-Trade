import { z } from "zod";

/**
 * System-health snapshot for the admin monitoring page (in-app "Layer A").
 * Read-only; all fields come from Postgres + Redis + settings in the API
 * process. True outage detection ("the site is down") needs an EXTERNAL
 * watchdog — this page cannot report on itself when the app is down.
 */
export const zServiceStatus = z.enum(["up", "down"]);
export type ServiceStatus = z.infer<typeof zServiceStatus>;

export const zSystemHealthResponse = z.object({
  checkedAt: z.string(), // ISO
  services: z.object({
    api: zServiceStatus,
    db: zServiceStatus,
    redis: zServiceStatus,
  }),
  killSwitches: z.object({
    withdrawalsPaused: z.boolean(),
    tradesPaused: z.boolean(),
  }),
  outbox: z.object({
    pending: z.number().int(),
    retrying: z.number().int(),
    oldestPendingAgeSec: z.number().int().nullable(),
  }),
  withdrawals: z.object({
    stuckBroadcast: z.number().int(),
    riskHold: z.number().int(),
    pendingApproval: z.number().int(),
  }),
  workload: z.object({
    openDisputes: z.number().int(),
    pendingKyc: z.number().int(),
  }),
});
export type SystemHealthResponse = z.infer<typeof zSystemHealthResponse>;
