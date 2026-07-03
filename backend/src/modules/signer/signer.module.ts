import { Module } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { Kysely } from "kysely";
import type { Env } from "../../config/env";
import { DB } from "../../db/database.module";
import type { Database } from "../../db/types";
import { AuditModule } from "../../common/audit/audit.module";
import { LedgerModule } from "../ledger/ledger.module";
import { SettingsModule } from "../settings/settings.module";
import { SettingsService } from "../settings/settings.service";
import { WithdrawalsModule } from "../withdrawals/withdrawals.module";
import { DEPOSITS_CONFIG, depositsConfigFromEnv } from "../deposits/deposits.config";
import { HttpTronGridClient, TRONGRID_CLIENT } from "../deposits/trongrid.client";
import { MockSignerService } from "./mock-signer.service";
import { RemoteSignerService } from "./remote-signer.service";
import { WithdrawalPipelineService } from "./withdrawal-pipeline.service";
import { WithdrawalConfirmationService } from "./withdrawal-confirmation.service";
import { SIGNER_CLIENT, type SignerClient } from "./signer.types";

@Module({
  imports: [LedgerModule, SettingsModule, AuditModule, WithdrawalsModule],
  providers: [
    {
      provide: SIGNER_CLIENT,
      inject: [ConfigService, DB, SettingsService],
      useFactory: (
        config: ConfigService<Env, true>,
        db: Kysely<Database>,
        settings: SettingsService,
      ): SignerClient =>
        config.get("SIGNER_MODE", { infer: true }) === "mock"
          ? new MockSignerService(config, db, settings)
          : new RemoteSignerService(config),
    },
    // Read-only chain client for the confirmation poller (item 5). Provided
    // locally so SignerModule stays decoupled from the deposit cron pipeline.
    { provide: DEPOSITS_CONFIG, inject: [ConfigService], useFactory: depositsConfigFromEnv },
    { provide: TRONGRID_CLIENT, useClass: HttpTronGridClient },
    WithdrawalPipelineService,
    WithdrawalConfirmationService,
  ],
  exports: [SIGNER_CLIENT, WithdrawalPipelineService, WithdrawalConfirmationService],
})
export class SignerModule {}
