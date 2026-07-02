import { Module } from "@nestjs/common";
import { LedgerModule } from "../ledger/ledger.module";
import { EscrowModule } from "../escrow/escrow.module";
import { AuditModule } from "../../common/audit/audit.module";
import { StorageModule } from "../../common/storage/storage.module";
import { DisputesService } from "./disputes.service";
import { DisputesAdminService } from "./disputes-admin.service";
import { DisputesController } from "./disputes.controller";

/**
 * disputes — freeze via escrow.markDisputed, resolve via escrow.resolveDispute.
 * This module NEVER writes ledger tables or trades.status itself.
 * DisputesAdminService has no HTTP — the admin module wraps it with RBAC.
 */
@Module({
  imports: [LedgerModule, EscrowModule, AuditModule, StorageModule],
  controllers: [DisputesController],
  providers: [DisputesService, DisputesAdminService],
  exports: [DisputesService, DisputesAdminService],
})
export class DisputesModule {}
