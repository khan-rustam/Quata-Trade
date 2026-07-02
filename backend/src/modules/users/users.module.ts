import { Module } from "@nestjs/common";
import { AuditModule } from "../../common/audit/audit.module";
import { UsersService } from "./users.service";
import { UsersController } from "./users.controller";
import { TradersController } from "./traders.controller";

@Module({
  imports: [AuditModule],
  controllers: [UsersController, TradersController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
