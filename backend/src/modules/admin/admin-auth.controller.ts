import { Body, Controller, HttpCode, HttpStatus, Post, Req, UnauthorizedException } from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import { zAdminLoginRequest, type AdminLoginRequest, type AuthTokensResponse } from "@quatatrade/shared";
import { ZodPipe } from "../../common/zod.pipe";
import { Public } from "../../common/auth/decorators";
import type { AuthenticatedRequest } from "../../common/auth/jwt.types";
import { AdminAuthService } from "./admin-auth.service";
import { AdminAuthError } from "./admin.errors";

/**
 * POST /admin/auth/login — the only public admin route.
 * TOTP is mandatory (schema-level), failures are generic, every outcome is
 * audited, and the throttle bucket is strict on top of the service's
 * per-email failure limiter. Admin tokens have NO refresh path in v1:
 * ≤10-minute JWTs, re-login when they expire (documented deviation).
 */
@Controller("admin/auth")
export class AdminAuthController {
  constructor(private readonly adminAuth: AdminAuthService) {}

  @Public()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post("login")
  @HttpCode(HttpStatus.OK)
  async login(
    @Body(new ZodPipe(zAdminLoginRequest)) dto: AdminLoginRequest,
    @Req() req: AuthenticatedRequest,
  ): Promise<AuthTokensResponse> {
    try {
      const tokens = await this.adminAuth.login(dto, req.ip ?? null);
      return {
        accessToken: tokens.accessToken,
        accessTokenExpiresIn: tokens.accessTokenExpiresIn,
        totpRequired: false, // the code is part of the login request itself
      };
    } catch (err) {
      if (err instanceof AdminAuthError) throw new UnauthorizedException("Invalid credentials");
      throw err;
    }
  }
}
