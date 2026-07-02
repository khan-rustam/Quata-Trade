import { Module } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { Env } from "../../config/env";
import { LedgerModule } from "../ledger/ledger.module";
import { DepositConfirmationService } from "./deposit-confirmation.service";
import { DepositScannerService } from "./deposit-scanner.service";
import { DEPOSITS_CONFIG, depositsConfigFromEnv } from "./deposits.config";
import { HttpTronGridClient, TRONGRID_CLIENT } from "./trongrid.client";

/**
 * deposits — NO public write endpoints (Documents/06). The two cron services
 * run in the WORKER process: import DepositsModule in worker.module (it has
 * ScheduleModule.forRoot()) — the API process must not import it.
 */
@Module({
  imports: [LedgerModule],
  providers: [
    {
      provide: DEPOSITS_CONFIG,
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>) => depositsConfigFromEnv(config),
    },
    { provide: TRONGRID_CLIENT, useClass: HttpTronGridClient },
    DepositScannerService,
    DepositConfirmationService,
  ],
  exports: [DepositScannerService, DepositConfirmationService],
})
export class DepositsModule {}
