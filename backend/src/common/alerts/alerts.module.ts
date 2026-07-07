import { Global, Module } from "@nestjs/common";
import { NotifyModule } from "../../modules/notify/notify.module";
import { AlertsService } from "./alerts.service";

/**
 * Ops/security alerting — @Global so any module (notify, jobs) can inject it.
 * Imports NotifyModule to reuse its exported MAILER for critical-alert emails
 * (NotifyModule imports nothing, so there is no dependency cycle).
 */
@Global()
@Module({
  imports: [NotifyModule],
  providers: [AlertsService],
  exports: [AlertsService],
})
export class AlertsModule {}
