import { Global, Module } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { Env } from "../../config/env";
import { COLD_WALLET_PROVIDER, createColdWalletProvider } from "./cold-wallet.provider";
import { ColdWalletService } from "./cold-wallet.service";

/**
 * Cold Wallet Provider abstraction (Documents/10 D30-cold). @Global so any
 * future money path can inject the provider/service. The concrete provider is
 * chosen from COLD_WALLET_PROVIDER env — 'disabled' at launch. Enabling a real
 * cold wallet later is config-only.
 */
@Global()
@Module({
  providers: [
    {
      provide: COLD_WALLET_PROVIDER,
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>) =>
        createColdWalletProvider(config.get("COLD_WALLET_PROVIDER", { infer: true })),
    },
    ColdWalletService,
  ],
  exports: [COLD_WALLET_PROVIDER, ColdWalletService],
})
export class ColdWalletModule {}
