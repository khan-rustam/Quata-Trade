import { Module } from "@nestjs/common";
import { WalletModule } from "../wallet/wallet.module";
import { HealthController } from "./health.controller";

/**
 * Health/readiness/status endpoints. DB, Redis, Settings and MinIO are @Global;
 * WalletModule is imported so /status can report deposit-derivation readiness.
 */
@Module({
  imports: [WalletModule],
  controllers: [HealthController],
})
export class HealthModule {}
