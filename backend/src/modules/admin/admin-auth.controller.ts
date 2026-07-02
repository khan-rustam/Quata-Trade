import { Body, Controller, HttpCode, HttpStatus, Post, Req, UnauthorizedException } from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import { z } from "zod";
import {
  zAdminLoginRequest,
  zTotpEnableRequest,
  type AdminLoginRequest,
  type AuthTokensResponse,
} from "@quatatrade/shared";
import { ZodPipe } from "../../common/zod.pipe";
import { Public, Roles, CurrentAdminId } from "../../common/auth/decorators";
import type { AuthenticatedRequest } from "../../common/auth/jwt.types";
import { RBAC } from "./admin.rbac";
import { AdminAuthService } from "./admin-auth.service";
import { AdminAuthError, AdminVerificationError } from "./admin.errors";

type TotpEnableRequest = z.infer<typeof zTotpEnableRequest>;

/**
 * Admin auth. Login is the only public route. TOTP is OPTIONAL (test phase):
 * admins log in with email + password, and can enable 2FA from their profile
 * (/admin/2fa/setup → enable). Admin tokens have NO refresh path in v1.
 */
@Controller("admin")
export class AdminAuthController {
  constructor(private readonly adminAuth: AdminAuthService) {}

  @Public()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post("auth/login")
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
        totpRequired: tokens.totpRequired,
      };
    } catch (err) {
      if (err instanceof AdminAuthError) throw new UnauthorizedException("Invalid credentials");
      throw err;
    }
  }

  /** Begin 2FA setup — returns the otpauth URL + QR to scan. Any admin, self only. */
  @Roles(...RBAC.viewDashboards)
  @Post("2fa/setup")
  @HttpCode(HttpStatus.OK)
  async totpSetup(@CurrentAdminId() adminId: string): Promise<{ otpauthUrl: string; qrDataUrl: string }> {
    return this.adminAuth.totpSetup(adminId);
  }

  /** Verify a code against the pending secret and turn 2FA on. */
  @Roles(...RBAC.viewDashboards)
  @Post("2fa/enable")
  @HttpCode(HttpStatus.OK)
  async totpEnable(
    @CurrentAdminId() adminId: string,
    @Body(new ZodPipe(zTotpEnableRequest)) dto: TotpEnableRequest,
    @Req() req: AuthenticatedRequest,
  ): Promise<{ ok: true }> {
    try {
      await this.adminAuth.totpEnable(adminId, dto.code, req.ip);
      return { ok: true };
    } catch (err) {
      if (err instanceof AdminVerificationError) throw new UnauthorizedException("Invalid code");
      throw err;
    }
  }
}
