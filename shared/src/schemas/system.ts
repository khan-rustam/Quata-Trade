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
  /**
   * Email delivery health. Without this an SMTP outage is invisible: sign-up
   * still returns 201, the row just sits queued forever, and nobody finds out
   * until users complain that no code arrived. `dead` is the alarming one —
   * those rows have exhausted their retries and will NEVER be sent again.
   */
  mail: z.object({
    /** waiting for the worker's next 30s sweep — a few is normal */
    queued: z.number().int(),
    /** queued AND already failed at least once — SMTP is refusing */
    retrying: z.number().int(),
    /** past max attempts: given up on, permanently undelivered */
    dead: z.number().int(),
    /** successfully handed to SMTP in the last 24h — the "it works" signal */
    deliveredLast24h: z.number().int(),
    /** age of the oldest still-queued mail; climbing = the worker is stuck/down */
    oldestQueuedAgeSec: z.number().int().nullable(),
  }),
});
export type SystemHealthResponse = z.infer<typeof zSystemHealthResponse>;
