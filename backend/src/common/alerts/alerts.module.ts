import { Global, Module } from "@nestjs/common";
import { AlertsService } from "./alerts.service";

/** Ops/security alerting — @Global so any module (notify, jobs) can inject it. */
@Global()
@Module({
  providers: [AlertsService],
  exports: [AlertsService],
})
export class AlertsModule {}
