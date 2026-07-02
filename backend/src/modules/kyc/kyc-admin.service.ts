import { Inject, Injectable } from "@nestjs/common";
import type { Kysely } from "kysely";
import { DB } from "../../db/database.module";
import type { Database } from "../../db/types";
import { newId } from "../../common/ids";
import { AuditService } from "../../common/audit/audit.service";
import { ReviewNotAllowedError, SubmissionNotFoundError } from "./kyc.errors";

export type KycReviewDecision = "APPROVED" | "REJECTED" | "RESUBMIT";
const REVIEW_DECISIONS: readonly KycReviewDecision[] = ["APPROVED", "REJECTED", "RESUBMIT"];

export interface KycQueueItem {
  id: string;
  userId: string;
  userEmail: string;
  tier: number;
  docType: string;
  files: string[];
  submittedAt: Date;
  retentionDeleteAfter: Date;
}

export interface KycReviewResult {
  submissionId: string;
  userId: string;
  tier: number;
  decision: KycReviewDecision;
}

/**
 * kyc (admin side) — NO HTTP here; the admin module calls it behind
 * RolesGuard (SUPER_ADMIN | COMPLIANCE_ADMIN per the RBAC matrix).
 * MANUAL DECISIONS ONLY: review() demands an existing, active admin id —
 * there is NO auto-approve code path anywhere (CLAUDE.md hard rule).
 */
@Injectable()
export class KycAdminService {
  constructor(
    @Inject(DB) private readonly db: Kysely<Database>,
    private readonly audit: AuditService,
  ) {}

  /** Oldest-first review queue of PENDING submissions with the user's email. */
  async queue(pagination: { page: number; pageSize: number }): Promise<{ items: KycQueueItem[]; total: number }> {
    const [rows, count] = await Promise.all([
      this.db
        .selectFrom("kyc_submissions as s")
        .innerJoin("users as u", "u.id", "s.user_id")
        .select(["s.id", "s.user_id", "u.email", "s.tier", "s.doc_type", "s.files", "s.created_at", "s.retention_delete_after"])
        .where("s.status", "=", "PENDING")
        .orderBy("s.created_at", "asc")
        .limit(pagination.pageSize)
        .offset((pagination.page - 1) * pagination.pageSize)
        .execute(),
      this.db
        .selectFrom("kyc_submissions")
        .select((eb) => eb.fn.countAll<bigint>().as("n"))
        .where("status", "=", "PENDING")
        .executeTakeFirstOrThrow(),
    ]);

    return {
      items: rows.map((r) => ({
        id: r.id,
        userId: r.user_id,
        userEmail: r.email,
        tier: r.tier,
        docType: r.doc_type,
        files: r.files,
        submittedAt: r.created_at,
        retentionDeleteAfter: r.retention_delete_after,
      })),
      total: Number(count.n),
    };
  }

  /**
   * Manual review — the ONLY code path that changes users.kyc_tier upward.
   * APPROVED → users.kyc_tier = submission.tier + kyc_status = APPROVED;
   * REJECTED/RESUBMIT → users.kyc_status follows the decision.
   * Every review is audit-logged (hash chain) with the reviewer's notes.
   */
  async review(
    submissionId: string,
    adminId: string,
    decision: KycReviewDecision,
    notes?: string,
    ip?: string,
  ): Promise<KycReviewResult> {
    // Manual-decision invariant: a human admin id is mandatory. Runtime assert
    // on top of the type system because callers may pass through wire data.
    if (typeof adminId !== "string" || adminId.length === 0) {
      throw new ReviewNotAllowedError("a reviewing admin is required — KYC has no automated decisions");
    }
    if (!REVIEW_DECISIONS.includes(decision)) {
      throw new ReviewNotAllowedError("unknown review decision");
    }

    return this.db.transaction().execute(async (trx) => {
      const admin = await trx
        .selectFrom("admins")
        .select(["id", "active"])
        .where("id", "=", adminId)
        .executeTakeFirst();
      if (!admin || !admin.active) {
        throw new ReviewNotAllowedError("reviewer is not an active admin");
      }

      const submission = await trx
        .selectFrom("kyc_submissions")
        .select(["id", "user_id", "tier", "status"])
        .where("id", "=", submissionId)
        .forUpdate()
        .executeTakeFirst();
      if (!submission) throw new SubmissionNotFoundError(submissionId);
      if (submission.status !== "PENDING") {
        throw new ReviewNotAllowedError("submission has already been reviewed");
      }

      await trx
        .updateTable("kyc_submissions")
        .set({
          status: decision,
          reviewed_by: adminId,
          reviewed_at: new Date(),
          review_notes: notes ?? null,
        })
        .where("id", "=", submissionId)
        .where("status", "=", "PENDING") // guarded even under the row lock — belt and braces
        .execute();

      if (decision === "APPROVED") {
        await trx
          .updateTable("users")
          .set({ kyc_tier: submission.tier, kyc_status: "APPROVED", updated_at: new Date() })
          .where("id", "=", submission.user_id)
          .execute();
      } else {
        await trx
          .updateTable("users")
          .set({ kyc_status: decision, updated_at: new Date() })
          .where("id", "=", submission.user_id)
          .execute();
      }

      await trx
        .insertInto("outbox")
        .values({
          id: newId(),
          event_type: "kyc.reviewed",
          payload: JSON.stringify({
            submissionId,
            userId: submission.user_id,
            tier: submission.tier,
            decision,
          }),
        })
        .execute();

      await this.audit.log(
        {
          actorType: "admin",
          actorId: adminId,
          action: `kyc.review.${decision.toLowerCase()}`,
          targetType: "kyc_submission",
          targetId: submissionId,
          ip,
          metadata: { decision, tier: submission.tier, userId: submission.user_id, notes: notes ?? null },
        },
        trx,
      );

      return { submissionId, userId: submission.user_id, tier: submission.tier, decision };
    });
  }
}
