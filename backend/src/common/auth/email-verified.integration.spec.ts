import "reflect-metadata";
import { ForbiddenException, type Type } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { ExecutionContextHost } from "@nestjs/core/helpers/execution-context-host";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { EMAIL_VERIFICATION_REQUIRED } from "@quatatrade/shared";
import { startTestDb, type TestDb } from "../../../test/helpers/pg";
import { createUser } from "../../../test/helpers/fixtures";
import { newId } from "../../common/ids";
import { KycController } from "../../modules/kyc/kyc.controller";
import { WalletController } from "../../modules/wallet/wallet.controller";
import { EmailVerifiedGuard, KyselyEmailVerificationLookup } from "./email-verified.guard";
import type { AccessTokenPayload, AuthenticatedRequest } from "./jwt.types";

type Handler = (...args: never[]) => unknown;

/**
 * The half the unit spec cannot cover: the REAL Kysely lookup against real
 * Postgres. The unit spec proves the routing decision; this proves the SQL
 * behind it — including that a NULL `email_verified_at` reads as unverified and
 * that the app role is actually allowed to run the query (a missing GRANT here
 * would 500 every gated route in production, exactly like admin_sessions did).
 */
describe("EmailVerifiedGuard against real Postgres", () => {
  let t: TestDb;
  let guard: EmailVerifiedGuard;

  beforeAll(async () => {
    t = await startTestDb();
    // appDb = the RESTRICTED app role the API actually runs as, not the owner.
    guard = new EmailVerifiedGuard(new Reflector(), new KyselyEmailVerificationLookup(t.appDb));
  }, 180_000);

  afterAll(async () => {
    await t?.stop();
  });

  async function allows(cls: Type<unknown>, handler: Handler, userId: string): Promise<boolean> {
    const auth: AccessTokenPayload = { sub: userId, typ: "user", sid: newId() };
    const req: AuthenticatedRequest = { auth, headers: {} };
    const ctx = new ExecutionContextHost([req], cls, handler);
    try {
      return await guard.canActivate(ctx);
    } catch (err) {
      if (err instanceof ForbiddenException) return false;
      throw err;
    }
  }

  it("refuses a gated route while email_verified_at is NULL, allows it once set", async () => {
    const userId = await createUser(t.db);

    expect(await allows(KycController, KycController.prototype.submit, userId)).toBe(false);
    expect(await allows(WalletController, WalletController.prototype.depositAddress, userId)).toBe(false);

    await t.db
      .updateTable("users")
      .set({ email_verified_at: new Date() })
      .where("id", "=", userId)
      .execute();

    expect(await allows(KycController, KycController.prototype.submit, userId)).toBe(true);
    expect(await allows(WalletController, WalletController.prototype.depositAddress, userId)).toBe(true);
  });

  it("leaves browsing open at every verification state", async () => {
    const unverified = await createUser(t.db);
    expect(await allows(WalletController, WalletController.prototype.balances, unverified)).toBe(true);
    expect(await allows(KycController, KycController.prototype.status, unverified)).toBe(true);
  });

  it("fails closed for a user id that does not exist", async () => {
    expect(await allows(KycController, KycController.prototype.submit, newId())).toBe(false);
  });

  it("carries the shared message the frontend matches on", async () => {
    const userId = await createUser(t.db);
    const auth: AccessTokenPayload = { sub: userId, typ: "user", sid: newId() };
    const req: AuthenticatedRequest = { auth, headers: {} };
    const ctx = new ExecutionContextHost([req], KycController, KycController.prototype.submit);
    await expect(guard.canActivate(ctx)).rejects.toThrow(EMAIL_VERIFICATION_REQUIRED);
  });
});
