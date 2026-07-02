import { Module } from "@nestjs/common";
import { TreasuryService } from "./treasury.service";
import { TreasuryController } from "./treasury.controller";

/**
 * treasury — read-only revenue & platform-position reads for the admin
 * console. No providers beyond the service; it never writes. RBAC enforced
 * at the controller via the shared matrix (admin.rbac.ts).
 */
@Module({
  controllers: [TreasuryController],
  providers: [TreasuryService],
  exports: [TreasuryService],
})
export class TreasuryModule {}
