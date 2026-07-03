import { Module } from "@nestjs/common";
import { AuditModule } from "../../common/audit/audit.module";
import { NotifyModule } from "../notify/notify.module";
import { UsersService } from "./users.service";
import { UsersController } from "./users.controller";
import { TradersController } from "./traders.controller";

@Module({
  imports: [AuditModule, NotifyModule],
  controllers: [UsersController, TradersController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
