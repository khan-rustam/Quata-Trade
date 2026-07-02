import * as path from "node:path";
import { promises as fs } from "node:fs";
import { pathToFileURL } from "node:url";
import { Kysely, Migrator, PostgresDialect, type Migration, type MigrationProvider } from "kysely";
import { Pool } from "pg";
import type { Database } from "./types";

/**
 * Kysely's FileMigrationProvider breaks on Windows (dynamic import needs
 * file:// URLs for absolute paths) — this provider is path-safe everywhere.
 */
class FileUrlMigrationProvider implements MigrationProvider {
  constructor(private readonly folder: string) {}

  async getMigrations(): Promise<Record<string, Migration>> {
    const files = await fs.readdir(this.folder);
    const migrations: Record<string, Migration> = {};
    for (const file of files.sort()) {
      if (!/\.(ts|js)$/.test(file) || file.endsWith(".d.ts")) continue;
      const mod = (await import(pathToFileURL(path.join(this.folder, file)).href)) as Migration;
      migrations[file.replace(/\.(ts|js)$/, "")] = mod;
    }
    return migrations;
  }
}

/**
 * Migration runner. Uses DATABASE_MIGRATION_URL (owner role) — the app role
 * deliberately lacks DDL rights and UPDATE/DELETE on append-only tables.
 */
export function createMigrator(db: Kysely<Database>): Migrator {
  return new Migrator({
    db,
    provider: new FileUrlMigrationProvider(path.join(__dirname, "migrations")),
  });
}

export async function migrateToLatest(db: Kysely<Database>): Promise<void> {
  const migrator = createMigrator(db);
  const { error, results } = await migrator.migrateToLatest();
  for (const r of results ?? []) {
    // eslint-disable-next-line no-console
    console.log(`migration "${r.migrationName}": ${r.status}`);
  }
  if (error) throw error;
}

async function main(): Promise<void> {
  const direction = process.argv[2] ?? "up";
  try {
    process.loadEnvFile(".env"); // Node 21+; CLI convenience — CI/prod inject real env
  } catch {
    /* no .env present — rely on process env */
  }
  const url = process.env.DATABASE_MIGRATION_URL ?? process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_MIGRATION_URL or DATABASE_URL required");

  const db = new Kysely<Database>({
    dialect: new PostgresDialect({ pool: new Pool({ connectionString: url, max: 2 }) }),
  });

  try {
    if (direction === "down") {
      const migrator = createMigrator(db);
      const { error, results } = await migrator.migrateDown();
      for (const r of results ?? []) {
        // eslint-disable-next-line no-console
        console.log(`migration "${r.migrationName}": ${r.status}`);
      }
      if (error) throw error;
    } else {
      await migrateToLatest(db);
    }
  } finally {
    await db.destroy();
  }
}

if (require.main === module) {
  main().catch((err) => {
    // eslint-disable-next-line no-console
    console.error(err);
    process.exit(1);
  });
}
