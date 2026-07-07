import { Module } from "@nestjs/common";
import { AuditModule } from "../../common/audit/audit.module";
import { LedgerModule } from "../ledger/ledger.module";
import { SettingsModule } from "../settings/settings.module";
import { KycModule } from "../kyc/kyc.module";
import { DisputesModule } from "../disputes/disputes.module";
import { WithdrawalsModule } from "../withdrawals/withdrawals.module";
import { WalletModule } from "../wallet/wallet.module";
import { AdminAuthService } from "./admin-auth.service";
import { AdminService } from "./admin.service";
import { SystemHealthService } from "./system-health.service";
import { AdminTeamService } from "./admin-team.service";
import { AdminAuthController } from "./admin-auth.controller";
import { AdminController } from "./admin.controller";

/**
 * admin — RBAC-guarded operations console (Documents/06 "admin + treasury").
 * Owns admin authentication (JWT typ=admin, TOTP mandatory) and the /admin/**
 * HTTP surface; all domain writes delegate to the owning services
 * (Kyc/Disputes/Withdrawals/Ledger). Explicit imports of the @Global modules
 * keep DI working regardless of registration order.
 */
@Module({
  imports: [AuditModule, SettingsModule, LedgerModule, KycModule, DisputesModule, WithdrawalsModule, WalletModule],
  controllers: [AdminAuthController, AdminController],
  providers: [AdminAuthService, AdminService, SystemHealthService, AdminTeamService],
  exports: [AdminAuthService, AdminService],
})
export class AdminModule {}
