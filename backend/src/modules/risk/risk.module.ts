import { Module } from "@nestjs/common";
import { AuditModule } from "../../common/audit/audit.module";
import { RedisModule } from "../../common/redis/redis.module";
import { RiskService } from "./risk.service";

/**
 * risk — deterministic event scoring (Documents/06). No HTTP endpoints;
 * the admin module reads risk_events directly. AuditModule/RedisModule are
 * @Global — importing them here keeps this module self-contained.
 */
@Module({
  imports: [AuditModule, RedisModule],
  providers: [RiskService],
  exports: [RiskService],
})
export class RiskModule {}
