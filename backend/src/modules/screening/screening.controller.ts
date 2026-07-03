import { Body, Controller, Delete, Get, HttpCode, Param, Post } from "@nestjs/common";
import {
  zBlockAddressRequest,
  zUuid,
  type BlockAddressRequest,
  type BlockedAddress,
  type Ok,
} from "@quatatrade/shared";
import { ZodPipe } from "../../common/zod.pipe";
import { CurrentAdminId, Roles } from "../../common/auth/decorators";
import { RBAC } from "../admin/admin.rbac";
import { ScreeningService } from "./screening.service";

/**
 * Compliance management of the AML / sanctions blocklist. SUPER + COMPLIANCE
 * only (same roles as KYC review). Enforcement lives in the money paths
 * (withdrawals, deposits) — this controller only curates the list.
 */
@Controller("admin/screening")
export class ScreeningController {
  constructor(private readonly screening: ScreeningService) {}

  @Roles(...RBAC.kycReview)
  @Get("addresses")
  async list(): Promise<{ addresses: BlockedAddress[] }> {
    return { addresses: await this.screening.listBlocked() };
  }

  @Roles(...RBAC.kycReview)
  @Post("addresses")
  block(
    @CurrentAdminId() adminId: string,
    @Body(new ZodPipe(zBlockAddressRequest)) dto: BlockAddressRequest,
  ): Promise<BlockedAddress> {
    return this.screening.block(dto, adminId);
  }

  @Roles(...RBAC.kycReview)
  @Delete("addresses/:id")
  @HttpCode(200)
  async unblock(@Param("id", new ZodPipe(zUuid)) id: string): Promise<Ok> {
    await this.screening.unblock(id);
    return { ok: true };
  }
}
