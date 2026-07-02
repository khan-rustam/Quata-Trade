import { Global, Module, type OnApplicationShutdown } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Kysely, PostgresDialect } from "kysely";
import { Pool, types as pgTypes } from "pg";
import type { Env } from "../config/env";
import type { Database } from "./types";

export const DB = Symbol("KYSELY_DB");

/**
 * int8 (bigint) must come back as native bigint — NEVER a JS number.
 * (JS numbers silently corrupt monetary values past 2^53.)
 */
pgTypes.setTypeParser(pgTypes.builtins.INT8, (v: string) => BigInt(v));

export function createPool(connectionString: string): Pool {
  return new Pool({
    connectionString,
    max: 20,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 10_000,
  });
}

export function createDb(connectionString: string): Kysely<Database> {
  return new Kysely<Database>({
    dialect: new PostgresDialect({ pool: createPool(connectionString) }),
  });
}

@Global()
@Module({
  providers: [
    {
      provide: DB,
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>) =>
        createDb(config.get("DATABASE_URL", { infer: true })),
    },
    {
      provide: "DB_SHUTDOWN",
      inject: [DB],
      useFactory: (db: Kysely<Database>): OnApplicationShutdown => ({
        onApplicationShutdown: () => db.destroy(),
      }),
    },
  ],
  exports: [DB],
})
export class DatabaseModule {}
