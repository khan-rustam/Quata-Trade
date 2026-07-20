import { Module } from "@nestjs/common";
import { AuditModule } from "../../common/audit/audit.module";
import { AdminModule } from "../admin/admin.module";
import { UpdatesController } from "./updates.controller";
import { ReleasesAdminController } from "./releases.admin.controller";
import { UpdatesService } from "./updates.service";

/**
 * Self-hosted update management. Public read endpoints (`/updates/*`) tell any
 * client what the current release is and whether its build is still supported;
 * the admin controller publishes/rolls back releases (AdminModule provides the
 * TOTP step-up service). One-way dependency: updates → admin.
 */
@Module({
  imports: [AuditModule, AdminModule],
  controllers: [UpdatesController, ReleasesAdminController],
  providers: [UpdatesService],
  exports: [UpdatesService],
})
export class UpdatesModule {}
