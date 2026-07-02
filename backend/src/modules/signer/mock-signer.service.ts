import { createHash } from "node:crypto";
import { Injectable } from "@nestjs/common";
import type { ConfigService } from "@nestjs/config";
import type { Kysely } from "kysely";
import type { Env } from "../../config/env";
import type { Database } from "../../db/types";
import { SettingsService } from "../settings/settings.service";
import { SignerRefusalError, type SignerClient } from "./signer.types";

/**
 * Dev/testnet ONLY (SIGNER_MODE=mock). Simulates the human-authored signer's
 * INDEPENDENT policy re-verification (backend/SIGNER.md): it re-reads the
 * withdrawal row itself and refuses unless every check passes — regardless of
 * what the caller claims. Returns a deterministic fake tx hash; no keys exist.
 *
 * NOTE: the pipeline marks the row SIGNING as its crash-safe claim BEFORE the
 * signer call, so the mock accepts APPROVED or SIGNING. The real Host B signer
 * must be written against the same handoff (it will observe SIGNING).
 */
@Injectable()
export class MockSignerService implements SignerClient {
  readonly mode = "mock" as const;

  constructor(
    config: ConfigService<Env, true>,
    private readonly db: Kysely<Database>,
    private readonly settings: SettingsService,
  ) {
    // Defense in depth on top of validateEnv's production hard-stop.
    if (config.get("NODE_ENV", { infer: true }) === "production") {
      throw new Error("MockSignerService must never be constructed in production (backend/SIGNER.md)");
    }
  }

  async signWithdrawal(withdrawalId: string): Promise<{ txHash: string }> {
    // Independent re-read — never trust the caller's copy of the row.
    const wd = await this.db
      .selectFrom("withdrawals")
      .selectAll()
      .where("id", "=", withdrawalId)
      .executeTakeFirst();
    if (!wd) throw new SignerRefusalError("unknown withdrawal");
    if (wd.status !== "APPROVED" && wd.status !== "SIGNING") {
      throw new SignerRefusalError(`status ${wd.status} is not approved for signing`);
    }

    const caps = await this.settings.withdrawalCaps();
    if (wd.amount > caps.perTxMax) {
      throw new SignerRefusalError("per-transaction cap exceeded");
    }
    if (wd.amount >= caps.dualApprovalThreshold) {
      if (!wd.second_approver || wd.second_approver === wd.approved_by) {
        throw new SignerRefusalError("dual approval not satisfied");
      }
    }
    const ownAddress = await this.db
      .selectFrom("deposit_addresses")
      .select("id")
      .where("address", "=", wd.to_address)
      .executeTakeFirst();
    if (ownAddress) throw new SignerRefusalError("destination is a platform deposit address");

    return { txHash: `mock_${createHash("sha256").update(wd.id).digest("hex")}` };
  }

  health(): Promise<boolean> {
    return Promise.resolve(true);
  }
}
