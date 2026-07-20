import { sql, type Kysely } from "kysely";

/**
 * Update management (self-hosted). One row per published application release,
 * per platform. The client asks "what's the latest for my platform, and is my
 * version still supported?" — see the `updates` module.
 *
 * Ordering is by `version_code` (a monotonic integer), NOT the semver string:
 * "1.10.0" sorts before "1.9.0" lexically, which would silently serve the wrong
 * release. `version` stays the human-facing label.
 *
 * `artifact_url` / `checksum_sha256` / `signature` exist for binary platforms
 * (Android APK) and stay NULL for web/pwa, which update via the service worker.
 */
export async function up(db: Kysely<unknown>): Promise<void> {
  await sql`
    CREATE TABLE app_releases (
      id uuid PRIMARY KEY,
      platform text NOT NULL CHECK (platform IN ('web','pwa','android','ios')),
      version text NOT NULL,
      version_code integer NOT NULL CHECK (version_code > 0),
      update_type text NOT NULL CHECK (update_type IN ('optional','mandatory','security')),
      status text NOT NULL DEFAULT 'published'
        CHECK (status IN ('published','rolled_back','archived')),
      release_notes text NOT NULL DEFAULT '',
      /* Clients below this version_code must update before continuing. */
      min_supported_code integer NOT NULL DEFAULT 1 CHECK (min_supported_code > 0),
      artifact_url text,
      checksum_sha256 text,
      signature text,
      released_at timestamptz NOT NULL DEFAULT now(),
      published_by uuid REFERENCES admins(id),
      created_at timestamptz NOT NULL DEFAULT now()
    )`.execute(db);

  // One row per (platform, version) — republishing the same version is a no-op/error,
  // never a silent duplicate.
  await sql`CREATE UNIQUE INDEX app_releases_platform_version_idx ON app_releases (platform, version)`.execute(db);
  // "latest published for this platform" is the hot query.
  await sql`CREATE INDEX app_releases_lookup_idx ON app_releases (platform, status, version_code DESC)`.execute(db);
  await sql`GRANT SELECT, INSERT, UPDATE ON app_releases TO quatatrade_app`.execute(db);
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await sql`DROP TABLE IF EXISTS app_releases`.execute(db);
}
