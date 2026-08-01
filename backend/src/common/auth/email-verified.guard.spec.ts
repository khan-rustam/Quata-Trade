import "reflect-metadata";
import { ForbiddenException, type Type } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { ExecutionContextHost } from "@nestjs/core/helpers/execution-context-host";
import { describe, expect, it } from "vitest";
import { EMAIL_VERIFICATION_REQUIRED } from "@quatatrade/shared";
import { KycController } from "../../modules/kyc/kyc.controller";
import { OffersController } from "../../modules/offers/offers.controller";
import { TradesController } from "../../modules/trades/trades.controller";
import { WalletController } from "../../modules/wallet/wallet.controller";
import { EmailVerifiedGuard, type EmailVerificationLookup } from "./email-verified.guard";
import type { AccessTokenPayload, AuthenticatedRequest } from "./jwt.types";

type Handler = (...args: never[]) => unknown;

const VERIFIED = "11111111-1111-4111-8111-111111111111";
const UNVERIFIED = "22222222-2222-4222-8222-222222222222";
const DELETED = "33333333-3333-4333-8333-333333333333";

/** In-memory port impl — no Kysely mock, no casts (mirrors NotifyStore's shape). */
const lookup: EmailVerificationLookup = {
  isVerified: (userId: string) => Promise.resolve(userId === VERIFIED),
};

const userAuth = (sub: string): AccessTokenPayload => ({ sub, typ: "user", sid: "session-1" });

/**
 * The business rule (Documents/15 launch questions): every sign-up must verify
 * its email, but sign-up itself must not be blocked on mail delivery. So login
 * and browsing stay open and the gate sits on the actions that matter.
 *
 * These cases are written from that RULE, not from the decorators — a route
 * losing `@RequiresVerifiedEmail()` must fail here, which is the whole point.
 */
describe("EmailVerifiedGuard — gated actions require a verified email", () => {
  const guard = new EmailVerifiedGuard(new Reflector(), lookup);

  async function allows(cls: Type<unknown>, handler: Handler, auth: AccessTokenPayload | undefined): Promise<boolean> {
    const req: AuthenticatedRequest = { auth, headers: {} };
    const ctx = new ExecutionContextHost([req], cls, handler);
    try {
      return await guard.canActivate(ctx);
    } catch (err) {
      if (err instanceof ForbiddenException) return false;
      throw err;
    }
  }

  const gated: Array<{ name: string; cls: Type<unknown>; handler: Handler }> = [
    { name: "POST /kyc/upload", cls: KycController, handler: KycController.prototype.upload },
    { name: "POST /kyc/submit", cls: KycController, handler: KycController.prototype.submit },
    { name: "POST /trades", cls: TradesController, handler: TradesController.prototype.open },
    { name: "POST /offers", cls: OffersController, handler: OffersController.prototype.create },
    {
      name: "GET /wallet/:asset/deposit-address",
      cls: WalletController,
      handler: WalletController.prototype.depositAddress,
    },
    { name: "POST /wallet/transfer", cls: WalletController, handler: WalletController.prototype.transfer },
  ];

  for (const route of gated) {
    it(`${route.name} is DENIED for an unverified email`, async () => {
      expect(await allows(route.cls, route.handler, userAuth(UNVERIFIED))).toBe(false);
    });

    it(`${route.name} is ALLOWED once the email is verified`, async () => {
      expect(await allows(route.cls, route.handler, userAuth(VERIFIED))).toBe(true);
    });
  }

  it("rejects with the shared message so the frontend can offer a resend", async () => {
    const req: AuthenticatedRequest = { auth: userAuth(UNVERIFIED), headers: {} };
    const ctx = new ExecutionContextHost([req], KycController, KycController.prototype.submit);
    await expect(guard.canActivate(ctx)).rejects.toThrow(EMAIL_VERIFICATION_REQUIRED);
  });

  it("fails CLOSED when the user row is gone (deleted mid-session)", async () => {
    expect(await allows(KycController, KycController.prototype.submit, userAuth(DELETED))).toBe(false);
  });
});

/**
 * The counter-pressure from the owner: "we don't want any sign-ups to face
 * difficulty". Browsing must stay open to an unverified account, or a flaky
 * mail server becomes a total signup outage. These assert the gate did NOT
 * spread past the money/KYC actions.
 */
describe("EmailVerifiedGuard — read-only browsing stays open", () => {
  const guard = new EmailVerifiedGuard(new Reflector(), lookup);

  /** Defaults to the unverified user; pass `auth` explicitly for principal cases. */
  async function allows(
    cls: Type<unknown>,
    handler: Handler,
    auth: AccessTokenPayload | undefined = userAuth(UNVERIFIED),
  ): Promise<boolean> {
    const req: AuthenticatedRequest = { auth, headers: {} };
    const ctx = new ExecutionContextHost([req], cls, handler);
    try {
      return await guard.canActivate(ctx);
    } catch (err) {
      if (err instanceof ForbiddenException) return false;
      throw err;
    }
  }

  const open: Array<{ name: string; cls: Type<unknown>; handler: Handler }> = [
    { name: "GET /kyc/status", cls: KycController, handler: KycController.prototype.status },
    { name: "GET /offers", cls: OffersController, handler: OffersController.prototype.list },
    { name: "GET /trades", cls: TradesController, handler: TradesController.prototype.list },
    { name: "GET /wallet/info", cls: WalletController, handler: WalletController.prototype.info },
    { name: "GET /wallet/balances", cls: WalletController, handler: WalletController.prototype.balances },
    { name: "POST /trades/fee-preview", cls: TradesController, handler: TradesController.prototype.feePreview },
  ];

  for (const route of open) {
    it(`${route.name} stays open to an unverified account`, async () => {
      expect(await allows(route.cls, route.handler)).toBe(true);
    });
  }

  /**
   * Fail-closed cases. Neither is reachable over HTTP today — JwtAuthGuard
   * rejects anonymous callers, and RolesGuard throws on a non-user principal
   * for user-space routes before this guard runs. They are asserted anyway
   * because the ONLY way to reach them is a future misconfiguration (most
   * plausibly `@Public()` landing on a money route), and the guard must refuse
   * rather than wave that through.
   */
  // Built inline, NOT via allows(): passing `undefined` to a parameter with a
  // default value triggers the default, which would quietly turn this back into
  // a plain unverified-user test that passes no matter what the guard does.
  it("refuses a gated route when there is no principal at all", async () => {
    const req: AuthenticatedRequest = { headers: {} };
    const ctx = new ExecutionContextHost([req], KycController, KycController.prototype.submit);
    await expect(guard.canActivate(ctx)).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("refuses a gated route for a non-user (admin) principal", async () => {
    const auth: AccessTokenPayload = { sub: "admin-1", typ: "admin", sid: "s" };
    expect(await allows(KycController, KycController.prototype.submit, auth)).toBe(false);
  });

  it("still lets an admin principal through on an UNGATED route", async () => {
    const auth: AccessTokenPayload = { sub: "admin-1", typ: "admin", sid: "s" };
    expect(await allows(KycController, KycController.prototype.status, auth)).toBe(true);
  });
});
