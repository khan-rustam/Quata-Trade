/**
 * Deterministic withdrawal risk scoring (Documents/06 "risk": rules only,
 * NO LLM, explainable flags stored on the row). Pure function — no I/O.
 * Score >= RISK_HOLD_SCORE parks the withdrawal in RISK_HOLD for manual review.
 */

export const RISK_HOLD_SCORE = 70;

export interface WithdrawalRiskInput {
  amount: bigint;
  /** the user's KYC-tier daily withdrawal limit (smallest units) */
  tierDailyLimit: bigint;
  /** prior withdrawals for this user that were NOT rejected/failed (all time) */
  priorWithdrawalCount: number;
  /** withdrawal attempts (any status) in the trailing 24 hours */
  attemptsLast24h: number;
}

export interface WithdrawalRiskResult {
  score: number;
  flags: Record<string, unknown>;
}

export function scoreWithdrawalRisk(input: WithdrawalRiskInput): WithdrawalRiskResult {
  const flags: string[] = [];
  const components: Record<string, number> = {};
  let score = 0;

  // 1. Amount relative to the user's tier daily limit.
  const pctOfTierLimit =
    input.tierDailyLimit > 0n ? Number((input.amount * 100n) / input.tierDailyLimit) : 100;
  const ratioScore = pctOfTierLimit >= 80 ? 40 : pctOfTierLimit >= 50 ? 25 : pctOfTierLimit >= 25 ? 10 : 0;
  if (ratioScore > 0) {
    flags.push(`amount_${pctOfTierLimit}pct_of_tier_daily_limit`);
    components.tier_ratio = ratioScore;
    score += ratioScore;
  }

  // 2. First withdrawal ever is inherently riskier.
  if (input.priorWithdrawalCount === 0) {
    flags.push("first_withdrawal");
    components.first_withdrawal = 30;
    score += 30;
  }

  // 3. Velocity: many attempts inside 24h.
  const velocityScore = Math.min(input.attemptsLast24h, 4) * 10;
  if (velocityScore > 0) {
    flags.push(`velocity_24h_${input.attemptsLast24h}`);
    components.velocity = velocityScore;
    score += velocityScore;
  }

  return { score: Math.min(score, 100), flags: { flags, components } };
}
