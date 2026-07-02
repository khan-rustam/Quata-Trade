import { Module } from "@nestjs/common";
import { LedgerModule } from "../ledger/ledger.module";
import { EscrowModule } from "../escrow/escrow.module";
import { TradesService } from "./trades.service";

@Module({
  imports: [LedgerModule, EscrowModule],
  providers: [TradesService],
  exports: [TradesService],
})
export class TradesModule {}
