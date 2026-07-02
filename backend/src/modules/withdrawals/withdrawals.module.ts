import { Module } from "@nestjs/common";
import { LedgerModule } from "../ledger/ledger.module";
import { SettingsModule } from "../settings/settings.module";
import { AuditModule } from "../../common/audit/audit.module";
import { WithdrawalsService } from "./withdrawals.service";
import { WithdrawalsController } from "./withdrawals.controller";

@Module({
  imports: [LedgerModule, SettingsModule, AuditModule],
  controllers: [WithdrawalsController],
  providers: [WithdrawalsService],
  exports: [WithdrawalsService],
})
export class WithdrawalsModule {}
