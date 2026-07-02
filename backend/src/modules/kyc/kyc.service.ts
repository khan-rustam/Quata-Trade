import { Inject, Injectable } from "@nestjs/common";
import type { Kysely } from "kysely";
import type { KycStatusResponse, KycSubmitRequest } from "@quatatrade/shared";
import { DB } from "../../db/database.module";
import type { Database } from "../../db/types";
import { newId } from "../../common/ids";
import { AuditService } from "../../common/audit/audit.service";
import { MinioService } from "../../common/storage/minio.service";
import { SettingsService } from "../settings/settings.service";
import type { KycUploadRequest } from "./kyc.schemas";
import {
  assertDecodedSize,
  assertFileKeysOwned,
  assertMagicBytes,
  assertTierProgression,
  extensionFor,
} from "./kyc.rules";
import { SubmissionNotFoundError } from "./kyc.errors";

export interface KycSubmitResult {
  id: string;
  tier: number;
  status: "PENDING";
}

/**
 * kyc — user-facing side (Documents/06 "kyc": MANUAL DECISION ONLY).
 * Uploads are validated server-side (size + magic bytes, SVG banned) before
 * they touch MinIO; submissions never change kyc_tier — only an admin review
 * via KycAdminService can. This service contains NO approval path.
 */
@Injectable()
export class KycService {
  constructor(
    @Inject(DB) private readonly db: Kysely<Database>,
    private readonly minio: MinioService,
    private readonly settings: SettingsService,
    private readonly audit: AuditService,
  ) {}

  /** Decode → enforce ≤5 MiB → magic bytes must match declared mime → private bucket. */
  async upload(userId: string, dto: KycUploadRequest, ip?: string): Promise<{ key: string }> {
    const data = Buffer.from(dto.fileBase64, "base64");
    assertDecodedSize(data);
    assertMagicBytes(data, dto.mime);

    const key = `${userId}/${newId()}${extensionFor(dto.mime)}`;
    await this.minio.putObject("kyc", key, data, dto.mime);

    // Document access/creation is audit-logged (Documents/08 §F) — key only, never content.
    await this.audit.log({
      actorType: "user",
      actorId: userId,
      action: "kyc.file_uploaded",
      targetType: "kyc_file",
      ip,
      metadata: { key, mime: dto.mime, sizeBytes: data.length },
    });
    return { key };
  }

  /**
   * One PENDING submission at a time; tier strictly currentTier + 1; every file
   * key must belong to the caller. Retention date fixed at submit time.
   * Row lock on the user serializes concurrent submits (no double-PENDING).
   */
  async submit(userId: string, dto: KycSubmitRequest, ip?: string): Promise<KycSubmitResult> {
    const retentionDays = await this.settings.kycRetentionDays();

    return this.db.transaction().execute(async (trx) => {
      const user = await trx
        .selectFrom("users")
        .select(["id", "kyc_tier", "kyc_status"])
        .where("id", "=", userId)
        .forUpdate()
        .executeTakeFirst();
      if (!user) throw new SubmissionNotFoundError(userId); // unreachable behind auth — defensive

      const pending = await trx
        .selectFrom("kyc_submissions")
        .select("id")
        .where("user_id", "=", userId)
        .where("status", "=", "PENDING")
        .executeTakeFirst();

      assertTierProgression({
        currentTier: user.kyc_tier,
        requestedTier: dto.tier,
        hasPendingSubmission: pending !== undefined,
      });
      assertFileKeysOwned(userId, dto.files);

      const retention = new Date();
      retention.setUTCDate(retention.getUTCDate() + retentionDays);

      const id = newId();
      await trx
        .insertInto("kyc_submissions")
        .values({
          id,
          user_id: userId,
          tier: dto.tier,
          doc_type: dto.docType,
          files: JSON.stringify(dto.files),
          ocr_prefill: null,
          retention_delete_after: retention,
        })
        .execute();

      await trx
        .updateTable("users")
        .set({ kyc_status: "PENDING", updated_at: new Date() })
        .where("id", "=", userId)
        .execute();

      await trx
        .insertInto("outbox")
        .values({
          id: newId(),
          event_type: "kyc.submitted",
          payload: JSON.stringify({ submissionId: id, userId, tier: dto.tier }),
        })
        .execute();

      await this.audit.log(
        {
          actorType: "user",
          actorId: userId,
          action: "kyc.submitted",
          targetType: "kyc_submission",
          targetId: id,
          ip,
          metadata: { tier: dto.tier, docType: dto.docType, fileCount: dto.files.length },
        },
        trx,
      );

      return { id, tier: dto.tier, status: "PENDING" as const };
    });
  }

  /** Shape matches zKycStatusResponse from @quatatrade/shared. */
  async status(userId: string): Promise<KycStatusResponse> {
    const user = await this.db
      .selectFrom("users")
      .select(["kyc_tier", "kyc_status"])
      .where("id", "=", userId)
      .executeTakeFirst();
    if (!user) throw new SubmissionNotFoundError(userId); // unreachable behind auth — defensive

    const [pending, latestReviewed] = await Promise.all([
      this.db
        .selectFrom("kyc_submissions")
        .select(["id", "tier", "created_at"])
        .where("user_id", "=", userId)
        .where("status", "=", "PENDING")
        .orderBy("created_at", "desc")
        .limit(1)
        .executeTakeFirst(),
      this.db
        .selectFrom("kyc_submissions")
        .select(["review_notes"])
        .where("user_id", "=", userId)
        .where("status", "!=", "PENDING")
        .orderBy("created_at", "desc")
        .limit(1)
        .executeTakeFirst(),
    ]);

    return {
      tier: user.kyc_tier,
      status: user.kyc_status,
      pendingSubmission: pending
        ? { id: pending.id, tier: pending.tier, submittedAt: pending.created_at.toISOString() }
        : null,
      reviewNotes: latestReviewed?.review_notes ?? null,
    };
  }
}
