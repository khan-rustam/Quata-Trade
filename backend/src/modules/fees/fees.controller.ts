import { Controller, Get } from "@nestjs/common";
import type { AssetCode, FeeSchedule } from "@quatatrade/shared";
import { Public } from "../../common/auth/decorators";
import { SettingsService } from "../settings/settings.service";

const ASSET: AssetCode = "USDT_TRC20";

/**
 * Public fee schedule (UI audit).
 *
 * The marketing /fees page used to hardcode its numbers in the translation
 * catalogue: it advertised a 0 USDT withdrawal fee while `withdrawal_fee` was
 * configured at 1 USDT and the withdrawal path charged it. Publishing the LIVE
 * configured values means the page cannot state a fee the platform does not
 * apply, and an admin changing a fee in the console updates the public page
 * automatically instead of leaving the two to drift.
 *
 * Read-only, unauthenticated, and deliberately limited to the fees a prospective
 * user is entitled to know before signing up — no limits, ceilings or internal
 * thresholds.
 */
@Controller("fees")
export class FeesController {
  constructor(private readonly settings: SettingsService) {}

  @Public()
  @Get("schedule")
  async schedule(): Promise<FeeSchedule> {
    const [deposit, withdrawal, tradingFeeBps, sellerFeeBps] = await Promise.all([
      this.settings.depositPolicy(),
      this.settings.withdrawalFee(ASSET),
      this.settings.allFeeBps(),
      this.settings.sellerFeeBps(),
    ]);
    return {
      depositFee: { fixed: deposit.feeFixed.toString(), bps: deposit.feeBps },
      withdrawalFee: { fixed: withdrawal.fixed.toString(), bps: withdrawal.bps },
      tradingFeeBps,
      sellerFeeBps,
      minDeposit: deposit.minAmount.toString(),
    };
  }
}
