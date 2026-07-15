import { CanActivate, ExecutionContext, Inject, Injectable, UnauthorizedException } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { JwtService } from "@nestjs/jwt";
import type { Kysely } from "kysely";
import { DB } from "../../db/database.module";
import type { Database } from "../../db/types";
import { IS_PUBLIC_KEY } from "./decorators";
import type { AccessTokenPayload, AuthenticatedRequest } from "./jwt.types";

/**
 * Global default guard: verifies the Bearer access token (≤10 min TTL).
 * @Public() opts out. Role checks are layered on via RolesGuard.
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly jwt: JwtService,
    @Inject(DB) private readonly db: Kysely<Database>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const req = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const header = req.headers.authorization;
    const value = Array.isArray(header) ? header[0] : header;
    if (!value?.startsWith("Bearer ")) {
      throw new UnauthorizedException();
    }
    let payload: AccessTokenPayload;
    try {
      payload = await this.jwt.verifyAsync<AccessTokenPayload>(value.slice(7));
      if (payload.typ !== "user" && payload.typ !== "admin") throw new Error("bad typ");
    } catch {
      throw new UnauthorizedException(); // generic — no token-debugging hints
    }

    // Admin tokens have NO refresh path (≤10 min) — re-check the admin is still
    // active and use their LIVE role so a deactivated/demoted admin loses power at
    // once, not at token expiry. Admin traffic is low, so the per-request read is
    // cheap; user requests skip it entirely.
    if (payload.typ === "admin") {
      const admin = await this.db
        .selectFrom("admins")
        .select(["active", "role"])
        .where("id", "=", payload.sub)
        .executeTakeFirst();
      if (!admin || !admin.active) throw new UnauthorizedException();
      req.auth = { ...payload, role: admin.role };
      return true;
    }

    req.auth = payload;
    return true;
  }
}
