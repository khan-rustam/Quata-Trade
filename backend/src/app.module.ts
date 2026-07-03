import { Module } from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { JwtModule } from "@nestjs/jwt";
import { ThrottlerGuard, ThrottlerModule } from "@nestjs/throttler";
import { LoggerModule } from "nestjs-pino";
import { validateEnv, type Env } from "./config/env";
import { DatabaseModule } from "./db/database.module";
import { JwtAuthGuard } from "./common/auth/jwt-auth.guard";
import { RolesGuard } from "./common/auth/roles.guard";
import { AuditModule } from "./common/audit/audit.module";
import { AlertsModule } from "./common/alerts/alerts.module";
import { RedisModule } from "./common/redis/redis.module";
import { StorageModule } from "./common/storage/storage.module";
import { SettingsModule } from "./modules/settings/settings.module";
import { HealthModule } from "./modules/health/health.module";
import { FeesModule } from "./modules/fees/fees.module";
import { LedgerModule } from "./modules/ledger/ledger.module";
import { EscrowModule } from "./modules/escrow/escrow.module";
import { OffersModule } from "./modules/offers/offers.module";
import { TradesModule } from "./modules/trades/trades.module";
import { AuthModule } from "./modules/auth/auth.module";
import { UsersModule } from "./modules/users/users.module";
import { WalletModule } from "./modules/wallet/wallet.module";
import { KycModule } from "./modules/kyc/kyc.module";
import { WithdrawalsModule } from "./modules/withdrawals/withdrawals.module";
import { DisputesModule } from "./modules/disputes/disputes.module";
import { ChatModule } from "./modules/chat/chat.module";
import { RiskModule } from "./modules/risk/risk.module";
import { ScreeningModule } from "./modules/screening/screening.module";
import { NotifyModule } from "./modules/notify/notify.module";
import { AdminModule } from "./modules/admin/admin.module";
import { TreasuryModule } from "./modules/treasury/treasury.module";
import { ContentModule } from "./modules/content/content.module";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate: validateEnv,
      envFilePath: [".env", "../.env"],
    }),
    LoggerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>) => ({
        pinoHttp: {
          level: config.get("LOG_LEVEL", { infer: true }),
          transport:
            config.get("NODE_ENV", { infer: true }) === "development"
              ? { target: "pino-pretty", options: { singleLine: true } }
              : undefined,
          genReqId: (req) => (req.headers["x-request-id"] as string | undefined) ?? crypto.randomUUID(),
          redact: {
            paths: [
              "req.headers.authorization",
              "req.headers.cookie",
              "res.headers['set-cookie']",
              "*.password",
              "*.pin",
              "*.totpCode",
              "*.token",
            ],
            censor: "[REDACTED]",
          },
        },
      }),
    }),
    JwtModule.registerAsync({
      global: true,
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>) => ({
        secret: config.get("JWT_ACCESS_SECRET", { infer: true }),
        signOptions: { expiresIn: config.get("JWT_ACCESS_TTL_SECONDS", { infer: true }) },
      }),
    }),
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 120 }]), // global baseline; auth endpoints add stricter buckets
    DatabaseModule,
    SettingsModule,
    AuditModule,
    AlertsModule,
    RedisModule,
    StorageModule,
    HealthModule,
    FeesModule,
    LedgerModule,
    EscrowModule,
    OffersModule,
    TradesModule,
    AuthModule,
    UsersModule,
    WalletModule,
    KycModule,
    WithdrawalsModule,
    DisputesModule,
    ChatModule,
    RiskModule,
    ScreeningModule,
    NotifyModule,
    AdminModule,
    TreasuryModule,
    ContentModule,
    // DepositsModule + SignerModule run ONLY in the worker process (crons)
  ],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AppModule {}
