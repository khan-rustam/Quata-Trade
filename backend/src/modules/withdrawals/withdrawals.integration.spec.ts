import { randomBytes } from "node:crypto";
import { ConfigService } from "@nestjs/config";
import { sql } from "kysely";
import * as argon2 from "argon2";
import { authenticator } from "otplib";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { AdminRole, WithdrawalRequest } from "@quatatrade/shared";
import { newId } from "../../common/ids";
import { startTestDb, type TestDb } from "../../../test/helpers/pg";
import { createAdmin, createUser } from "../../../test/helpers/fixtures";
import { validateEnv, type Env } from "../../config/env";
import { AuditService } from "../../common/audit/audit.service";
import { LedgerService } from "../ledger/ledger.service";
import { SettingsService } from "../settings/settings.service";
import { ScreeningService } from "../screening/screening.service";
import { PromoService } from "../promo/promo.service";
import { BlockedAddressError } from "../screening/screening.errors";
import { MockSignerService } from "../signer/mock-signer.service";
import { WithdrawalPipelineService } from "../signer/withdrawal-pipeline.service";
import { encryptSecret } from "../../common/crypto";
import { WithdrawalsService, type WithdrawalRow } from "./withdrawals.service";
import {
  ApprovalNotAllowedError,
  DualApprovalError,
  IdempotencyConflictError,
  IllegalWithdrawalStateError,
  InvalidWithdrawalAddressError,
  WithdrawalCapExceededError,
  WithdrawalsPausedError,
  WithdrawalVerificationError,
} from "./withdrawals.errors";

/**
 * Phase 3 — withdrawals pipeline (Documents/05, 06 "withdrawals", 08 §D/§E).
 * Debit-at-request, caps, dual approval, mock-signer policy independence,
 * settle/refund idempotency, kill switch.
 */
describe("Withdrawals (Phase 3)", () => {
  const USDT = 1_000_000n;
  const FEE = 1n * USDT; // seeded settings: withdrawal_fee.USDT_TRC20 = 1 USDT
  const DEST = "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t"; // valid base58check TRON address
  const OWN_DEPOSIT_ADDRESS = "TEkxiTehnzSmSe2XqrBj4w32RUN966rdz8";
  const PIN = "123456";
  const MASTER_KEY = randomBytes(32);
  const DEFAULT_CAPS = {
    per_tx_max: "1000000000",
    daily_max: "2000000000",
    dual_approval_threshold: "500000000",
    auto_approve_below: "0",
  };

  let t: TestDb;
  let ledger: LedgerService;
  let settings: SettingsService;
  let audit: AuditService;
  let withdrawals: WithdrawalsService;
  let pipeline: WithdrawalPipelineService;
  let externalId: string;
  let pinHash: string;
  const totpSecrets = new Map<string, string>();

  beforeAll(async () => {
    t = await startTestDb();
    ledger = new LedgerService(t.db);
    settings = new SettingsService(t.db);
    audit = new AuditService(t.db);
    const env = validateEnv({
      DATABASE_URL: "postgres://unused:unused@localhost:5432/unused",
      JWT_ACCESS_SECRET: "integration_test_secret_0123456789abcdef",
      MASTER_ENCRYPTION_KEY: MASTER_KEY.toString("base64"),
      USDT_TRC20_CONTRACT: DEST,
    });
    const config = new ConfigService<Env, true>(env);
    const screening = new ScreeningService(t.db);
    withdrawals = new WithdrawalsService(t.db, ledger, settings, audit, config, screening, new PromoService(settings));
    const signer = new MockSignerService(config, t.db, settings);
    pipeline = new WithdrawalPipelineService(withdrawals, settings, signer);
    externalId = await ledger.getOrCreateAccount(null, "external", "USDT_TRC20");
    pinHash = await argon2.hash(PIN, { type: argon2.argon2id });
  });

  afterAll(async () => {
    await t.stop();
  });

  // ------------------------------------------------------------------ helpers

  async function fundedUser(amount: bigint, tier = 3): Promise<string> {
    const userId = await createUser(t.db);
    const secret = authenticator.generateSecret();
    totpSecrets.set(userId, secret);
    await t.db
      .updateTable("users")
      .set({
        kyc_tier: tier,
        email_verified_at: new Date(),
        totp_enabled: true,
        totp_secret_enc: encryptSecret(secret, MASTER_KEY.toString("base64")),
        pin_hash: pinHash,
      })
      .where("id", "=", userId)
      .execute();
    // Whitelist the shared test destination, already past its cooldown, so withdrawals proceed.
    await t.db
      .insertInto("withdrawal_addresses")
      .values({
        id: newId(),
        user_id: userId,
        asset: "USDT_TRC20",
        address: DEST,
        label: null,
        usable_at: new Date(Date.now() - 60_000),
      })
      .execute();
    if (amount > 0n) {
      const acc = await ledger.getOrCreateAccount(userId, "user_available", "USDT_TRC20");
      await ledger.postJournal({
        reason: "deposit_credit",
        referenceType: "test",
        referenceId: newId(),
        idempotencyKey: `fund-${newId()}`,
        createdBy: "system",
        asset: "USDT_TRC20",
        legs: [
          { accountId: externalId, amount: -amount },
          { accountId: acc, amount },
        ],
      });
    }
    return userId;
  }

  function totpFor(userId: string): string {
    const secret = totpSecrets.get(userId);
    if (!secret) throw new Error(`no TOTP secret for user ${userId}`);
    return authenticator.generate(secret);
  }

  const request = (userId: string, amount: bigint, overrides: Partial<WithdrawalRequest> = {}) =>
    withdrawals.request(userId, {
      asset: "USDT_TRC20",
      toAddress: DEST,
      amount: amount.toString(),
      totpCode: totpFor(userId),
      pin: PIN,
      idempotencyKey: `wd-${newId()}`,
      ...overrides,
    });

  const available = async (userId: string) =>
    ledger.balanceOf(await ledger.getOrCreateAccount(userId, "user_available", "USDT_TRC20"));
  const sweep = async () =>
    ledger.balanceOf(await ledger.getOrCreateAccount(null, "platform_pending_sweep", "USDT_TRC20"));
  const treasury = async () =>
    ledger.balanceOf(await ledger.getOrCreateAccount(null, "platform_treasury", "USDT_TRC20"));
  const external = async () => ledger.balanceOf(externalId);

  const row = async (id: string): Promise<WithdrawalRow> =>
    t.db.selectFrom("withdrawals").selectAll().where("id", "=", id).executeTakeFirstOrThrow();

  async function setSetting(key: string, value: unknown): Promise<void> {
    await t.db
      .updateTable("settings")
      .set({ value: JSON.stringify(value), updated_at: new Date() })
      .where("key", "=", key)
      .execute();
    settings.invalidate();
  }

  const approveAs = (id: string, adminId: string, role: AdminRole = "FINANCE_ADMIN") =>
    withdrawals.approve(id, adminId, role);

  // -------------------------------------------------------------------- tests

  it("request debits amount+fee into pending sweep ONCE; replay with the same key does not double-debit", async () => {
    const user = await fundedUser(1000n * USDT);
    const sweepBefore = await sweep();
    const key = `replay-${newId()}`;

    const wd = await request(user, 100n * USDT, { idempotencyKey: key });
    expect(wd.status).toBe("PENDING_APPROVAL");
    expect(wd.fee).toBe(FEE);
    expect(wd.debit_journal_id).not.toBeNull();
    expect(await available(user)).toBe(899n * USDT);
    expect((await sweep()) - sweepBefore).toBe(101n * USDT);

    // replay: same key → same row, nothing moves again
    const again = await request(user, 100n * USDT, { idempotencyKey: key });
    expect(again.id).toBe(wd.id);
    expect(await available(user)).toBe(899n * USDT);
    expect((await sweep()) - sweepBefore).toBe(101n * USDT);

    // exactly one debit journal for the key
    const journals = await t.db
      .selectFrom("journal_entries")
      .select((eb) => eb.fn.countAll<bigint>().as("n"))
      .where("idempotency_key", "=", key)
      .executeTakeFirstOrThrow();
    expect(Number(journals.n)).toBe(1);

    // a DIFFERENT user reusing the key is a conflict, not a leak
    const other = await fundedUser(50n * USDT);
    await expect(request(other, 10n * USDT, { idempotencyKey: key })).rejects.toBeInstanceOf(
      IdempotencyConflictError,
    );
    expect(await available(other)).toBe(50n * USDT);

    // reads are owner-scoped (IDOR)
    expect(await withdrawals.getForUser(wd.id, other)).toBeNull();
    const list = await withdrawals.listForUser(user, 1, 10);
    expect(list.items.map((r) => r.id)).toContain(wd.id);
    expect(list.items.every((r) => r.user_id === user)).toBe(true);
  });

  it("per-transaction cap is enforced before any debit", async () => {
    const user = await fundedUser(2000n * USDT);
    await expect(request(user, 1001n * USDT)).rejects.toBeInstanceOf(WithdrawalCapExceededError);
    expect(await available(user)).toBe(2000n * USDT);
  });

  it("daily cap counts today's non-rejected withdrawals; rejected ones free the cap again", async () => {
    const user = await fundedUser(5000n * USDT);
    const admin = await createAdmin(t.db, "FINANCE_ADMIN");

    await request(user, 800n * USDT);
    const second = await request(user, 800n * USDT); // 1600 of 2000
    await expect(request(user, 500n * USDT)).rejects.toBeInstanceOf(WithdrawalCapExceededError); // 2100 > 2000

    await withdrawals.reject(second.id, admin, "cap test cleanup"); // frees 800
    const third = await request(user, 500n * USDT); // 1300 of 2000 — allowed now
    expect(third.status).toBe("PENDING_APPROVAL");
  });

  it("KYC tier daily limit caps below the global daily cap", async () => {
    const user = await fundedUser(200n * USDT, 1); // tier 1 → 100 USDT/day
    const first = await request(user, 50n * USDT);
    expect(first.status).toBe("PENDING_APPROVAL");
    await expect(request(user, 60n * USDT)).rejects.toBeInstanceOf(WithdrawalCapExceededError); // 110 > 100
  });

  it("risk scoring: large first withdrawal vs tier limit lands in RISK_HOLD; admin approval releases it", async () => {
    const user = await fundedUser(200n * USDT, 1);
    const wd = await request(user, 90n * USDT); // 90% of tier limit + first withdrawal → score 70
    expect(wd.status).toBe("RISK_HOLD");
    expect(wd.risk_score).toBeGreaterThanOrEqual(70);
    expect(wd.risk_flags).not.toBeNull();
    // funds are still debited while on hold
    expect(await available(user)).toBe(200n * USDT - 91n * USDT);

    const admin = await createAdmin(t.db, "FINANCE_ADMIN");
    const approved = await approveAs(wd.id, admin); // < dual threshold → single approval
    expect(approved.status).toBe("APPROVED");
    expect(approved.approved_by).toBe(admin);
  });

  it("TOTP and PIN failures are identical generic errors; 5 wrong PINs lock; nothing is ever debited", async () => {
    const user = await fundedUser(100n * USDT);

    await expect(request(user, 10n * USDT, { totpCode: "000000" })).rejects.toThrow("verification failed");

    for (let i = 0; i < 5; i += 1) {
      await expect(request(user, 10n * USDT, { pin: "999999" })).rejects.toThrow("verification failed");
    }
    // locked now: even the CORRECT pin fails, with the same generic message
    await expect(request(user, 10n * USDT)).rejects.toBeInstanceOf(WithdrawalVerificationError);
    expect(await available(user)).toBe(100n * USDT);
    const userRow = await t.db.selectFrom("users").selectAll().where("id", "=", user).executeTakeFirstOrThrow();
    expect(userRow.pin_locked_until).not.toBeNull();
  });

  it("address validation: bad checksum and our own deposit addresses are refused", async () => {
    const user = await fundedUser(100n * USDT);
    await expect(request(user, 10n * USDT, { toAddress: `T${"1".repeat(33)}` })).rejects.toBeInstanceOf(
      InvalidWithdrawalAddressError,
    );

    await t.db
      .insertInto("deposit_addresses")
      .values({
        id: newId(),
        user_id: user,
        asset: "USDT_TRC20",
        address: OWN_DEPOSIT_ADDRESS,
        derivation_index: 0,
        derivation_path: "m/44'/195'/0'/0/0",
      })
      .execute();
    await expect(request(user, 10n * USDT, { toAddress: OWN_DEPOSIT_ADDRESS })).rejects.toBeInstanceOf(
      InvalidWithdrawalAddressError,
    );
    expect(await available(user)).toBe(100n * USDT);
  });

  it("AML: a blacklisted destination is refused at request time and nothing is debited", async () => {
    const user = await fundedUser(100n * USDT);
    const screening = new ScreeningService(t.db);
    const blocked = await screening.block(
      { asset: "USDT_TRC20", address: DEST, category: "sanctions", reason: "test SDN match" },
      "admin-aml",
    );
    await expect(request(user, 10n * USDT)).rejects.toBeInstanceOf(BlockedAddressError);
    expect(await available(user)).toBe(100n * USDT); // debit never happened
    await screening.unblock(blocked.id); // restore DEST for later tests
  });

  it("dual approval: >= threshold needs two DIFFERENT admins; single or repeated admin cannot release", async () => {
    const user = await fundedUser(1000n * USDT);
    const wd = await request(user, 600n * USDT); // >= 500 USDT threshold
    expect(wd.status).toBe("PENDING_APPROVAL");

    const admin1 = await createAdmin(t.db, "FINANCE_ADMIN");
    const admin2 = await createAdmin(t.db, "COMPLIANCE_ADMIN");

    // first approval: recorded, but NOT approved — pipeline must not touch it
    const first = await approveAs(wd.id, admin1);
    expect(first.status).toBe("PENDING_APPROVAL");
    expect(first.approved_by).toBe(admin1);
    await pipeline.run();
    expect((await row(wd.id)).status).toBe("PENDING_APPROVAL");

    // the same admin approving twice is rejected
    await expect(approveAs(wd.id, admin1)).rejects.toBeInstanceOf(DualApprovalError);

    // DB trigger backstop: raw flip to APPROVED without a second approver fails
    await expect(
      sql`UPDATE withdrawals SET status = 'APPROVED' WHERE id = ${wd.id}`.execute(t.db),
    ).rejects.toThrow(/two distinct approvers/);

    // a DIFFERENT admin (COMPLIANCE may 2nd-approve per the RBAC matrix) completes it
    const second = await approveAs(wd.id, admin2, "COMPLIANCE_ADMIN");
    expect(second.status).toBe("APPROVED");
    expect(second.second_approver).toBe(admin2);
  });

  it("below threshold a single allowed admin approves; disallowed roles cannot", async () => {
    const user = await fundedUser(300n * USDT);
    const wd = await request(user, 100n * USDT);
    const analyst = await createAdmin(t.db, "ANALYST");
    await expect(approveAs(wd.id, analyst, "ANALYST")).rejects.toBeInstanceOf(ApprovalNotAllowedError);

    const finance = await createAdmin(t.db, "FINANCE_ADMIN");
    const approved = await approveAs(wd.id, finance);
    expect(approved.status).toBe("APPROVED");
    expect(approved.approved_by).toBe(finance);
    expect(approved.second_approver).toBeNull();
  });

  it("dual_approval_threshold is enforced LIVE by the trigger — raising it lets one admin approve in the new band (B27)", async () => {
    // Raise the threshold above the (formerly hardcoded) 500M. A 600M withdrawal that
    // previously needed two approvers must now single-approve WITHOUT the DB rejecting
    // it — under the old `big_needs_two` CHECK this APPROVE would have thrown 23514.
    await setSetting("withdrawal_caps", { ...DEFAULT_CAPS, dual_approval_threshold: "700000000" });
    try {
      const user = await fundedUser(1000n * USDT);
      const wd = await request(user, 600n * USDT); // 600M: >= old 500M, < new 700M
      expect(wd.status).toBe("PENDING_APPROVAL");

      const finance = await createAdmin(t.db, "FINANCE_ADMIN");
      const approved = await approveAs(wd.id, finance);
      expect(approved.status).toBe("APPROVED"); // single approval now suffices — DB agrees
      expect(approved.second_approver).toBeNull();
    } finally {
      await setSetting("withdrawal_caps", DEFAULT_CAPS);
    }
  });

  it("reject refunds amount+fee exactly once (idempotent), and a rejected row cannot be approved", async () => {
    const user = await fundedUser(300n * USDT);
    const wd = await request(user, 100n * USDT);
    expect(await available(user)).toBe(199n * USDT);

    const admin = await createAdmin(t.db, "FINANCE_ADMIN");
    const rejected = await withdrawals.reject(wd.id, admin, "suspicious destination");
    expect(rejected.status).toBe("REJECTED");
    expect(rejected.failure_reason).toBe("suspicious destination");
    expect(await available(user)).toBe(300n * USDT);

    // second reject: no-op, no second refund
    const again = await withdrawals.reject(wd.id, admin, "suspicious destination");
    expect(again.status).toBe("REJECTED");
    expect(await available(user)).toBe(300n * USDT);
    const refunds = await t.db
      .selectFrom("journal_entries")
      .select((eb) => eb.fn.countAll<bigint>().as("n"))
      .where("idempotency_key", "=", `withdrawal:${wd.id}:refund`)
      .executeTakeFirstOrThrow();
    expect(Number(refunds.n)).toBe(1);

    await expect(approveAs(wd.id, admin)).rejects.toBeInstanceOf(IllegalWithdrawalStateError);
  });

  it("pipeline: approve → mock sign → CONFIRMED settles amount to external + fee to treasury; totals conserved", async () => {
    await pipeline.run(); // drain APPROVED rows left by earlier tests before taking baselines
    const user = await fundedUser(500n * USDT);
    const treasuryBefore = await treasury();
    const externalBefore = await external();
    const sweepBefore = await sweep();

    const wd = await request(user, 100n * USDT);
    const admin = await createAdmin(t.db, "FINANCE_ADMIN");
    await approveAs(wd.id, admin);

    await pipeline.run();
    const done = await row(wd.id);
    expect(done.status).toBe("CONFIRMED");
    expect(done.tx_hash).toMatch(/^mock_[0-9a-f]{64}$/);

    const userDelta = (await available(user)) - 500n * USDT; // −101
    const treasuryDelta = (await treasury()) - treasuryBefore; // +1 (fee)
    const externalDelta = (await external()) - externalBefore; // +100
    const sweepDelta = (await sweep()) - sweepBefore; // 0 — fully swept through
    expect(userDelta).toBe(-(101n * USDT));
    expect(treasuryDelta).toBe(FEE);
    expect(externalDelta).toBe(100n * USDT);
    expect(sweepDelta).toBe(0n);
    expect(userDelta + treasuryDelta + externalDelta + sweepDelta).toBe(0n); // conservation

    // re-running the pipeline is a no-op (guarded transitions + settle key)
    await pipeline.run();
    expect((await treasury()) - treasuryBefore).toBe(FEE);
    expect(await available(user)).toBe(399n * USDT);
    const settles = await t.db
      .selectFrom("journal_entries")
      .select((eb) => eb.fn.countAll<bigint>().as("n"))
      .where("idempotency_key", "=", `withdrawal:${wd.id}:settle`)
      .executeTakeFirstOrThrow();
    expect(Number(settles.n)).toBe(1);
  });

  it("signer independently refuses when caps shrink after approval → FAILED + refunded once", async () => {
    const user = await fundedUser(600n * USDT);
    const wd = await request(user, 400n * USDT);
    const admin = await createAdmin(t.db, "FINANCE_ADMIN");
    await approveAs(wd.id, admin);

    // "compromised API" scenario: policy tightens; the signer must refuse on its own read
    await setSetting("withdrawal_caps", { ...DEFAULT_CAPS, per_tx_max: "300000000" });
    try {
      await pipeline.run();
      const failed = await row(wd.id);
      expect(failed.status).toBe("FAILED");
      expect(failed.failure_reason).toMatch(/cap/);
      expect(failed.tx_hash).toBeNull();
      expect(await available(user)).toBe(600n * USDT); // amount+fee refunded in full
    } finally {
      await setSetting("withdrawal_caps", DEFAULT_CAPS);
    }
  });

  it("auto-approve below the configured threshold (approved_by stays null) and settles via pipeline", async () => {
    await setSetting("withdrawal_caps", { ...DEFAULT_CAPS, auto_approve_below: "50000000" });
    try {
      const user = await fundedUser(200n * USDT);
      const wd = await request(user, 10n * USDT);
      expect(wd.status).toBe("APPROVED");
      expect(wd.approved_by).toBeNull();

      await pipeline.run();
      expect((await row(wd.id)).status).toBe("CONFIRMED");
    } finally {
      await setSetting("withdrawal_caps", DEFAULT_CAPS);
    }
  });

  it("kill switch blocks new requests AND halts the pipeline until lifted", async () => {
    const user = await fundedUser(300n * USDT);
    const wd = await request(user, 100n * USDT);
    const admin = await createAdmin(t.db, "FINANCE_ADMIN");
    await approveAs(wd.id, admin);

    await setSetting("kill_switches", { withdrawals_paused: true, trades_paused: false });
    try {
      await expect(request(user, 10n * USDT)).rejects.toBeInstanceOf(WithdrawalsPausedError);
      await pipeline.run();
      expect((await row(wd.id)).status).toBe("APPROVED"); // untouched while paused
    } finally {
      await setSetting("kill_switches", { withdrawals_paused: false, trades_paused: false });
    }

    await pipeline.run();
    expect((await row(wd.id)).status).toBe("CONFIRMED");
  });
});
