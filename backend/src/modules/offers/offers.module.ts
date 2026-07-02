import { Module } from "@nestjs/common";
import { LedgerModule } from "../ledger/ledger.module";
import { OffersService } from "./offers.service";

@Module({
  imports: [LedgerModule],
  providers: [OffersService],
  exports: [OffersService],
})
export class OffersModule {}
