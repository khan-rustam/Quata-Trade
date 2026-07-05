import { Global, Module } from "@nestjs/common";
import { PromoService } from "./promo.service";

/** Global so any fee path (trades, deposits, withdrawals) can resolve promo overrides. */
@Global()
@Module({
  providers: [PromoService],
  exports: [PromoService],
})
export class PromoModule {}
