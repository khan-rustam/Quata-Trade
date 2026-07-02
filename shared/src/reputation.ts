import type { ReputationTier } from "./constants.js";

/**
 * Deterministic reputation tier from a trader's terminal-trade stats.
 * Display only — no money math, no LLM (Documents/01 risk rules). Thresholds are
 * monotonic: more completed trades + higher completion rate never lowers the tier.
 *
 * @param completedTrades count of COMPLETED trades (buyer or seller side)
 * @param completionRate  0..100, completed / max(1, completed+cancelled+expired) * 100
 */
export function reputationTier(completedTrades: number, completionRate: number): ReputationTier {
  if (completedTrades >= 100 && completionRate >= 98) return "GOLD";
  if (completedTrades >= 25 && completionRate >= 95) return "SILVER";
  if (completedTrades >= 5 && completionRate >= 90) return "BRONZE";
  return "NEW";
}
