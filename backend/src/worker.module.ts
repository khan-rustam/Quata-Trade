import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { ScheduleModule } from "@nestjs/schedule";
import { LoggerModule } from "nestjs-pino";
import { validateEnv } from "./config/env";
import { DatabaseModule } from "./db/database.module";
import { AuditModule } from "./common/audit/audit.module";
import { AlertsModule } from "./common/alerts/alerts.module";
import { RedisModule } from "./common/redis/redis.module";
import { StorageModule } from "./common/storage/storage.module";
import { SettingsModule } from "./modules/settings/settings.module";
import { PromoModule } from "./modules/promo/promo.module";
import { LedgerModule } from "./modules/ledger/ledger.module";
import { EscrowModule } from "./modules/escrow/escrow.module";
import { DepositsModule } from "./modules/deposits/deposits.module";
import { ScreeningModule } from "./modules/screening/screening.module";
import { SignerModule } from "./modules/signer/signer.module";
import { NotifyModule } from "./modules/notify/notify.module";
import { KycModule } from "./modules/kyc/kyc.module";
import { TradeTimeoutJob } from "./jobs/trade-timeout.job";
import { ReconciliationJob } from "./jobs/reconciliation.job";
import { OutboxRelayJob } from "./jobs/outbox-relay.job";
import { EmailSendJob } from "./jobs/email-send.job";

/**
 * Worker: ALL scheduled money/ops jobs live in this process (the API has no
 * ScheduleModule, so @Cron decorators are inert there):
 * - TradeTimeoutJob (escrow expiry refunds)
 * - ReconciliationJob (cache vs SUM; mismatch pauses withdrawals)
 * - DepositScannerService + DepositConfirmationService (DepositsModule)
 * - WithdrawalPipelineService (SignerModule: APPROVED→SIGNING→BROADCAST→CONFIRMED)
 * - OutboxRelayJob (domain events → NotifyService)
 * - KycRetentionJob (data-protection purge, KycModule)
 */
@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate: validateEnv, envFilePath: [".env", "../.env"] }),
    LoggerModule.forRoot({ pinoHttp: { level: process.env.LOG_LEVEL ?? "info" } }),
    ScheduleModule.forRoot(),
    DatabaseModule,
    AuditModule,
    AlertsModule,
    RedisModule,
    StorageModule,
    SettingsModule,
    PromoModule,
    LedgerModule,
    EscrowModule,
    DepositsModule,
    ScreeningModule,
    SignerModule,
    NotifyModule,
    KycModule,
  ],
  providers: [TradeTimeoutJob, ReconciliationJob, OutboxRelayJob, EmailSendJob],
})
export class WorkerModule {}
