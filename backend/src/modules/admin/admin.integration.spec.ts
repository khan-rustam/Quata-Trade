import "reflect-metadata";
import { randomBytes } from "node:crypto";
import { ForbiddenException, type Type } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { ExecutionContextHost } from "@nestjs/core/helpers/execution-context-host";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import * as argon2 from "argon2";
import { authenticator } from "otplib";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { ADMIN_ROLES, type AdminRole } from "@quatatrade/shared";
import { startTestDb, type TestDb } from "../../../test/helpers/pg";
import { createUser } from "../../../test/helpers/fixtures";
import { validateEnv, type Env } from "../../config/env";
import { newId } from "../../common/ids";
import { encryptSecret } from "../../common/crypto";
import { AuditService } from "../../common/audit/audit.service";
import { RolesGuard } from "../../common/auth/roles.guard";
import { IS_PUBLIC_KEY } from "../../common/auth/decorators";
import type { AccessTokenPayload, AuthenticatedRequest } from "../../common/auth/jwt.types";
import { LedgerService } from "../ledger/ledger.service";
import { InsufficientFundsError } from "../ledger/ledger.errors";
import { SettingsService } from "../settings/settings.service";
import { CountriesService } from "../countries/countries.service";
import { ScreeningService } from "../screening/screening.service";
import { WithdrawalsService } from "../withdrawals/withdrawals.service";
import { ApprovalNotAllowedError, DualApprovalError } from "../withdrawals/withdrawals.errors";
import { AdminAuthService } from "./admin-auth.service";
import { AdminService } from "./admin.service";
import { AdminAuthController } from "./admin-auth.controller";
import { AdminController } from "./admin.controller";
import { TreasuryController } from "../treasury/treasury.controller";
import {
  AdminAuthError,
  AdminVerificationError,
  CountryNotFoundError,
  InvalidSettingValueError,
  SettingKeyNotAllowedError,
  TargetUserNotFoundError,
} from "./admin.errors";

const ALL7: readonly AdminRole[] = ADMIN_ROLES;

type Handler = (...args: never[]) => unknown;

/**
 * Phase 6 — admin + treasury (Documents/06 RBAC matrix, 08 §E).
 * Part 1: guard-level matrix — every protected route x every role, allow AND
 * deny, straight off the real @Roles metadata through the real RolesGuard.
 * Part 2: end-to-end service flows on a real PG16 (Testcontainers):
 * admin login, dual approval, kill switch, ledger adjustment.
 */
describe("admin RBAC matrix (RolesGuard x route metadata)", () => {
  const guard = new RolesGuard(new Reflector());

  function allows(cls: Type<unknown>, handler: Handler, auth: AccessTokenPayload): boolean {
    const req: AuthenticatedRequest = { auth, headers: {} };
    const ctx = new ExecutionContextHost([req], cls, handler);
    try {
      return guard.canActivate(ctx);
    } catch (err) {
      if (err instanceof ForbiddenException) return false;
      throw err;
    }
  }

  // Expected allow-lists copied from Documents/06 §RBAC matrix — NOT from
  // admin.rbac.ts, so drift between code and doc fails here.
  const cases: Array<{ name: string; cls: Type<unknown>; handler: Handler; allowed: readonly AdminRole[] }> = [
    { name: "GET /admin/me", cls: AdminController, handler: AdminController.prototype.me, allowed: ALL7 },
    { name: "GET /admin/kpis", cls: AdminController, handler: AdminController.prototype.kpis, allowed: ALL7 },
    { name: "GET /admin/users", cls: AdminController, handler: AdminController.prototype.users, allowed: ALL7 },
    { name: "GET /admin/trades", cls: AdminController, handler: AdminController.prototype.trades, allowed: ALL7 },
    {
      name: "GET /admin/withdrawals",
      cls: AdminController,
      handler: AdminController.prototype.withdrawalQueue,
      allowed: ALL7,
    },
    { name: "GET /admin/kyc/queue", cls: AdminController, handler: AdminController.prototype.kycQueue, allowed: ALL7 },
    {
      name: "GET /admin/kyc/:id/documents",
      cls: AdminController,
      handler: AdminController.prototype.kycDocuments,
      allowed: ["SUPER_ADMIN", "COMPLIANCE_ADMIN"],
    },
    {
      name: "GET /admin/disputes",
      cls: AdminController,
      handler: AdminController.prototype.disputeQueue,
      allowed: ALL7,
    },
    {
      name: "GET /admin/kill-switch",
      cls: AdminController,
      handler: AdminController.prototype.killSwitch,
      allowed: ALL7,
    },
    { name: "GET /admin/revenue", cls: TreasuryController, handler: TreasuryController.prototype.revenue, allowed: ALL7 },
    {
      name: "GET /admin/treasury/balances",
      cls: TreasuryController,
      handler: TreasuryController.prototype.balances,
      allowed: ALL7,
    },
    {
      name: "POST /admin/users/:id/freeze",
      cls: AdminController,
      handler: AdminController.prototype.freezeUser,
      allowed: ["SUPER_ADMIN", "COMPLIANCE_ADMIN", "SUPPORT_ADMIN", "MODERATOR"],
    },
    {
      name: "POST /admin/users/:id/suspend",
      cls: AdminController,
      handler: AdminController.prototype.suspendUser,
      allowed: ["SUPER_ADMIN", "COMPLIANCE_ADMIN", "SUPPORT_ADMIN", "MODERATOR"],
    },
    {
      name: "POST /admin/users/:id/restore",
      cls: AdminController,
      handler: AdminController.prototype.restoreUser,
      allowed: ["SUPER_ADMIN", "COMPLIANCE_ADMIN", "SUPPORT_ADMIN", "MODERATOR"],
    },
    {
      name: "POST /admin/kyc/:id/approve",
      cls: AdminController,
      handler: AdminController.prototype.kycApprove,
      allowed: ["SUPER_ADMIN", "COMPLIANCE_ADMIN"],
    },
    {
      name: "POST /admin/kyc/:id/reject",
      cls: AdminController,
      handler: AdminController.prototype.kycReject,
      allowed: ["SUPER_ADMIN", "COMPLIANCE_ADMIN"],
    },
    {
      name: "POST /admin/kyc/:id/resubmit",
      cls: AdminController,
      handler: AdminController.prototype.kycResubmit,
      allowed: ["SUPER_ADMIN", "COMPLIANCE_ADMIN"],
    },
    {
      // route admits the 2nd-approver set; the FIRST-approval stage being
      // SUPER+FINANCE only is enforced by WithdrawalsService (flow test below)
      name: "POST /admin/withdrawals/:id/approve",
      cls: AdminController,
      handler: AdminController.prototype.approveWithdrawal,
      allowed: ["SUPER_ADMIN", "FINANCE_ADMIN", "COMPLIANCE_ADMIN"],
    },
    {
      name: "POST /admin/withdrawals/:id/reject",
      cls: AdminController,
      handler: AdminController.prototype.rejectWithdrawal,
      allowed: ["SUPER_ADMIN", "FINANCE_ADMIN"],
    },
    {
      name: "POST /admin/disputes/:id/resolve",
      cls: AdminController,
      handler: AdminController.prototype.resolveDispute,
      allowed: ["SUPER_ADMIN", "COMPLIANCE_ADMIN", "SUPPORT_ADMIN"],
    },
    {
      name: "POST /admin/kill-switch",
      cls: AdminController,
      handler: AdminController.prototype.setKillSwitch,
      allowed: ["SUPER_ADMIN", "FINANCE_ADMIN"],
    },
    {
      name: "GET /admin/countries",
      cls: AdminController,
      handler: AdminController.prototype.countries,
      allowed: ALL7,
    },
    {
      name: "POST /admin/countries/:code",
      cls: AdminController,
      handler: AdminController.prototype.updateCountry,
      allowed: ["SUPER_ADMIN", "FINANCE_ADMIN"],
    },
    {
      name: "PATCH /admin/settings",
      cls: AdminController,
      handler: AdminController.prototype.updateSetting,
      allowed: ["SUPER_ADMIN", "FINANCE_ADMIN"],
    },
    {
      name: "GET /admin/audit-logs",
      cls: AdminController,
      handler: AdminController.prototype.auditLogs,
      allowed: ["SUPER_ADMIN", "COMPLIANCE_ADMIN", "AUDITOR"],
    },
    {
      name: "GET /admin/audit-logs/verify",
      cls: AdminController,
      handler: AdminController.prototype.verifyAuditChain,
      allowed: ["SUPER_ADMIN", "COMPLIANCE_ADMIN", "AUDITOR"],
    },
    {
      name: "POST /admin/ledger/adjustment",
      cls: AdminController,
      handler: AdminController.prototype.ledgerAdjustment,
      allowed: ["SUPER_ADMIN"],
    },
  ];

  it("enforces allow AND deny for every route x every role", () => {
    for (const c of cases) {
      for (const role of ALL7) {
        const expected = c.allowed.includes(role);
        const actual = allows(c.cls, c.handler, { sub: newId(), typ: "admin", role });
        expect(actual, `${c.name} x ${role} should be ${expected ? "allowed" : "denied"}`).toBe(expected);
      }
    }
  });

  it("rejects user-typed tokens on every admin route", () => {
    for (const c of cases) {
      const actual = allows(c.cls, c.handler, { sub: newId(), typ: "user", sid: newId() });
      expect(actual, `${c.name} must reject typ=user`).toBe(false);
    }
  });

  it("rejects admin tokens missing a role claim", () => {
    for (const c of cases) {
      expect(allows(c.cls, c.handler, { sub: newId(), typ: "admin" })).toBe(false);
    }
  });

  it("login is the only @Public() admin route", () => {
    const isPublic = Reflect.getMetadata(IS_PUBLIC_KEY, AdminAuthController.prototype.login) as unknown;
    expect(isPublic).toBe(true);
    for (const c of cases) {
      expect(Reflect.getMetadata(IS_PUBLIC_KEY, c.handler) as unknown).toBeUndefined();
    }
  });
});

describe("admin flows (Testcontainers PG16)", () => {
  const USDT = 1_000_000n;
  const PASSWORD = "Admin_Passw0rd!";
  const MASTER_KEY_B64 = randomBytes(32).toString("base64");
  const JWT_SECRET = "integration_test_secret_0123456789abcdef";

  let t: TestDb;
  let ledger: LedgerService;
  let settings: SettingsService;
  let audit: AuditService;
  let adminAuth: AdminAuthService;
  let admin: AdminService;
  let withdrawals: WithdrawalsService;
  let jwt: JwtService;
  let passwordHash: string;

  interface SeededAdmin {
    id: string;
    email: string;
    secret: string;
  }

  async function makeAdmin(role: AdminRole, active = true): Promise<SeededAdmin> {
    const id = newId();
    // full UUID in the email: UUIDv7 prefixes are timestamp bits and collide
    const email = `${role.toLowerCase()}-${id}@test.local`;
    const secret = authenticator.generateSecret();
    await t.db
      .insertInto("admins")
      .values({
        id,
        email,
        password_hash: passwordHash,
        role,
        totp_secret_enc: encryptSecret(secret, MASTER_KEY_B64),
        totp_enabled: true, // tests exercise the mandatory-TOTP path (login + step-up)
        active,
      })
      .execute();
    return { id, email, secret };
  }

  const code = (a: SeededAdmin) => authenticator.generate(a.secret);

  async function insertWithdrawal(userId: string, amount: bigint): Promise<string> {
    const id = newId();
    await t.db
      .insertInto("withdrawals")
      .values({
        id,
        user_id: userId,
        asset: "USDT_TRC20",
        to_address: "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t",
        amount,
        fee: 1n * USDT,
        status: "PENDING_APPROVAL",
        risk_score: 10,
        risk_flags: JSON.stringify({}),
        approved_by: null,
        second_approver: null,
        tx_hash: null,
        failure_reason: null,
        debit_journal_id: null,
        idempotency_key: `admin-spec-${newId()}`,
      })
      .execute();
    return id;
  }

  beforeAll(async () => {
    t = await startTestDb();
    ledger = new LedgerService(t.db);
    settings = new SettingsService(t.db);
    audit = new AuditService(t.db);
    const env = validateEnv({
      DATABASE_URL: "postgres://unused:unused@localhost:5432/unused",
      JWT_ACCESS_SECRET: JWT_SECRET,
      MASTER_ENCRYPTION_KEY: MASTER_KEY_B64,
      USDT_TRC20_CONTRACT: "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t",
    });
    const config = new ConfigService<Env, true>(env);
    jwt = new JwtService({ secret: JWT_SECRET, signOptions: { expiresIn: 600 } });
    adminAuth = new AdminAuthService(t.db, jwt, config, audit);
    admin = new AdminService(t.db, ledger, settings, audit, adminAuth, new CountriesService(t.db));
    withdrawals = new WithdrawalsService(t.db, ledger, settings, audit, config, new ScreeningService(t.db));
    passwordHash = await argon2.hash(PASSWORD, { type: argon2.argon2id });
  });

  afterAll(async () => {
    await t.stop();
  });

  // ── admin login ───────────────────────────────────────────────────────────

  it("logs in with password + mandatory TOTP and issues a typ=admin JWT", async () => {
    const a = await makeAdmin("FINANCE_ADMIN");
    const tokens = await adminAuth.login({ email: a.email, password: PASSWORD, totpCode: code(a) }, "127.0.0.1");
    expect(tokens.accessTokenExpiresIn).toBe(600);
    const payload = await jwt.verifyAsync<AccessTokenPayload>(tokens.accessToken);
    expect(payload.typ).toBe("admin");
    expect(payload.sub).toBe(a.id);
    expect(payload.role).toBe("FINANCE_ADMIN");
  });

  it("fails generically for wrong password, wrong TOTP, unknown email and inactive admin", async () => {
    const a = await makeAdmin("SUPPORT_ADMIN");
    const attempts: Array<Promise<unknown>> = [
      adminAuth.login({ email: a.email, password: "Wrong_Passw0rd!", totpCode: code(a) }, null),
      adminAuth.login({ email: a.email, password: PASSWORD, totpCode: "000000" }, null),
      adminAuth.login({ email: `nobody-${newId()}@test.local`, password: PASSWORD, totpCode: "123456" }, null),
    ];
    for (const attempt of attempts) {
      await expect(attempt).rejects.toThrowError(new AdminAuthError().message); // identical message — no oracle
    }
    const inactive = await makeAdmin("MODERATOR", false);
    await expect(
      adminAuth.login({ email: inactive.email, password: PASSWORD, totpCode: code(inactive) }, null),
    ).rejects.toThrowError(new AdminAuthError().message);

    const rows = await t.db
      .selectFrom("audit_logs")
      .select(["action"])
      .where("action", "=", "admin.login_failed")
      .execute();
    expect(rows.length).toBeGreaterThanOrEqual(4); // every failed outcome audited
  });

  it("locks out after 5 failures even with correct credentials afterwards", async () => {
    const a = await makeAdmin("AUDITOR");
    for (let i = 0; i < 5; i += 1) {
      await expect(
        adminAuth.login({ email: a.email, password: "Wrong_Passw0rd!", totpCode: "000000" }, null),
      ).rejects.toThrowError(new AdminAuthError().message);
    }
    await expect(
      adminAuth.login({ email: a.email, password: PASSWORD, totpCode: code(a) }, null),
    ).rejects.toThrowError(new AdminAuthError().message);
  });

  // ── dual approval (end-to-end through WithdrawalsService) ────────────────

  it("large withdrawal needs two DIFFERENT privileged admins; stage roles enforced", async () => {
    const finance = await makeAdmin("FINANCE_ADMIN");
    const compliance = await makeAdmin("COMPLIANCE_ADMIN");
    const analyst = await makeAdmin("ANALYST");
    const userId = await createUser(t.db);
    const wdId = await insertWithdrawal(userId, 600n * USDT); // ≥ 500 USDT threshold

    // service-level backstop: roles outside the matrix cannot approve at all
    await expect(withdrawals.approve(wdId, analyst.id, "ANALYST")).rejects.toBeInstanceOf(ApprovalNotAllowedError);
    // COMPLIANCE may only be the SECOND approver
    await expect(withdrawals.approve(wdId, compliance.id, "COMPLIANCE_ADMIN")).rejects.toBeInstanceOf(
      ApprovalNotAllowedError,
    );

    const first = await withdrawals.approve(wdId, finance.id, "FINANCE_ADMIN");
    expect(first.status).toBe("PENDING_APPROVAL"); // still pending — one signature is not enough
    expect(first.approved_by).toBe(finance.id);

    // the SAME admin cannot be both approvers
    await expect(withdrawals.approve(wdId, finance.id, "FINANCE_ADMIN")).rejects.toBeInstanceOf(DualApprovalError);

    const second = await withdrawals.approve(wdId, compliance.id, "COMPLIANCE_ADMIN");
    expect(second.status).toBe("APPROVED");
    expect(second.approved_by).toBe(finance.id);
    expect(second.second_approver).toBe(compliance.id);
  });

  it("small withdrawal approves with a single privileged admin", async () => {
    const finance = await makeAdmin("FINANCE_ADMIN");
    const userId = await createUser(t.db);
    const wdId = await insertWithdrawal(userId, 100n * USDT);
    const row = await withdrawals.approve(wdId, finance.id, "FINANCE_ADMIN");
    expect(row.status).toBe("APPROVED");
    expect(row.second_approver).toBeNull();
  });

  // ── kill switch ───────────────────────────────────────────────────────────

  it("toggles one switch with TOTP, preserving the other; wrong TOTP changes nothing", async () => {
    const superAdmin = await makeAdmin("SUPER_ADMIN");
    const finance = await makeAdmin("FINANCE_ADMIN");

    const afterWd = await admin.setKillSwitch(superAdmin.id, {
      target: "withdrawals",
      paused: true,
      totpCode: code(superAdmin),
      reason: "incident drill",
    });
    expect(afterWd).toEqual({ withdrawalsPaused: true, tradesPaused: false });
    expect(await settings.killSwitches()).toEqual({ withdrawalsPaused: true, tradesPaused: false });

    const afterTrades = await admin.setKillSwitch(finance.id, {
      target: "trades",
      paused: true,
      totpCode: code(finance),
      reason: "incident drill",
    });
    expect(afterTrades).toEqual({ withdrawalsPaused: true, tradesPaused: true }); // withdrawals flag preserved

    await expect(
      admin.setKillSwitch(superAdmin.id, {
        target: "withdrawals",
        paused: false,
        totpCode: "000000",
        reason: "should not apply",
      }),
    ).rejects.toBeInstanceOf(AdminVerificationError);
    expect(await settings.killSwitches()).toEqual({ withdrawalsPaused: true, tradesPaused: true });

    // restore for other suites + audit chain must stay intact
    await admin.setKillSwitch(superAdmin.id, {
      target: "withdrawals",
      paused: false,
      totpCode: code(superAdmin),
      reason: "drill complete",
    });
    await admin.setKillSwitch(superAdmin.id, {
      target: "trades",
      paused: false,
      totpCode: code(superAdmin),
      reason: "drill complete",
    });
    expect(await audit.verifyChain()).toEqual([]);
  });

  // ── country rollout toggle ────────────────────────────────────────────────

  it("configures a market (enabled + rails) with TOTP + audit; wrong TOTP and unknown code change nothing", async () => {
    const superAdmin = await makeAdmin("SUPER_ADMIN");

    // NG ships disabled with no rails — enable it AND set its rails in one action
    const afterEnable = await admin.updateCountry(superAdmin.id, "NG", {
      enabled: true,
      paymentMethods: ["BANK_TRANSFER", "OPAY"],
      totpCode: code(superAdmin),
      reason: "opening the Nigeria market",
    });
    const ng = afterEnable.countries.find((c) => c.code === "NG");
    expect(ng?.enabled).toBe(true);
    expect(ng?.paymentMethods).toEqual(["BANK_TRANSFER", "OPAY"]); // rails persisted + round-tripped

    // lowercase code is accepted (normalized)
    const afterDisable = await admin.updateCountry(superAdmin.id, "ng", {
      enabled: false,
      paymentMethods: [],
      totpCode: code(superAdmin),
      reason: "pausing rollout",
    });
    expect(afterDisable.countries.find((c) => c.code === "NG")?.enabled).toBe(false);

    // wrong TOTP changes nothing
    await expect(
      admin.updateCountry(superAdmin.id, "NG", {
        enabled: true,
        paymentMethods: ["BANK_TRANSFER"],
        totpCode: "000000",
        reason: "nope",
      }),
    ).rejects.toBeInstanceOf(AdminVerificationError);

    // unknown ISO code → domain 404
    await expect(
      admin.updateCountry(superAdmin.id, "ZZ", {
        enabled: true,
        paymentMethods: ["BANK_TRANSFER"],
        totpCode: code(superAdmin),
        reason: "unknown",
      }),
    ).rejects.toBeInstanceOf(CountryNotFoundError);

    // CM must remain enabled throughout, and the audit chain stays intact
    expect(afterDisable.countries.find((c) => c.code === "CM")?.enabled).toBe(true);
    expect(await audit.verifyChain()).toEqual([]);
  });

  // ── settings whitelist ───────────────────────────────────────────────────

  it("edits only whitelisted settings with valid values and audits old/new", async () => {
    const finance = await makeAdmin("FINANCE_ADMIN");
    await admin.updateSetting(finance.id, "fee_bps", { QUATAPAY: 40, MTN_MOMO: 60, ORANGE_MONEY: 60 }, code(finance));
    expect(await settings.feeBps("QUATAPAY")).toBe(40);

    await expect(
      admin.updateSetting(finance.id, "kyc_retention_days", 9999, code(finance)),
    ).rejects.toBeInstanceOf(SettingKeyNotAllowedError); // not on the whitelist
    await expect(
      admin.updateSetting(finance.id, "fee_bps", { QUATAPAY: "not-a-number" }, code(finance)),
    ).rejects.toBeInstanceOf(InvalidSettingValueError);

    const auditRow = await t.db
      .selectFrom("audit_logs")
      .select(["metadata"])
      .where("action", "=", "admin.setting_update")
      .orderBy("created_at", "desc")
      .limit(1)
      .executeTakeFirstOrThrow();
    expect(auditRow.metadata).toMatchObject({ key: "fee_bps" });
  });

  // ── ledger adjustment ─────────────────────────────────────────────────────

  it("SUPER_ADMIN adjustment moves money exactly once (idempotent) and never overdraws", async () => {
    const superAdmin = await makeAdmin("SUPER_ADMIN");
    const userId = await createUser(t.db);
    const idempotencyKey = `adjustment-${newId()}`;

    const first = await admin.ledgerAdjustment(superAdmin.id, {
      userId,
      accountKind: "user_available",
      asset: "USDT_TRC20",
      amount: (100n * USDT).toString(),
      reason: "manual reconciliation credit",
      idempotencyKey,
      totpCode: code(superAdmin),
    });
    expect(first.replayed).toBe(false);

    const account = await ledger.getOrCreateAccount(userId, "user_available", "USDT_TRC20");
    expect(await ledger.balanceOf(account)).toBe(100n * USDT);

    // replay: same key → same journal, nothing moves again
    const replay = await admin.ledgerAdjustment(superAdmin.id, {
      userId,
      accountKind: "user_available",
      asset: "USDT_TRC20",
      amount: (100n * USDT).toString(),
      reason: "manual reconciliation credit",
      idempotencyKey,
      totpCode: code(superAdmin),
    });
    expect(replay.replayed).toBe(true);
    expect(replay.journalId).toBe(first.journalId);
    expect(await ledger.balanceOf(account)).toBe(100n * USDT);

    // debits respect the non-negative user balance invariant
    await expect(
      admin.ledgerAdjustment(superAdmin.id, {
        userId,
        accountKind: "user_available",
        asset: "USDT_TRC20",
        amount: (-200n * USDT).toString(),
        reason: "attempted overdraw must fail",
        idempotencyKey: `adjustment-${newId()}`,
        totpCode: code(superAdmin),
      }),
    ).rejects.toBeInstanceOf(InsufficientFundsError);
    expect(await ledger.balanceOf(account)).toBe(100n * USDT);

    await expect(
      admin.ledgerAdjustment(superAdmin.id, {
        userId: newId(),
        accountKind: "user_available",
        asset: "USDT_TRC20",
        amount: "1000000",
        reason: "user does not exist here",
        idempotencyKey: `adjustment-${newId()}`,
        totpCode: code(superAdmin),
      }),
    ).rejects.toBeInstanceOf(TargetUserNotFoundError);

    // wrong TOTP → nothing happens
    await expect(
      admin.ledgerAdjustment(superAdmin.id, {
        userId,
        accountKind: "user_available",
        asset: "USDT_TRC20",
        amount: "1000000",
        reason: "totp must gate this action",
        idempotencyKey: `adjustment-${newId()}`,
        totpCode: "000000",
      }),
    ).rejects.toBeInstanceOf(AdminVerificationError);
    expect(await ledger.balanceOf(account)).toBe(100n * USDT);

    const adjustmentAudit = await t.db
      .selectFrom("audit_logs")
      .select(["id"])
      .where("action", "=", "ledger.adjustment")
      .execute();
    expect(adjustmentAudit.length).toBe(1); // exactly one — the replay did not re-audit
  });

  // ── user moderation ───────────────────────────────────────────────────────

  it("freeze → restore transitions users with outbox + audit; closed stays closed", async () => {
    const compliance = await makeAdmin("COMPLIANCE_ADMIN");
    const userId = await createUser(t.db);

    const frozen = await admin.setUserStatus(compliance.id, userId, "freeze", "suspicious velocity");
    expect(frozen).toEqual({ status: "frozen", changed: true });
    const again = await admin.setUserStatus(compliance.id, userId, "freeze", "suspicious velocity");
    expect(again.changed).toBe(false); // idempotent

    const restored = await admin.setUserStatus(compliance.id, userId, "restore", "cleared by review");
    expect(restored).toEqual({ status: "active", changed: true });

    await t.db.updateTable("users").set({ status: "closed" }).where("id", "=", userId).execute();
    await expect(admin.setUserStatus(compliance.id, userId, "restore", "must not resurrect")).rejects.toThrowError(
      /closed/,
    );

    const events = await t.db
      .selectFrom("outbox")
      .select(["event_type"])
      .where("event_type", "in", ["user.frozen", "user.restored"])
      .execute();
    expect(events.length).toBeGreaterThanOrEqual(2);
  });
});
