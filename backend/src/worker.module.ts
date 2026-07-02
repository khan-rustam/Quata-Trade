import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { ScheduleModule } from "@nestjs/schedule";
import { LoggerModule } from "nestjs-pino";
import { validateEnv } from "./config/env";
import { DatabaseModule } from "./db/database.module";
import { SettingsModule } from "./modules/settings/settings.module";
import { LedgerModule } from "./modules/ledger/ledger.module";
import { EscrowModule } from "./modules/escrow/escrow.module";
import { TradeTimeoutJob } from "./jobs/trade-timeout.job";
import { ReconciliationJob } from "./jobs/reconciliation.job";

/**
 * Worker: scheduled money jobs. BullMQ processors (deposit scanner,
 * withdrawal pipeline, notifications) register here as they are built.
 */
@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate: validateEnv, envFilePath: [".env", "../.env"] }),
    LoggerModule.forRoot({ pinoHttp: { level: process.env.LOG_LEVEL ?? "info" } }),
    ScheduleModule.forRoot(),
    DatabaseModule,
    SettingsModule,
    LedgerModule,
    EscrowModule,
  ],
  providers: [TradeTimeoutJob, ReconciliationJob],
})
export class WorkerModule {}
