import { Inject, Injectable } from "@nestjs/common";
import type { Kysely, Selectable } from "kysely";
import type {
  DisputeResolution,
  DisputeStatus,
  OpenDisputeRequest,
  SubmitEvidenceRequest,
} from "@quatatrade/shared";
import { DB } from "../../db/database.module";
import type { Database, DisputesTable } from "../../db/types";
import { newId } from "../../common/ids";
import { AuditService } from "../../common/audit/audit.service";
import { MinioService } from "../../common/storage/minio.service";
import { LedgerService } from "../ledger/ledger.service";
import { EscrowService } from "../escrow/escrow.service";
import { SettingsService } from "../settings/settings.service";
import { IllegalTransitionError, TradeNotFoundError } from "../escrow/escrow.errors";
import {
  DisputeAlreadyOpenError,
  DisputeNotFoundError,
  DisputeResolvedError,
  InvalidEvidenceFileError,
} from "./disputes.errors";
import { validateEvidenceFile } from "./evidence-upload";

/** Wire shape of one evidence item (matches shared zDisputeEvidence — files are presigned URLs). */
export interface DisputeEvidenceView {
  id: string;
  submittedBy: string;
  kind: string;
  note: string | null;
  files: string[];
  createdAt: string;
}

/** Wire shape of a dispute (matches shared zDispute). */
export interface DisputeView {
  id: string;
  tradeId: string;
  openedBy: string;
  reason: string;
  status: DisputeStatus;
  resolution: DisputeResolution | null;
  resolutionNotes: string | null;
  resolvedAt: string | null;
  createdAt: string;
  evidence: DisputeEvidenceView[];
}

type DisputeRow = Selectable<DisputesTable>;

const UNIQUE_VIOLATION = "23505";

function pgCode(err: unknown): string | undefined {
  if (typeof err === "object" && err !== null && "code" in err) {
    const code = (err as { code?: unknown }).code;
    return typeof code === "string" ? code : undefined;
  }
  return undefined;
}

/**
 * disputes — user-facing dispute lifecycle (Documents/06 "disputes").
 * NEVER touches the ledger or trades.status directly: the trade freeze goes
 * through EscrowService.markDisputed inside ONE money transaction; resolution
 * money movement lives exclusively in DisputesAdminService → escrow.
 * Dispute-status stepping (OPEN → AWAITING_EVIDENCE → UNDER_REVIEW) only ever
 * updates the disputes table.
 */
@Injectable()
export class DisputesService {
  constructor(
    @Inject(DB) private readonly db: Kysely<Database>,
    private readonly ledger: LedgerService,
    private readonly escrow: EscrowService,
    private readonly audit: AuditService,
    private readonly minio: MinioService,
    private readonly settings: SettingsService,
  ) {}

  /**
   * POST /trades/:id/dispute — buyer or seller only; trade must be
   * ESCROW_LOCKED or PAYMENT_SUBMITTED. ONE transaction: trade row lock →
   * disputes insert (UNIQUE trade_id) → escrow.markDisputed (FSM + trade_events
   * + trade.disputed outbox) → dispute.opened outbox → audit. Funds untouched.
   */
  async openDispute(tradeId: string, userId: string, dto: OpenDisputeRequest): Promise<DisputeView> {
    const disputeId = newId();
    const created = await this.ledger.withMoneyTransaction(async (trx) => {
      const trade = await this.escrow.lockTrade(trx, tradeId);
      if (trade.buyer_id !== userId && trade.seller_id !== userId) {
        throw new TradeNotFoundError(tradeId); // 404 — never confirm a foreign trade exists
      }
      if (trade.status !== "ESCROW_LOCKED" && trade.status !== "PAYMENT_SUBMITTED") {
        throw new IllegalTransitionError(trade.status, "DISPUTED");
      }

      try {
        await trx
          .insertInto("disputes")
          .values({ id: disputeId, trade_id: tradeId, opened_by: userId, reason: dto.reason })
          .execute();
      } catch (err) {
        if (pgCode(err) === UNIQUE_VIOLATION) throw new DisputeAlreadyOpenError(); // → 409
        throw err;
      }

      // Dispute fee (fee-engine): DISABLED by default (0 → free, no ledger touch).
      // When set > 0, the opener is charged atomically with opening the dispute.
      const disputeFee = await this.settings.disputeFee();
      if (disputeFee > 0n) {
        const opener = await this.ledger.getOrCreateAccount(userId, "user_available", trade.asset, trx);
        const treasury = await this.ledger.getOrCreateAccount(null, "platform_treasury", trade.asset, trx);
        await this.ledger.postJournal(
          {
            reason: "dispute_fee",
            referenceType: "dispute",
            referenceId: disputeId,
            idempotencyKey: `dispute_fee:${disputeId}`,
            createdBy: userId,
            asset: trade.asset,
            legs: [
              { accountId: opener, amount: -disputeFee },
              { accountId: treasury, amount: disputeFee },
            ],
          },
          trx,
        );
      }

      await this.escrow.markDisputed(trx, trade, userId); // the ONLY trade-status writer

      await trx
        .insertInto("outbox")
        .values({
          id: newId(),
          event_type: "dispute.opened",
          payload: JSON.stringify({ disputeId, tradeId, openedBy: userId }),
        })
        .execute();
      await this.audit.log(
        {
          actorType: "user",
          actorId: userId,
          action: "dispute.opened",
          targetType: "dispute",
          targetId: disputeId,
          metadata: { tradeId },
        },
        trx,
      );

      return trx.selectFrom("disputes").selectAll().where("id", "=", disputeId).executeTakeFirstOrThrow();
    });
    return this.toView(created);
  }

  /**
   * POST /disputes/:id/evidence — opener or counterparty only; frozen once
   * RESOLVED. Status stepping is a plain disputes-table update (never trades):
   * OPEN → AWAITING_EVIDENCE on first side's evidence; → UNDER_REVIEW once
   * both sides have submitted.
   */
  async submitEvidence(disputeId: string, userId: string, dto: SubmitEvidenceRequest): Promise<DisputeView> {
    const { dispute, buyerId, sellerId } = await this.requireParty(disputeId, userId);
    if (dispute.status === "RESOLVED") throw new DisputeResolvedError();

    for (const key of dto.files) {
      if (!key.startsWith(`${disputeId}/`) || key.includes("..")) {
        throw new InvalidEvidenceFileError("file key does not belong to this dispute");
      }
    }

    await this.db.transaction().execute(async (trx) => {
      await trx
        .insertInto("dispute_evidence")
        .values({
          id: newId(),
          dispute_id: disputeId,
          submitted_by: userId,
          kind: dto.kind,
          files: JSON.stringify(dto.files),
          note: dto.note ?? null,
        })
        .execute();

      const submitters = await trx
        .selectFrom("dispute_evidence")
        .select("submitted_by")
        .distinct()
        .where("dispute_id", "=", disputeId)
        .execute();
      const sides = new Set(submitters.map((s) => s.submitted_by));
      const bothSides = sides.has(buyerId) && sides.has(sellerId);

      const next: DisputeStatus | null =
        dispute.status === "OPEN"
          ? bothSides
            ? "UNDER_REVIEW"
            : "AWAITING_EVIDENCE"
          : dispute.status === "AWAITING_EVIDENCE" && bothSides
            ? "UNDER_REVIEW"
            : null;
      if (next) {
        await trx
          .updateTable("disputes")
          .set({ status: next })
          .where("id", "=", disputeId)
          .where("status", "=", dispute.status) // guarded — lost races are no-ops
          .execute();
      }
    });

    return this.getDispute(disputeId, userId);
  }

  /** GET /disputes/:id — party-scoped; evidence files come back as short-TTL presigned URLs. */
  async getDispute(disputeId: string, userId: string): Promise<DisputeView> {
    const { dispute } = await this.requireParty(disputeId, userId);
    return this.toView(dispute);
  }

  /**
   * Admin read of a dispute — the same view the parties get, WITHOUT the party check.
   *
   * Resolving a dispute moves escrow irreversibly, and the only admin-visible
   * fields were the free-text reason and the amount: every uploaded proof was
   * unreachable, because GET /disputes/:id is party-scoped and admins hold an
   * admin token, not a user token. Compliance was choosing RELEASE_TO_BUYER vs
   * REFUND_TO_SELLER blind. Access is gated at the route (RBAC.resolveDispute)
   * and every view is audited, mirroring KycAdminService.documents.
   */
  async getDisputeForAdmin(disputeId: string, adminId: string, ip?: string): Promise<DisputeView> {
    const dispute = await this.db.selectFrom("disputes").selectAll().where("id", "=", disputeId).executeTakeFirst();
    if (!dispute) throw new DisputeNotFoundError();

    await this.audit.log({
      actorType: "admin",
      actorId: adminId,
      action: "dispute.evidence_viewed",
      targetType: "dispute",
      targetId: disputeId,
      ip,
      metadata: { tradeId: dispute.trade_id },
    });

    return this.toView(dispute);
  }

  /**
   * POST /disputes/:id/upload — same base64 + magic-byte pattern as KYC
   * (jpeg/png/webp/pdf, 5MB cap), private "disputes" bucket, key
   * `<disputeId>/<uuidv7><ext>` so submitEvidence can enforce scoping.
   */
  async uploadEvidenceFile(disputeId: string, userId: string, base64: string): Promise<{ key: string }> {
    const { dispute } = await this.requireParty(disputeId, userId);
    if (dispute.status === "RESOLVED") throw new DisputeResolvedError();

    const result = validateEvidenceFile(base64);
    if (!result.ok) throw new InvalidEvidenceFileError(result.reason);

    const key = `${disputeId}/${newId()}${result.file.ext}`;
    await this.minio.putObject("disputes", key, result.file.buffer, result.file.mime);
    return { key };
  }

  /** Load dispute + trade parties; 404 unless the requester is buyer or seller. */
  private async requireParty(
    disputeId: string,
    userId: string,
  ): Promise<{ dispute: DisputeRow; buyerId: string; sellerId: string }> {
    const dispute = await this.db.selectFrom("disputes").selectAll().where("id", "=", disputeId).executeTakeFirst();
    if (!dispute) throw new DisputeNotFoundError();
    const trade = await this.db
      .selectFrom("trades")
      .select(["buyer_id", "seller_id"])
      .where("id", "=", dispute.trade_id)
      .executeTakeFirstOrThrow();
    if (trade.buyer_id !== userId && trade.seller_id !== userId) {
      throw new DisputeNotFoundError(); // same 404 as "missing" — no enumeration
    }
    return { dispute, buyerId: trade.buyer_id, sellerId: trade.seller_id };
  }

  private async toView(dispute: DisputeRow): Promise<DisputeView> {
    const rows = await this.db
      .selectFrom("dispute_evidence")
      .selectAll()
      .where("dispute_id", "=", dispute.id)
      .orderBy("created_at", "asc")
      .execute();

    const evidence = await Promise.all(
      rows.map(async (row) => ({
        id: row.id,
        submittedBy: row.submitted_by,
        kind: row.kind,
        note: row.note,
        files: await Promise.all((row.files ?? []).map((key) => this.minio.presignedGet("disputes", key))),
        createdAt: row.created_at.toISOString(),
      })),
    );

    return {
      id: dispute.id,
      tradeId: dispute.trade_id,
      openedBy: dispute.opened_by,
      reason: dispute.reason,
      status: dispute.status,
      resolution: dispute.resolution,
      resolutionNotes: dispute.resolution_notes,
      resolvedAt: dispute.resolved_at ? dispute.resolved_at.toISOString() : null,
      createdAt: dispute.created_at.toISOString(),
      evidence,
    };
  }
}
