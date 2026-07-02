import type { Kysely } from "kysely";
import { zOffer, type Offer } from "@quatatrade/shared";
import type { Database } from "../../db/types";
import { displayNameOf } from "../trades/trades.mapper";
import type { OfferRow } from "./offers.service";

/**
 * offers.mapper — DB rows → shared zOffer shape. bigint → decimal string,
 * Date → ISO string. The trader block aggregates the owner's terminal-trade
 * counts: completionRate = completed / max(1, completed+cancelled+expired) * 100,
 * rounded — display only, never money math. Dev re-parses with zOffer.
 */

const VALIDATE_OUTPUT = process.env.NODE_ENV !== "production";

export interface TraderUserRow {
  id: string;
  first_name: string | null;
  email: string;
  reputation_score: number;
  kyc_tier: number;
}

export interface TraderStats {
  completed: number;
  cancelled: number;
  expired: number;
}

export interface TraderContext {
  user: TraderUserRow;
  stats: TraderStats;
}

const TERMINAL_STATUSES = ["COMPLETED", "CANCELLED", "EXPIRED"] as const;

function emptyStats(): TraderStats {
  return { completed: 0, cancelled: 0, expired: 0 };
}

/**
 * Batch-load trader blocks for a set of owner user ids (two grouped COUNT
 * queries — no N+1, no raw row scans). A user's trades count whether they
 * acted as seller or buyer (buyer ≠ seller is a DB CHECK, so no double count).
 */
export async function fetchTraders(
  db: Kysely<Database>,
  userIds: readonly string[],
): Promise<Map<string, TraderContext>> {
  const unique = [...new Set(userIds)];
  if (unique.length === 0) return new Map();

  const [users, asSeller, asBuyer] = await Promise.all([
    db
      .selectFrom("users")
      .select(["id", "first_name", "email", "reputation_score", "kyc_tier"])
      .where("id", "in", unique)
      .execute(),
    db
      .selectFrom("trades")
      .select(["seller_id as uid", "status"])
      .select((eb) => eb.fn.countAll<bigint>().as("n"))
      .where("seller_id", "in", unique)
      .where("status", "in", [...TERMINAL_STATUSES])
      .groupBy(["seller_id", "status"])
      .execute(),
    db
      .selectFrom("trades")
      .select(["buyer_id as uid", "status"])
      .select((eb) => eb.fn.countAll<bigint>().as("n"))
      .where("buyer_id", "in", unique)
      .where("status", "in", [...TERMINAL_STATUSES])
      .groupBy(["buyer_id", "status"])
      .execute(),
  ]);

  const statsByUser = new Map<string, TraderStats>(unique.map((id) => [id, emptyStats()]));
  for (const row of [...asSeller, ...asBuyer]) {
    const stats = statsByUser.get(row.uid);
    if (!stats) continue;
    const n = Number(row.n);
    if (row.status === "COMPLETED") stats.completed += n;
    else if (row.status === "CANCELLED") stats.cancelled += n;
    else if (row.status === "EXPIRED") stats.expired += n;
  }

  return new Map(users.map((u) => [u.id, { user: u, stats: statsByUser.get(u.id) ?? emptyStats() }]));
}

/** Map one offer row + its owner's trader block to the shared zOffer shape. */
export function mapOffer(row: OfferRow, trader: TraderContext): Offer {
  const { user, stats } = trader;
  const terminalTotal = Math.max(1, stats.completed + stats.cancelled + stats.expired);
  const offer: Offer = {
    id: row.id,
    side: row.side,
    asset: row.asset,
    priceXafPerUnit: row.price_xaf_per_unit.toString(),
    minTrade: row.min_trade.toString(),
    maxTrade: row.max_trade.toString(),
    remaining: row.remaining.toString(),
    paymentMethods: row.payment_methods,
    terms: row.terms,
    status: row.status,
    trader: {
      id: user.id,
      displayName: displayNameOf(user.first_name, user.email),
      reputationScore: user.reputation_score,
      completedTrades: stats.completed,
      completionRate: Math.round((stats.completed / terminalTotal) * 100),
      kycTier: user.kyc_tier,
    },
    createdAt: row.created_at.toISOString(),
  };
  return VALIDATE_OUTPUT ? zOffer.parse(offer) : offer;
}
