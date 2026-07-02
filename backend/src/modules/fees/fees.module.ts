import { Module } from "@nestjs/common";

/**
 * fees is a pure-function module — nothing to inject. It exists as a module
 * boundary so callers import from `modules/fees` and never re-implement math.
 */
@Module({})
export class FeesModule {}
