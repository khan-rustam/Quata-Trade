import { Global, Module } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { Env } from "../../config/env";
import { HttpTronGridClient } from "../deposits/trongrid.client";
import { depositsConfigFromEnv } from "../deposits/deposits.config";
import { TronProvider } from "./tron.provider";
import { BlockchainRegistry } from "./blockchain-registry.service";

/**
 * Blockchain Provider layer (Documents/10 D30-node). @Global so any process
 * (API for the health view, worker for future scanning) can resolve a provider
 * via BlockchainRegistry. Builds its OWN failover-capable RPC client from env so
 * it is self-contained (no dependency on the worker-only DepositsModule).
 */
@Global()
@Module({
  providers: [
    {
      // Self-contained client (not the shared TRONGRID_CLIENT token) so this
      // module works in the API without pulling the deposit scanner jobs.
      provide: HttpTronGridClient,
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>) => new HttpTronGridClient(depositsConfigFromEnv(config)),
    },
    TronProvider,
    BlockchainRegistry,
  ],
  exports: [BlockchainRegistry],
})
export class BlockchainModule {}
