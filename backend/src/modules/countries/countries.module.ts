import { Global, Module } from "@nestjs/common";
import { CountriesService } from "./countries.service";
import { CountriesController } from "./countries.controller";

/**
 * Global so AuthService (sign-up gating), OffersService (market scope),
 * TradesService (same-country + enabled gate) and AdminService (toggle) can all
 * inject CountriesService without re-importing — mirrors SettingsModule.
 */
@Global()
@Module({
  controllers: [CountriesController],
  providers: [CountriesService],
  exports: [CountriesService],
})
export class CountriesModule {}
