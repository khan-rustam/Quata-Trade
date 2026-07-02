import { Inject, Injectable } from "@nestjs/common";
import type { Kysely } from "kysely";
import type { DisputeResolution, DisputeStatus, Pagination, TradeStatus } from "@quatatrade/shared";
import { DB } from "../../db/database.module";
import type { Database } from "../../db/types";
import { newId } from "../../common/ids";
import { AuditService } from "../../common/audit/audit.service";
import { EscrowService } from "../escrow/escrow.service";
import { ConflictingResolutionError, DisputeNotFoundError } from "./disputes.errors";

export interface DisputeQueueRow {
  id: string;
  tradeId: string;
  tradeShortRef: string;
  tradeStatus: TradeStatus;
  /** crypto amount frozen in escrow — bigint as wire string */
  amount: string;
  openedBy: string;
  reason: string;
  status: DisputeStatus;
  createdAt: string;
}

export interface DisputeQueuePage {
  items: DisputeQueueRow[];
  page: number;
  pageSize: number;
  total: number;
}

export interface ResolveResult {
  disputeId: string;
  tradeId: string;
  resolution: DisputeResolution;
  /** true when a previous resolve already applied — nothing changed this call */
  alreadyResolved: boolean;
}

/**
 * disputes (admin side) — NO HTTP here. The admin module exposes
 * GET /admin/disputes and POST /admin/disputes/:id/resolve behind
 * @Roles("SUPER_ADMIN","COMPLIANCE_ADMIN","SUPPORT_ADMIN") per the RBAC matrix.
 * resolve() moves money ONLY via EscrowService.resolveDispute — this module
 * never writes ledger tables or trades.status.
 */
@Injectable()
export class DisputesAdminService {
  constructor(
    @Inject(DB) private readonly db: Kysely<Database>,
    private readonly escrow: EscrowService,
    private readonly audit: AuditService,
  ) {}

  /** Open work queue (everything not yet RESOLVED), oldest first. */
  async queue(pagination: Pagination): Promise<DisputeQueuePage> {
    const base = this.db
      .selectFrom("disputes")
      .innerJoin("trades", "trades.id", "disputes.trade_id")
      .where("disputes.status", "!=", "RESOLVED");

    const [rows, count] = await Promise.all([
      base
        .select([
          "disputes.id as id",
          "disputes.trade_id as trade_id",
          "trades.short_ref as short_ref",
          "trades.status as trade_status",
          "trades.amount as amount",
          "disputes.opened_by as opened_by",
          "disputes.reason as reason",
          "disputes.status as status",
          "disputes.created_at as created_at",
        ])
        .orderBy("disputes.created_at", "asc")
        .limit(pagination.pageSize)
        .offset((pagination.page - 1) * pagination.pageSize)
        .execute(),
      base.select((eb) => eb.fn.countAll<bigint>().as("n")).executeTakeFirstOrThrow(),
    ]);

    return {
      items: rows.map((r) => ({
        id: r.id,
        tradeId: r.trade_id,
        tradeShortRef: r.short_ref,
        tradeStatus: r.trade_status,
        amount: r.amount.toString(),
        openedBy: r.opened_by,
        reason: r.reason,
        status: r.status,
        createdAt: r.created_at.toISOString(),
      })),
      page: pagination.page,
      pageSize: pagination.pageSize,
      total: Number(count.n),
    };
  }

  /**
   * Resolve a dispute. Two idempotent steps that are each safe to retry:
   *  1. escrow.resolveDispute — THE only money path (DISPUTED → RESOLVED_*,
   *     deterministic idempotency key, re-resolve with same outcome = no-op,
   *     different outcome = IllegalTransitionError).
   *  2. Follow-up disputes-row write, guarded by `status != 'RESOLVED'` so a
   *     crash between 1 and 2 heals on retry and a concurrent duplicate
   *     resolve records outbox/audit exactly once.
   */
  async resolve(
    disputeId: string,
    adminId: string,
    resolution: DisputeResolution,
    notes: string,
  ): Promise<ResolveResult> {
    const dispute = await this.db
      .selectFrom("disputes")
      .selectAll()
      .where("id", "=", disputeId)
      .executeTakeFirst();
    if (!dispute) throw new DisputeNotFoundError();

    if (dispute.status === "RESOLVED") {
      if (dispute.resolution === resolution) {
        return { disputeId, tradeId: dispute.trade_id, resolution, alreadyResolved: true };
      }
      throw new ConflictingResolutionError(); // never silently flip an outcome
    }

    // 1. Money + trade FSM — escrow only. Deterministic key ⇒ retry-safe.
    await this.escrow.resolveDispute(dispute.trade_id, adminId, resolution, `dispute:${disputeId}:resolve`);

    // 2. Idempotent follow-up write on the disputes row (+ outbox + audit once).
    let applied = false;
    await this.db.transaction().execute(async (trx) => {
      const updated = await trx
        .updateTable("disputes")
        .set({
          status: "RESOLVED",
          resolution,
          resolved_by: adminId,
          resolution_notes: notes,
          resolved_at: new Date(),
        })
        .where("id", "=", disputeId)
        .where("status", "!=", "RESOLVED")
        .executeTakeFirst();
      if (updated.numUpdatedRows === 0n) return; // another resolve already recorded it

      applied = true;
      await trx
        .insertInto("outbox")
        .values({
          id: newId(),
          event_type: "dispute.resolved",
          payload: JSON.stringify({
            disputeId,
            tradeId: dispute.trade_id,
            resolution,
            resolvedBy: adminId,
          }),
        })
        .execute();
      await this.audit.log(
        {
          actorType: "admin",
          actorId: adminId,
          action: "dispute.resolved",
          targetType: "dispute",
          targetId: disputeId,
          metadata: { tradeId: dispute.trade_id, resolution },
        },
        trx,
      );
    });

    return { disputeId, tradeId: dispute.trade_id, resolution, alreadyResolved: !applied };
  }
}
