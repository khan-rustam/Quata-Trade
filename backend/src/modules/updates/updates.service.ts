import { Inject, Injectable } from "@nestjs/common";
import type { Kysely, Selectable } from "kysely";
import type {
  AppPlatform,
  AppRelease,
  CheckUpdateResponse,
  PublishReleaseRequest,
  ReleaseStatusRequest,
  VersionResponse,
} from "@quatatrade/shared";
import { DB } from "../../db/database.module";
import type { AppReleasesTable, Database } from "../../db/types";
import { newId } from "../../common/ids";
import { AuditService } from "../../common/audit/audit.service";
import { DuplicateReleaseError, ReleaseNotFoundError } from "./updates.errors";
import { decideUpdate, DEFAULT_MIN_SUPPORTED } from "./updates.rules";

type ReleaseRow = Selectable<AppReleasesTable>;

const UNIQUE_VIOLATION = "23505";

function pgCode(err: unknown): string | undefined {
  if (typeof err === "object" && err !== null && "code" in err) {
    const code = (err as { code?: unknown }).code;
    return typeof code === "string" ? code : undefined;
  }
  return undefined;
}

/**
 * Update management (self-hosted). Serves "what is the current release for my
 * platform, and is my build still supported?" to clients, and lets a SUPER admin
 * publish / roll back releases.
 *
 * Ordering is ALWAYS by version_code (integer). The semver string is a label:
 * "1.10.0" < "1.9.0" lexically, which would serve the wrong release.
 */
@Injectable()
export class UpdatesService {
  constructor(
    @Inject(DB) private readonly db: Kysely<Database>,
    private readonly audit: AuditService,
  ) {}

  /** Newest published release for a platform, or null when nothing is published. */
  async latest(platform: AppPlatform): Promise<AppRelease | null> {
    const row = await this.db
      .selectFrom("app_releases")
      .selectAll()
      .where("platform", "=", platform)
      .where("status", "=", "published")
      .orderBy("version_code", "desc")
      .limit(1)
      .executeTakeFirst();
    return row ? this.toRelease(row) : null;
  }

  async versionInfo(platform: AppPlatform): Promise<VersionResponse> {
    const latest = await this.latest(platform);
    return {
      platform,
      latest,
      minSupportedCode: latest?.minSupportedCode ?? DEFAULT_MIN_SUPPORTED,
    };
  }

  /**
   * Decide what the client should do. `mustUpdate` is true when the installed
   * build is below the minimum supported code (hard gate), or when the newest
   * release is flagged mandatory/security.
   */
  async check(platform: AppPlatform, currentCode: number): Promise<CheckUpdateResponse> {
    const latest = await this.latest(platform);
    const decision = decideUpdate(latest, currentCode);
    return { platform, currentCode, latest, ...decision };
  }

  /** Published history (newest first) — powers "what's new" / release notes. */
  async listPublished(platform: AppPlatform, limit = 20): Promise<AppRelease[]> {
    const rows = await this.db
      .selectFrom("app_releases")
      .selectAll()
      .where("platform", "=", platform)
      .where("status", "=", "published")
      .orderBy("version_code", "desc")
      .limit(limit)
      .execute();
    return rows.map((r) => this.toRelease(r));
  }

  /** Admin view — every status, optionally filtered by platform. */
  async listAll(platform?: AppPlatform, limit = 100): Promise<AppRelease[]> {
    let q = this.db.selectFrom("app_releases").selectAll();
    if (platform) q = q.where("platform", "=", platform);
    const rows = await q.orderBy("version_code", "desc").limit(limit).execute();
    return rows.map((r) => this.toRelease(r));
  }

  /** Publish a new release. Audited; (platform, version) is unique. */
  async publish(adminId: string, dto: PublishReleaseRequest, ip?: string): Promise<AppRelease> {
    let row: ReleaseRow;
    try {
      row = await this.db
        .insertInto("app_releases")
        .values({
          id: newId(),
          platform: dto.platform,
          version: dto.version,
          version_code: dto.versionCode,
          update_type: dto.updateType,
          status: "published",
          release_notes: dto.releaseNotes,
          min_supported_code: dto.minSupportedCode,
          artifact_url: dto.artifactUrl ?? null,
          checksum_sha256: dto.checksumSha256 ?? null,
          signature: dto.signature ?? null,
          published_by: adminId,
        })
        .returningAll()
        .executeTakeFirstOrThrow();
    } catch (err) {
      if (pgCode(err) === UNIQUE_VIOLATION) throw new DuplicateReleaseError();
      throw err;
    }

    await this.audit.log({
      actorType: "admin",
      actorId: adminId,
      action: "release.publish",
      targetType: "app_release",
      targetId: row.id,
      ip,
      metadata: {
        platform: dto.platform,
        version: dto.version,
        versionCode: dto.versionCode,
        updateType: dto.updateType,
        minSupportedCode: dto.minSupportedCode,
      },
    });
    return this.toRelease(row);
  }

  /** Roll back or archive a release (emergency lever). Audited with a reason. */
  async setStatus(adminId: string, id: string, dto: ReleaseStatusRequest, ip?: string): Promise<AppRelease> {
    const row = await this.db
      .updateTable("app_releases")
      .set({ status: dto.status })
      .where("id", "=", id)
      .returningAll()
      .executeTakeFirst();
    if (!row) throw new ReleaseNotFoundError();

    await this.audit.log({
      actorType: "admin",
      actorId: adminId,
      action: dto.status === "rolled_back" ? "release.rollback" : "release.archive",
      targetType: "app_release",
      targetId: id,
      ip,
      metadata: { platform: row.platform, version: row.version, status: dto.status, reason: dto.reason },
    });
    return this.toRelease(row);
  }

  private toRelease(r: ReleaseRow): AppRelease {
    return {
      id: r.id,
      platform: r.platform as AppRelease["platform"],
      version: r.version,
      versionCode: r.version_code,
      updateType: r.update_type as AppRelease["updateType"],
      status: r.status as AppRelease["status"],
      releaseNotes: r.release_notes,
      minSupportedCode: r.min_supported_code,
      artifactUrl: r.artifact_url,
      checksumSha256: r.checksum_sha256,
      signature: r.signature,
      releasedAt: r.released_at.toISOString(),
    };
  }
}
