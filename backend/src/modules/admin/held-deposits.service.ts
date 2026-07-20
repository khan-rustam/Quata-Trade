import { Inject, Injectable } from "@nestjs/common";
import type { Kysely } from "kysely";
import type { AdminHeldDepositQuery, AdminHeldDepositRow } from "@quatatrade/shared";
import { DB } from "../../db/database.module";
import type { Database } from "../../db/types";
import { newId } from "../../common/ids";
import { AuditService } from "../../common/audit/audit.service";
import { HeldDepositNotFoundError, HeldDepositAlreadyResolvedError } from "./admin.errors";

/**
 * Held-deposit review queue (audit M1).
 *
 * A deposit parked by source screening (`aml_hold`) or by the amount/limit
 * policy (`policy_hold`) is skipped by DepositConfirmationService on every tick.
 * Before this service nothing could clear either flag, so held funds sat
 * on-chain and permanently uncreditable with no operator path out.
 *
 * This is the ONLY exit from a hold. It never posts to the ledger itself:
 * RELEASE clears the flags and hands the deposit back to the normal
 * confirmation/credit path (which still re-verifies the transaction on-chain
 * and still applies the twin/idempotency guards). REJECT leaves the flags set
 * so the deposit stays permanently uncreditable, and only records who decided.
 */
@Injectable()
export class HeldDepositsService {
  constructor(
    @Inject(DB) private readonly db: Kysely<Database>,
    private readonly audit: AuditService,
  ) {}

  /** Open review queue: held AND not yet decided. Oldest first — FIFO for users. */
  async queue(query: AdminHeldDepositQuery): Promise<{ items: AdminHeldDepositRow[]; total: number }> {
    const base = this.db
      .selectFrom("deposits")
      .innerJoin("users", "users.id", "deposits.user_id")
      .where("deposits.hold_resolution", "is", null)
      .$if(query.hold === "aml", (qb) => qb.where("deposits.aml_hold", "=", true))
      .$if(query.hold === "policy", (qb) => qb.where("deposits.policy_hold", "=", true))
      .$if(query.hold === "all", (qb) =>
        qb.where((eb) => eb.or([eb("deposits.aml_hold", "=", true), eb("deposits.policy_hold", "=", true)])),
      );

    const totalRow = await base.select((eb) => eb.fn.countAll<bigint>().as("n")).executeTakeFirst();
    const rows = await base
      .select([
        "deposits.id",
        "deposits.user_id",
        "users.email",
        "deposits.asset",
        "deposits.amount",
        "deposits.address",
        "deposits.tx_hash",
        "deposits.from_address",
        "deposits.confirmations",
        "deposits.aml_hold",
        "deposits.aml_reason",
        "deposits.policy_hold",
        "deposits.policy_reason",
        "deposits.created_at",
      ])
      .orderBy("deposits.created_at", "asc")
      .limit(query.pageSize)
      .offset((query.page - 1) * query.pageSize)
      .execute();

    return {
      total: Number(totalRow?.n ?? 0),
      items: rows.map((r) => ({
        id: r.id,
        userId: r.user_id,
        userEmail: r.email,
        asset: r.asset,
        amount: r.amount.toString(), // BIGINT smallest units — string over the wire
        address: r.address,
        txHash: r.tx_hash,
        fromAddress: r.from_address,
        confirmations: r.confirmations,
        amlHold: r.aml_hold,
        amlReason: r.aml_reason,
        policyHold: r.policy_hold,
        policyReason: r.policy_reason,
        createdAt: r.created_at.toISOString(),
      })),
    };
  }

  /**
   * RELEASE: credit this deposit despite the hold.
   *
   * Clears both flags so the confirmation job picks the row up again, and stamps
   * hold_resolution=RELEASED, which tells the credit path to skip re-screening
   * and the amount policy — the deterministic rule that created the hold would
   * otherwise fire again on the next tick and re-hold it forever.
   *
   * Crediting still goes through the normal path: on-chain re-verification,
   * confirmation depth, the twin guard and the ledger idempotency key all still
   * apply, so a release can never double-credit or credit a reorged-out transfer.
   */
  async release(depositId: string, adminId: string, reason: string, ip?: string): Promise<AdminHeldDepositRow> {
    return this.decide(depositId, adminId, "RELEASED", reason, ip);
  }

  /**
   * REJECT: never credit this deposit.
   *
   * The hold flags stay SET (that is what keeps the confirmation job skipping
   * it); only the resolution is recorded, which removes it from the queue. No
   * ledger entry is written and no funds move — rejecting is a refusal to
   * credit, not a refund. Returning tainted funds is a separate, manual
   * treasury action by design.
   */
  async reject(depositId: string, adminId: string, reason: string, ip?: string): Promise<AdminHeldDepositRow> {
    return this.decide(depositId, adminId, "REJECTED", reason, ip);
  }

  private async decide(
    depositId: string,
    adminId: string,
    resolution: "RELEASED" | "REJECTED",
    reason: string,
    ip?: string,
  ): Promise<AdminHeldDepositRow> {
    return this.db.transaction().execute(async (trx) => {
      // Row lock: two admins clicking release/reject at once must not both decide.
      const deposit = await trx
        .selectFrom("deposits")
        .selectAll()
        .where("id", "=", depositId)
        .forUpdate()
        .executeTakeFirst();
      if (!deposit || (!deposit.aml_hold && !deposit.policy_hold)) throw new HeldDepositNotFoundError(depositId);
      if (deposit.hold_resolution !== null) throw new HeldDepositAlreadyResolvedError(deposit.hold_resolution);

      await trx
        .updateTable("deposits")
        .set({
          hold_resolution: resolution,
          hold_resolution_reason: reason,
          hold_resolved_by: adminId,
          hold_resolved_at: new Date(),
          // Only a release re-opens the credit path; a rejection keeps the flags
          // set so the confirmation job continues to skip the row.
          ...(resolution === "RELEASED" ? { aml_hold: false, policy_hold: false } : {}),
          updated_at: new Date(),
        })
        .where("id", "=", depositId)
        .where("hold_resolution", "is", null) // re-assert under the lock
        .execute();

      await this.audit.log(
        {
          actorType: "admin",
          actorId: adminId,
          action: resolution === "RELEASED" ? "deposit.hold_release" : "deposit.hold_reject",
          targetType: "deposit",
          targetId: depositId,
          ip,
          metadata: {
            userId: deposit.user_id,
            asset: deposit.asset,
            amount: deposit.amount.toString(),
            txHash: deposit.tx_hash,
            amlReason: deposit.aml_reason,
            policyReason: deposit.policy_reason,
            reason,
          },
        },
        trx,
      );

      const user = await trx
        .selectFrom("users")
        .select("email")
        .where("id", "=", deposit.user_id)
        .executeTakeFirst();

      await trx
        .insertInto("outbox")
        .values({
          id: newId(),
          event_type: resolution === "RELEASED" ? "deposit.hold_released" : "deposit.hold_rejected",
          payload: JSON.stringify({
            depositId,
            userId: deposit.user_id,
            asset: deposit.asset,
            amount: deposit.amount.toString(),
            adminId,
            reason,
          }),
        })
        .execute();

      return {
        id: deposit.id,
        userId: deposit.user_id,
        userEmail: user?.email ?? "",
        asset: deposit.asset,
        amount: deposit.amount.toString(),
        address: deposit.address,
        txHash: deposit.tx_hash,
        fromAddress: deposit.from_address,
        confirmations: deposit.confirmations,
        amlHold: resolution === "RELEASED" ? false : deposit.aml_hold,
        amlReason: deposit.aml_reason,
        policyHold: resolution === "RELEASED" ? false : deposit.policy_hold,
        policyReason: deposit.policy_reason,
        createdAt: deposit.created_at.toISOString(),
      };
    });
  }
}
