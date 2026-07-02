import { Controller, Get } from "@nestjs/common";
import { Roles } from "../../common/auth/decorators";
import { RBAC } from "../admin/admin.rbac";
import { TreasuryService, type RevenueResponse, type TreasuryBalancesResponse } from "./treasury.service";

/**
 * Read-only treasury dashboards under /admin (doc-06 endpoint paths).
 * View-dashboards roles (all 7) per the RBAC matrix.
 */
@Controller("admin")
export class TreasuryController {
  constructor(private readonly treasury: TreasuryService) {}

  @Roles(...RBAC.viewDashboards)
  @Get("revenue")
  async revenue(): Promise<RevenueResponse> {
    return this.treasury.revenue();
  }

  @Roles(...RBAC.viewDashboards)
  @Get("treasury/balances")
  async balances(): Promise<TreasuryBalancesResponse> {
    return this.treasury.balances();
  }
}
