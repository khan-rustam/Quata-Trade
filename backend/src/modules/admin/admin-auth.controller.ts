import { Body, Controller, HttpCode, HttpStatus, Patch, Post, Req, Res, UnauthorizedException } from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import { z } from "zod";
import {
  zAdminLoginRequest,
  zAdminUpdateProfileRequest,
  zTotpEnableRequest,
  type AdminLoginRequest,
  type AdminProfile,
  type AdminUpdateProfileRequest,
  type AuthTokensResponse,
} from "@quatatrade/shared";
import { ZodPipe } from "../../common/zod.pipe";
import { Public, Roles, CurrentAdminId } from "../../common/auth/decorators";
import type { AuthenticatedRequest } from "../../common/auth/jwt.types";
import { RBAC } from "./admin.rbac";
import { AdminAuthService } from "./admin-auth.service";
import { AdminSessionService, type AdminSessionTokens } from "./admin-session.service";
import { ConfigService } from "@nestjs/config";
import type { Env } from "../../config/env";
import { AdminAuthError, AdminVerificationError } from "./admin.errors";

type TotpEnableRequest = z.infer<typeof zTotpEnableRequest>;

/** Scoped to the admin auth paths so the cookie never rides on ordinary
 *  admin API calls — it is only needed by refresh and logout. */
const ADMIN_REFRESH_COOKIE = "qt_admin_refresh";
const ADMIN_COOKIE_PATH = "/api/v1/admin/auth";

/**
 * Structural Fastify types — `fastify` is not a direct dependency (pnpm
 * strict), so mirror only what is touched. Same approach as
 * `auth.controller.ts`.
 */
interface CookieOptions {
  httpOnly?: boolean;
  secure?: boolean;
  sameSite?: "strict" | "lax" | "none";
  path?: string;
  expires?: Date;
}
interface CookieReply {
  setCookie(name: string, value: string, options: CookieOptions): unknown;
  clearCookie(name: string, options: CookieOptions): unknown;
}

/**
 * Admin auth. Login and refresh are the public routes. TOTP is OPTIONAL (test
 * phase): admins log in with email + password, and can enable 2FA from their
 * profile (/admin/2fa/setup → enable).
 *
 * Sessions: a short access token in memory plus a rotating refresh token in an
 * httpOnly cookie, so an admin stays signed in across refreshes and tabs for
 * `ADMIN_SESSION_TTL_HOURS` without the long-lived credential ever being
 * readable by JavaScript. Reverses Documents/10 D20 — see
 * `admin-session.service.ts` for why.
 */
@Controller("admin")
export class AdminAuthController {
  constructor(
    private readonly adminAuth: AdminAuthService,
    private readonly sessions: AdminSessionService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  /** Secure everywhere except local dev, matching `auth.controller.ts`. Keying
   *  this on `=== "production"` once left the refresh cookie without Secure on
   *  the HTTPS staging box. */
  private cookieSecure(): boolean {
    return this.config.get("NODE_ENV", { infer: true }) !== "development";
  }

  private setRefreshCookie(reply: CookieReply, tokens: AdminSessionTokens): void {
    reply.setCookie(ADMIN_REFRESH_COOKIE, tokens.refreshToken, {
      httpOnly: true,
      secure: this.cookieSecure(),
      // strict, not lax: nothing should ever navigate cross-site INTO an admin
      // session, and CSRF on an admin panel is the whole threat this closes.
      sameSite: "strict",
      path: ADMIN_COOKIE_PATH,
      expires: tokens.refreshExpiresAt,
    });
  }

  private clearRefreshCookie(reply: CookieReply): void {
    // Attributes must match the set call or browsers silently keep the cookie.
    reply.clearCookie(ADMIN_REFRESH_COOKIE, {
      httpOnly: true,
      secure: this.cookieSecure(),
      sameSite: "strict",
      path: ADMIN_COOKIE_PATH,
    });
  }

  private meta(req: AuthenticatedRequest): { ip: string | null; userAgent: string | null } {
    const ua = (req.headers as Record<string, unknown>)["user-agent"];
    return {
      ip: req.ip ?? null,
      userAgent: typeof ua === "string" ? ua.slice(0, 512) : null,
    };
  }

  @Public()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post("auth/login")
  @HttpCode(HttpStatus.OK)
  async login(
    @Body(new ZodPipe(zAdminLoginRequest)) dto: AdminLoginRequest,
    @Req() req: AuthenticatedRequest,
    @Res({ passthrough: true }) reply: CookieReply,
  ): Promise<AuthTokensResponse> {
    try {
      const tokens = await this.adminAuth.login(dto, req.ip ?? null);
      // A TOTP challenge is not a session yet — no cookie until the second
      // factor is satisfied, or a half-authenticated request would carry one.
      if (tokens.totpRequired) {
        return {
          accessToken: tokens.accessToken,
          accessTokenExpiresIn: tokens.accessTokenExpiresIn,
          totpRequired: true,
        };
      }
      const session = await this.sessions.open(tokens.adminId, this.meta(req));
      this.setRefreshCookie(reply, session);
      return {
        accessToken: session.accessToken,
        accessTokenExpiresIn: session.accessTokenExpiresIn,
        totpRequired: false,
      };
    } catch (err) {
      if (err instanceof AdminAuthError) throw new UnauthorizedException("Invalid credentials");
      throw err;
    }
  }

  /**
   * Exchange the refresh cookie for a fresh access token, rotating the session.
   *
   * Public because it is the route a caller with an EXPIRED access token uses —
   * requiring a valid access token here would defeat the point. The httpOnly
   * cookie is the credential; the guard is that it is unreadable by script,
   * single-use, and SameSite=strict.
   */
  @Public()
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @Post("auth/refresh")
  @HttpCode(HttpStatus.OK)
  async refresh(
    @Req() req: AuthenticatedRequest & { cookies?: Record<string, string | undefined> },
    @Res({ passthrough: true }) reply: CookieReply,
  ): Promise<AuthTokensResponse> {
    try {
      const session = await this.sessions.refresh(
        req.cookies?.[ADMIN_REFRESH_COOKIE],
        this.meta(req),
      );
      this.setRefreshCookie(reply, session);
      return {
        accessToken: session.accessToken,
        accessTokenExpiresIn: session.accessTokenExpiresIn,
        totpRequired: false,
      };
    } catch (err) {
      // Clear the cookie on ANY failure. Leaving a dead cookie in place means
      // the browser retries it forever and the admin sees a login page that
      // never sticks.
      this.clearRefreshCookie(reply);
      if (err instanceof AdminAuthError) throw new UnauthorizedException("Session expired");
      throw err;
    }
  }

  /** End this session. Idempotent, and always clears the cookie. */
  @Public()
  @Post("auth/logout")
  @HttpCode(HttpStatus.OK)
  async logout(
    @Req() req: AuthenticatedRequest & { cookies?: Record<string, string | undefined> },
    @Res({ passthrough: true }) reply: CookieReply,
  ): Promise<{ ok: true }> {
    await this.sessions.revoke(req.cookies?.[ADMIN_REFRESH_COOKIE]);
    this.clearRefreshCookie(reply);
    return { ok: true };
  }

  /** Self-service profile edit (name/display/phone/avatar). Any admin, self only. */
  @Roles(...RBAC.viewDashboards)
  @Patch("profile")
  async updateProfile(
    @CurrentAdminId() adminId: string,
    @Body(new ZodPipe(zAdminUpdateProfileRequest)) dto: AdminUpdateProfileRequest,
    @Req() req: AuthenticatedRequest,
  ): Promise<AdminProfile> {
    return this.adminAuth.updateProfile(adminId, dto, req.ip);
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
