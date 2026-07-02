import { PostgreSqlContainer, type StartedPostgreSqlContainer } from "@testcontainers/postgresql";
import { Kysely, PostgresDialect } from "kysely";
import { Pool, types as pgTypes } from "pg";
import { migrateToLatest } from "../../src/db/migrate";
import type { Database } from "../../src/db/types";

pgTypes.setTypeParser(pgTypes.builtins.INT8, (v: string) => BigInt(v));

export interface TestDb {
  container: StartedPostgreSqlContainer;
  db: Kysely<Database>;
  /** connection as the RESTRICTED app role (REVOKE tests) */
  appDb: Kysely<Database>;
  stop: () => Promise<void>;
}

/** Boot a disposable Postgres 16, run all migrations, return owner + app-role connections. */
export async function startTestDb(): Promise<TestDb> {
  const container = await new PostgreSqlContainer("postgres:16-alpine")
    .withDatabase("quatatrade")
    .withUsername("quatatrade")
    .withPassword("quatatrade_test")
    .start();

  const makeDb = (user: string, password: string): Kysely<Database> =>
    new Kysely<Database>({
      dialect: new PostgresDialect({
        pool: new Pool({
          host: container.getHost(),
          port: container.getPort(),
          database: container.getDatabase(),
          user,
          password,
          max: 60, // concurrency tests need real parallel connections
        }),
      }),
    });

  const db = makeDb("quatatrade", "quatatrade_test");
  process.env.DATABASE_APP_PASSWORD = "app_test_only";
  await migrateToLatest(db);
  const appDb = makeDb("quatatrade_app", "app_test_only");

  return {
    container,
    db,
    appDb,
    stop: async () => {
      await appDb.destroy();
      await db.destroy();
      await container.stop();
    },
  };
}
