import { Module } from "@nestjs/common";
import { LedgerModule } from "../ledger/ledger.module";
import { EscrowService } from "./escrow.service";

/**
 * escrow — the ONLY module that mutates trade/escrow state.
 * No HTTP endpoints; trades/disputes/worker call the service.
 */
@Module({
  imports: [LedgerModule],
  providers: [EscrowService],
  exports: [EscrowService],
})
export class EscrowModule {}
