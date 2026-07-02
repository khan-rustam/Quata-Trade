import { Inject, Injectable } from "@nestjs/common";
import { sql, type Kysely } from "kysely";
import { z } from "zod";
import { DB } from "../../db/database.module";
import type { Database } from "../../db/types";

/** Fee revenue on the treasury account — non-negative amount strings. */
export const zRevenueResponse = z.object({
  today: z.string().regex(/^\d+$/),
  month: z.string().regex(/^\d+$/),
  lifetime: z.string().regex(/^\d+$/),
});
export type RevenueResponse = z.infer<typeof zRevenueResponse>;

/** Platform account positions. external may legitimately be negative. */
export const zTreasuryBalancesResponse = z.object({
  treasury: z.string().regex(/^-?\d+$/),
  pendingSweep: z.string().regex(/^-?\d+$/),
  external: z.string().regex(/^-?\d+$/),
});
export type TreasuryBalancesResponse = z.infer<typeof zTreasuryBalancesResponse>;

/**
 * Journal reasons whose treasury-credit legs are fee revenue.
 * escrow_release_buyer is included: EscrowService books the trade fee as a
 * treasury leg INSIDE that journal (the standalone escrow_release_fee reason
 * is reserved but currently unused) — see Deviations Log.
 */
const REVENUE_REASONS = ["escrow_release_buyer", "escrow_release_fee", "withdrawal_fee"] as const;

/**
 * treasury — read-only revenue/position dashboards (Documents/06
 * "admin + treasury"). NEVER writes anything: balances are ledger-derived,
 * revenue is a SUM over ledger_entries. All amounts leave as strings.
 */
@Injectable()
export class TreasuryService {
  constructor(@Inject(DB) private readonly db: Kysely<Database>) {}

  /** Fees earned today (UTC), this month (UTC) and lifetime. */
  async revenue(): Promise<RevenueResponse> {
    const now = new Date();
    const startOfDay = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    const startOfMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));

    const row = await this.db
      .selectFrom("ledger_entries as le")
      .innerJoin("journal_entries as je", "je.id", "le.journal_id")
      .innerJoin("accounts as a", "a.id", "le.account_id")
      .where("a.kind", "=", "platform_treasury")
      .where("je.reason", "in", [...REVENUE_REASONS])
      .where("le.amount", ">", 0n)
      .select([
        sql<bigint>`COALESCE(SUM(le.amount) FILTER (WHERE le.created_at >= ${startOfDay}), 0)::int8`.as("today"),
        sql<bigint>`COALESCE(SUM(le.amount) FILTER (WHERE le.created_at >= ${startOfMonth}), 0)::int8`.as("month"),
        sql<bigint>`COALESCE(SUM(le.amount), 0)::int8`.as("lifetime"),
      ])
      .executeTakeFirstOrThrow();

    return zRevenueResponse.parse({
      today: row.today.toString(),
      month: row.month.toString(),
      lifetime: row.lifetime.toString(),
    });
  }

  /** Cached platform positions straight from account_balances (all assets summed). */
  async balances(): Promise<TreasuryBalancesResponse> {
    const rows = await this.db
      .selectFrom("account_balances")
      .select("kind")
      .select(sql<bigint>`COALESCE(SUM(balance), 0)::int8`.as("total"))
      .where("kind", "in", ["platform_treasury", "platform_pending_sweep", "external"])
      .groupBy("kind")
      .execute();

    const byKind = (kind: "platform_treasury" | "platform_pending_sweep" | "external"): bigint =>
      rows.find((r) => r.kind === kind)?.total ?? 0n;

    return zTreasuryBalancesResponse.parse({
      treasury: byKind("platform_treasury").toString(),
      pendingSweep: byKind("platform_pending_sweep").toString(),
      external: byKind("external").toString(),
    });
  }
}
