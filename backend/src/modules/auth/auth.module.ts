import { Module } from "@nestjs/common";
import { AuditModule } from "../../common/audit/audit.module";
import { RiskModule } from "../risk/risk.module";
import { AuthService } from "./auth.service";
import { TotpService } from "./totp.service";
import { PinService } from "./pin.service";
import { AuthController } from "./auth.controller";

@Module({
  imports: [AuditModule, RiskModule],
  controllers: [AuthController],
  providers: [AuthService, TotpService, PinService],
  exports: [AuthService, TotpService, PinService],
})
export class AuthModule {}
