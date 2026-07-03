import { Global, Module } from "@nestjs/common";
import { ScreeningService } from "./screening.service";
import { ScreeningController } from "./screening.controller";

/**
 * AML / sanctions / wallet-blacklist screening — @Global so the money paths
 * (withdrawals in the API, deposit confirmation in the worker) can inject the
 * service without import wiring. The controller only maps under the HTTP app
 * (worker uses an application context, so it is inert there).
 */
@Global()
@Module({
  controllers: [ScreeningController],
  providers: [ScreeningService],
  exports: [ScreeningService],
})
export class ScreeningModule {}
