import { Module } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { Env } from "../../config/env";
import { AuditModule } from "../../common/audit/audit.module";
import { LedgerModule } from "../ledger/ledger.module";
import { AuthModule } from "../auth/auth.module";
import { PinService } from "../auth/pin.service";
import { WalletController } from "./wallet.controller";
import { WalletService } from "./wallet.service";
import { WalletConfigService } from "./wallet-config.service";
import { PIN_SERVICE, WALLET_XPUB } from "./wallet.tokens";

/**
 * wallet — watch-only (Documents/06). PIN verification is delegated to the
 * auth module's PinService through the narrow PIN_SERVICE token so wallet
 * never learns about hashes/lockout internals.
 */
@Module({
  imports: [AuditModule, LedgerModule, AuthModule],
  controllers: [WalletController],
  providers: [
    WalletService,
    WalletConfigService,
    { provide: PIN_SERVICE, useExisting: PinService },
    {
      provide: WALLET_XPUB,
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>) => config.get("WALLET_XPUB", { infer: true }),
    },
  ],
  exports: [WalletService, WalletConfigService],
})
export class WalletModule {}
