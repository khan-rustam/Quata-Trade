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
import { MockSignerService } from "./mock-signer.service";
import { RemoteSignerService } from "./remote-signer.service";
import { WithdrawalPipelineService } from "./withdrawal-pipeline.service";
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
    WithdrawalPipelineService,
  ],
  exports: [SIGNER_CLIENT, WithdrawalPipelineService],
})
export class SignerModule {}
