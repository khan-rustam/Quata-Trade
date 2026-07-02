import { Global, Module, type OnApplicationShutdown } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import Redis from "ioredis";
import type { Env } from "../../config/env";

export const REDIS = Symbol("REDIS_CLIENT");

/** Shared ioredis client: rate limits, velocity counters, socket adapter, BullMQ. */
@Global()
@Module({
  providers: [
    {
      provide: REDIS,
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>) =>
        new Redis(config.get("REDIS_URL", { infer: true }), {
          maxRetriesPerRequest: 3,
          lazyConnect: false,
        }),
    },
    {
      provide: "REDIS_SHUTDOWN",
      inject: [REDIS],
      useFactory: (redis: Redis): OnApplicationShutdown => ({
        onApplicationShutdown: async () => {
          await redis.quit();
        },
      }),
    },
  ],
  exports: [REDIS],
})
export class RedisModule {}
