import { Module } from "@nestjs/common";
import { LedgerModule } from "../ledger/ledger.module";
import { OffersService } from "./offers.service";
import { OffersController } from "./offers.controller";

@Module({
  imports: [LedgerModule],
  controllers: [OffersController],
  providers: [OffersService],
  exports: [OffersService],
})
export class OffersModule {}
