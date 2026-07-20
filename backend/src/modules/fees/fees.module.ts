import { Module } from "@nestjs/common";
import { SettingsModule } from "../settings/settings.module";
import { FeesController } from "./fees.controller";

/**
 * fees is a pure-function module for the math — callers import from
 * `modules/fees` and never re-implement it. It also serves the PUBLIC fee
 * schedule, so the marketing page publishes the configured values rather than
 * hardcoded copy that can drift from what is charged.
 */
@Module({
  imports: [SettingsModule],
  controllers: [FeesController],
})
export class FeesModule {}
