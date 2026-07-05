import { Injectable } from "@nestjs/common";
import type { PromoCampaignsValue } from "@quatatrade/shared";
import { SettingsService } from "../settings/settings.service";

export type PromoFeeType = "trading" | "deposit" | "withdrawal";

/**
 * Pure resolver: the effective promo fee-bps for the MOST GENEROUS active campaign
 * matching (feeType, country, now), or null when no campaign applies. A campaign is
 * active when now ∈ [startsAt, endsAt) and its country is null (all) or the caller's.
 * Exported for unit tests — no I/O, no clock.
 */
export function resolvePromoBps(
  campaigns: PromoCampaignsValue,
  feeType: PromoFeeType,
  country: string,
  now: Date,
): number | null {
  const nowMs = now.getTime();
  const matches = campaigns.filter(
    (c) =>
      c.feeType === feeType &&
      (c.country === null || c.country === country) &&
      new Date(c.startsAt).getTime() <= nowMs &&
      nowMs < new Date(c.endsAt).getTime(),
  );
  return matches.length === 0 ? null : Math.min(...matches.map((c) => c.discountBps));
}

/**
 * Promotional fee campaigns (fee-engine spec). Reads the admin-managed promo_campaigns
 * settings and resolves the effective fee for a market at a point in time. Trading
 * campaigns OVERRIDE the fee bps; deposit/withdrawal campaigns WAIVE the platform fee.
 */
@Injectable()
export class PromoService {
  constructor(private readonly settings: SettingsService) {}

  /** Effective trading fee bps for a market now, or null to use the normal rail fee. */
  async tradingBps(country: string, now: Date = new Date()): Promise<number | null> {
    return resolvePromoBps(await this.settings.promoCampaigns(), "trading", country, now);
  }

  /** True when a deposit-fee campaign is active for the market → waive the platform fee. */
  async depositWaived(country: string, now: Date = new Date()): Promise<boolean> {
    return resolvePromoBps(await this.settings.promoCampaigns(), "deposit", country, now) !== null;
  }

  /** True when a withdrawal-fee campaign is active for the market → waive the platform fee. */
  async withdrawalWaived(country: string, now: Date = new Date()): Promise<boolean> {
    return resolvePromoBps(await this.settings.promoCampaigns(), "withdrawal", country, now) !== null;
  }
}
