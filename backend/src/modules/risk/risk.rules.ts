/**
 * risk rules — PURE, deterministic, config-driven (Documents/06 "risk").
 * NO I/O, NO LLM calls, ever. Every triggered rule is recorded in an
 * explainable `flags` object so an admin can see exactly why a score fired.
 * RiskService gathers the inputs (Redis/DB) and calls computeScore().
 */

export type RiskKind = "login" | "trade_open" | "withdrawal";

export interface RiskFlagDetail {
  /** points this rule contributed */
  points: number;
  /** human-readable, admin-facing explanation — never secrets/PII */
  detail: string;
}

/** One key per triggered rule. Persisted as risk_events.flags (jsonb). */
export type RiskFlags = Record<string, RiskFlagDetail>;

export interface RiskScore {
  /** 0–100 */
  score: number;
  flags: RiskFlags;
}

export interface RiskInputs {
  kind: RiskKind;
  /** events of this kind by this user in the current hour, INCLUDING this one */
  eventsThisHour: number;
  /** event amount in smallest units; null for login */
  amount: bigint | null;
  /** KYC tier limit the amount is judged against; null when not applicable */
  tierLimit: bigint | null;
  /** milliseconds since the account was created */
  accountAgeMs: number;
  /** a device fingerprint was presented and has never been seen in sessions */
  isNewDevice: boolean;
}

export interface RiskConfig {
  /** flag when eventsThisHour is STRICTLY greater than this */
  velocityPerHour: Record<RiskKind, number>;
  velocityPoints: number;
  /** flag when amount is STRICTLY greater than this percentage of tierLimit */
  nearLimitPercent: number;
  nearLimitPoints: number;
  youngAccountMs: number;
  youngAccountPoints: number;
  newDevicePoints: number;
  escalateAt: number;
  freezeAt: number;
}

/** Tunable thresholds (Documents/06: config-driven; doc values are the defaults). */
export const DEFAULT_RISK_CONFIG: RiskConfig = {
  velocityPerHour: { login: 10, trade_open: 10, withdrawal: 3 },
  velocityPoints: 30,
  nearLimitPercent: 80,
  nearLimitPoints: 25,
  youngAccountMs: 24 * 60 * 60 * 1000,
  youngAccountPoints: 20,
  newDevicePoints: 15,
  escalateAt: 70,
  freezeAt: 90,
};

/** Deterministic score 0–100 from explainable rules. Pure — unit-tested exhaustively. */
export function computeScore(inputs: RiskInputs, config: RiskConfig = DEFAULT_RISK_CONFIG): RiskScore {
  const flags: RiskFlags = {};
  let score = 0;
  const trigger = (rule: string, points: number, detail: string): void => {
    flags[rule] = { points, detail };
    score += points;
  };

  const velocityLimit = config.velocityPerHour[inputs.kind];
  if (inputs.eventsThisHour > velocityLimit) {
    trigger(
      "velocity_exceeded",
      config.velocityPoints,
      `${inputs.eventsThisHour} ${inputs.kind} events this hour (limit ${velocityLimit})`,
    );
  }

  if (inputs.amount !== null && inputs.tierLimit !== null) {
    // amount > tierLimit * percent/100 — exact bigint math, no floats ever
    if (inputs.amount * 100n > inputs.tierLimit * BigInt(config.nearLimitPercent)) {
      trigger(
        "near_tier_limit",
        config.nearLimitPoints,
        `amount exceeds ${config.nearLimitPercent}% of the KYC tier limit`,
      );
    }
  }

  if (inputs.accountAgeMs < config.youngAccountMs) {
    trigger("new_account", config.youngAccountPoints, "account is younger than 24 hours");
  }

  if (inputs.isNewDevice) {
    trigger("new_device", config.newDevicePoints, "device fingerprint not seen in any prior session");
  }

  return { score: Math.min(100, score), flags };
}

export type RiskAction = "none" | "escalate" | "freeze";

/** score >= 90 → auto-freeze; >= 70 → escalate for admin review; else none. */
export function actionForScore(score: number, config: RiskConfig = DEFAULT_RISK_CONFIG): RiskAction {
  if (score >= config.freezeAt) return "freeze";
  if (score >= config.escalateAt) return "escalate";
  return "none";
}
