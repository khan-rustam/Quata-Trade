import { Module } from "@nestjs/common";
import { LedgerModule } from "../ledger/ledger.module";
import { EscrowModule } from "../escrow/escrow.module";
import { RiskModule } from "../risk/risk.module";
import { TradesService } from "./trades.service";
import { TradesController } from "./trades.controller";

@Module({
  imports: [LedgerModule, EscrowModule, RiskModule],
  controllers: [TradesController],
  providers: [TradesService],
  exports: [TradesService],
})
export class TradesModule {}
