import { CanActivate, ExecutionContext, ForbiddenException, Inject, Injectable } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import type { Kysely } from "kysely";
import { EMAIL_VERIFICATION_REQUIRED } from "@quatatrade/shared";
import { DB } from "../../db/database.module";
import type { Database } from "../../db/types";
import { REQUIRES_VERIFIED_EMAIL_KEY } from "./decorators";
import type { AuthenticatedRequest } from "./jwt.types";

/**
 * Thin lookup boundary — an interface so the guard is unit-testable with an
 * in-memory impl (no Kysely mocks, no unchecked casts), same shape as NotifyStore.
 */
export const EMAIL_VERIFICATION_LOOKUP = Symbol("EMAIL_VERIFICATION_LOOKUP");

export interface EmailVerificationLookup {
  /** false for an unverified email AND for a user id with no row (fail closed). */
  isVerified(userId: string): Promise<boolean>;
}

@Injectable()
export class KyselyEmailVerificationLookup implements EmailVerificationLookup {
  constructor(@Inject(DB) private readonly db: Kysely<Database>) {}

  async isVerified(userId: string): Promise<boolean> {
    const row = await this.db
      .selectFrom("users")
      .select(["email_verified_at"])
      .where("id", "=", userId)
      .executeTakeFirst();
    return row?.email_verified_at != null;
  }
}

/**
 * Enforces "all sign-ups must be verified via email first" WITHOUT making a
 * flaky mail server a total signup outage: registration and login stay open and
 * an unverified user may browse, but every route carrying
 * `@RequiresVerifiedEmail()` — KYC, deposits, trading, transfers — refuses until
 * the address is confirmed.
 *
 * Reads the live `users` row rather than trusting a claim in the JWT: a token
 * minted before verification must start working the moment the user verifies,
 * without waiting out its TTL or forcing a re-login.
 *
 * Registered globally (app.module) but inert on undecorated routes, so the extra
 * read only happens on the gated actions — never on the browse paths.
 */
@Injectable()
export class EmailVerifiedGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    @Inject(EMAIL_VERIFICATION_LOOKUP) private readonly lookup: EmailVerificationLookup,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const required = this.reflector.getAllAndOverride<boolean>(REQUIRES_VERIFIED_EMAIL_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required) return true;

    const req = context.switchToHttp().getRequest<AuthenticatedRequest>();
    // Admin principals are governed by RolesGuard; JwtAuthGuard has already
    // rejected anonymous callers, so a missing principal here cannot be reached
    // through the HTTP pipeline — treat it as not-our-concern rather than 403.
    if (!req.auth || req.auth.typ !== "user") return true;

    if (!(await this.lookup.isVerified(req.auth.sub))) {
      throw new ForbiddenException(EMAIL_VERIFICATION_REQUIRED);
    }
    return true;
  }
}
