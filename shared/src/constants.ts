/**
 * Canonical enums & platform constants.
 * These mirror the PostgreSQL enums in backend migrations 1:1 —
 * change here means a migration + a Deviations Log entry.
 */

export const ASSET_CODES = ["USDT_TRC20"] as const;
export type AssetCode = (typeof ASSET_CODES)[number];

/** USDT-TRC20 has 6 decimals: 1 USDT = 1_000_000 smallest units. */
export const ASSET_DECIMALS: Record<AssetCode, number> = {
  USDT_TRC20: 6,
};

export const ACCOUNT_KINDS = [
  "user_available",
  "user_escrow",
  "platform_treasury",
  "platform_hot",
  "platform_pending_sweep",
  "external",
] as const;
export type AccountKind = (typeof ACCOUNT_KINDS)[number];

export const ENTRY_REASONS = [
  "deposit_credit",
  "withdrawal_debit",
  "withdrawal_fee",
  "escrow_lock",
  "escrow_release_buyer",
  "escrow_release_fee",
  "escrow_refund",
  "internal_transfer",
  "adjustment",
] as const;
export type EntryReason = (typeof ENTRY_REASONS)[number];

export const TRADE_STATUSES = [
  "OPENED",
  "ESCROW_LOCKED",
  "PAYMENT_SUBMITTED",
  "COMPLETED",
  "CANCELLED",
  "EXPIRED",
  "DISPUTED",
  "RESOLVED_RELEASE",
  "RESOLVED_REFUND",
] as const;
export type TradeStatus = (typeof TRADE_STATUSES)[number];

export const OFFER_STATUSES = ["ACTIVE", "PAUSED", "EXHAUSTED", "DELETED"] as const;
export type OfferStatus = (typeof OFFER_STATUSES)[number];

export const OFFER_SIDES = ["SELL", "BUY"] as const;
export type OfferSide = (typeof OFFER_SIDES)[number];

export const PAYMENT_METHODS = ["QUATAPAY", "MTN_MOMO", "ORANGE_MONEY"] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

/**
 * Reputation tier — DERIVED for display from terminal-trade stats (see
 * reputation.ts). NOT a PG enum and never stored; computed deterministically.
 */
export const REPUTATION_TIERS = ["NEW", "BRONZE", "SILVER", "GOLD"] as const;
export type ReputationTier = (typeof REPUTATION_TIERS)[number];

/**
 * Avatar styles a user may pick (all DiceBear, rendered as SVG). App-level
 * constraint validated by zod — `avatar_style` is a plain text column, not a PG enum.
 */
export const AVATAR_STYLES = [
  "notionists",
  "adventurer",
  "avataaars",
  "lorelei",
  "micah",
  "open-peeps",
  "thumbs",
  "bottts",
] as const;
export type AvatarStyle = (typeof AVATAR_STYLES)[number];

export const KYC_STATUSES = ["NONE", "PENDING", "APPROVED", "REJECTED", "RESUBMIT"] as const;
export type KycStatus = (typeof KYC_STATUSES)[number];

export const WITHDRAWAL_STATUSES = [
  "REQUESTED",
  "RISK_HOLD",
  "PENDING_APPROVAL",
  "APPROVED",
  "SIGNING",
  "BROADCAST",
  "CONFIRMED",
  "REJECTED",
  "FAILED",
] as const;
export type WithdrawalStatus = (typeof WITHDRAWAL_STATUSES)[number];

export const DEPOSIT_STATUSES = ["SEEN", "CONFIRMING", "CREDITED", "ORPHANED", "IGNORED_DUST"] as const;
export type DepositStatus = (typeof DEPOSIT_STATUSES)[number];

export const DISPUTE_STATUSES = ["OPEN", "AWAITING_EVIDENCE", "UNDER_REVIEW", "RESOLVED"] as const;
export type DisputeStatus = (typeof DISPUTE_STATUSES)[number];

export const DISPUTE_RESOLUTIONS = ["RELEASE_TO_BUYER", "REFUND_TO_SELLER"] as const;
export type DisputeResolution = (typeof DISPUTE_RESOLUTIONS)[number];

export const ADMIN_ROLES = [
  "SUPER_ADMIN",
  "FINANCE_ADMIN",
  "COMPLIANCE_ADMIN",
  "SUPPORT_ADMIN",
  "MODERATOR",
  "AUDITOR",
  "ANALYST",
] as const;
export type AdminRole = (typeof ADMIN_ROLES)[number];

export const USER_STATUSES = ["active", "frozen", "suspended", "closed"] as const;
export type UserStatus = (typeof USER_STATUSES)[number];

/** Trading fee in basis points per payment method (0.3% / 0.5% / 0.5%). */
export const FEE_BPS: Record<PaymentMethod, number> = {
  QUATAPAY: 30,
  MTN_MOMO: 50,
  ORANGE_MONEY: 50,
};

/** Default payment window for a trade before auto-expiry. */
export const TRADE_PAYMENT_WINDOW_MINUTES = 30;

/**
 * KYC tier limits in smallest units of USDT (defaults; live values come from
 * the `settings` table). Tier 0 = registered, no KYC.
 */
export const KYC_TIER_LIMITS = {
  0: { maxTrade: 0n, dailyWithdrawal: 0n },
  1: { maxTrade: 100_000_000n, dailyWithdrawal: 100_000_000n }, // 100 USDT
  2: { maxTrade: 1_000_000_000n, dailyWithdrawal: 2_000_000_000n }, // 1k / 2k USDT
  3: { maxTrade: 5_000_000_000n, dailyWithdrawal: 10_000_000_000n }, // 5k / 10k USDT
} as const;

/** Withdrawals at or above this amount require a second admin approver (500 USDT). */
export const DUAL_APPROVAL_THRESHOLD = 500_000_000n;
