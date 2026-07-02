import { Module } from "@nestjs/common";
import { AuditModule } from "../../common/audit/audit.module";
import { StorageModule } from "../../common/storage/storage.module";
import { SettingsModule } from "../settings/settings.module";
import { KycController } from "./kyc.controller";
import { KycService } from "./kyc.service";
import { KycAdminService } from "./kyc-admin.service";
import { KycRetentionJob } from "./kyc-retention.job";

/**
 * kyc — manual-review identity verification (Documents/06 "kyc").
 * KycAdminService is exported for the admin module (RBAC-guarded there);
 * KycRetentionJob is exported for the worker (needs ScheduleModule.forRoot()).
 */
@Module({
  imports: [StorageModule, AuditModule, SettingsModule],
  controllers: [KycController],
  providers: [KycService, KycAdminService, KycRetentionJob],
  exports: [KycService, KycAdminService, KycRetentionJob],
})
export class KycModule {}
