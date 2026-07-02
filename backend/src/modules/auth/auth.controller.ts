import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
  UnauthorizedException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Throttle } from "@nestjs/throttler";
import { z } from "zod";
import {
  zForgotPasswordRequest,
  zLoginRequest,
  zRegisterRequest,
  zResetPasswordRequest,
  zSetPinRequest,
  zTotpEnableRequest,
  zTotpSetupResponse,
  zTotpVerifyRequest,
  zVerifyEmailRequest,
  type AuthTokensResponse,
  type LoginRequest,
  type Ok,
  type RegisterRequest,
  type RegisterResponse,
} from "@quatatrade/shared";
import { ZodPipe } from "../../common/zod.pipe";
import { CurrentAuth, CurrentUserId, Public } from "../../common/auth/decorators";
import type { AccessTokenPayload } from "../../common/auth/jwt.types";
import type { Env } from "../../config/env";
import { AuthService, type IssuedTokens, type RequestMeta } from "./auth.service";
import { TotpService } from "./totp.service";
import { PinService } from "./pin.service";
import {
  InvalidCodeError,
  InvalidCredentialsError,
  InvalidTokenError,
  TotpAlreadyEnabledError,
  TotpNotConfiguredError,
} from "./auth.errors";

type VerifyEmailRequest = z.infer<typeof zVerifyEmailRequest>;
type ForgotPasswordRequest = z.infer<typeof zForgotPasswordRequest>;
type ResetPasswordRequest = z.infer<typeof zResetPasswordRequest>;
type TotpEnableRequest = z.infer<typeof zTotpEnableRequest>;
type TotpVerifyRequest = z.infer<typeof zTotpVerifyRequest>;
type SetPinRequest = z.infer<typeof zSetPinRequest>;
type TotpSetupResponse = z.infer<typeof zTotpSetupResponse>;

const REFRESH_COOKIE = "qt_refresh";
const COOKIE_PATH = "/api/v1/auth"; // cookie only rides on auth endpoints

/**
 * Structural Fastify types — `fastify` is not a direct dependency (pnpm strict),
 * so we mirror only what we touch, same approach as common/auth/jwt.types.ts.
 * Runtime shape is provided by @fastify/cookie registered in main.ts.
 */
interface CookieOptions {
  httpOnly?: boolean;
  secure?: boolean;
  sameSite?: "strict" | "lax" | "none";
  path?: string;
  expires?: Date;
}

export interface CookieReply {
  setCookie(name: string, value: string, options: CookieOptions): unknown;
  clearCookie(name: string, options: CookieOptions): unknown;
}

export interface AuthHttpRequest {
  cookies: Record<string, string | undefined>;
  headers: Record<string, string | string[] | undefined>;
  ip?: string;
}

/** Domain error → HTTP, keeping every auth failure generic (no enumeration). */
function rethrowAuth(err: unknown): never {
  if (err instanceof InvalidCredentialsError || err instanceof InvalidTokenError) {
    throw new UnauthorizedException("Invalid credentials");
  }
  if (err instanceof TotpAlreadyEnabledError) throw new ConflictException("2FA is already enabled");
  if (err instanceof TotpNotConfiguredError) throw new BadRequestException("2FA setup is not complete");
  if (err instanceof InvalidCodeError) throw new BadRequestException("Invalid or expired code");
  throw err;
}

@Controller("auth")
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly totp: TotpService,
    private readonly pin: PinService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  private meta(req: AuthHttpRequest, deviceFingerprint?: string): RequestMeta {
    const ua = req.headers["user-agent"];
    return {
      ip: req.ip ?? null,
      userAgent: typeof ua === "string" ? ua.slice(0, 512) : null,
      deviceFingerprint: deviceFingerprint ?? null,
    };
  }

  private setRefreshCookie(reply: CookieReply, tokens: IssuedTokens): void {
    reply.setCookie(REFRESH_COOKIE, tokens.refreshToken, {
      httpOnly: true,
      secure: this.config.get("NODE_ENV", { infer: true }) === "production",
      sameSite: "strict",
      path: COOKIE_PATH,
      expires: tokens.refreshExpiresAt,
    });
  }

  private clearRefreshCookie(reply: CookieReply): void {
    reply.clearCookie(REFRESH_COOKIE, { path: COOKIE_PATH });
  }

  // ── public endpoints (strict throttle buckets, Documents/06 auth rules) ──

  @Public()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post("register")
  async register(
    @Body(new ZodPipe(zRegisterRequest)) dto: RegisterRequest,
    @Req() req: AuthHttpRequest,
  ): Promise<RegisterResponse> {
    return this.auth.register(dto, this.meta(req));
  }

  @Public()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post("verify-email")
  @HttpCode(HttpStatus.OK)
  async verifyEmail(@Body(new ZodPipe(zVerifyEmailRequest)) dto: VerifyEmailRequest): Promise<Ok> {
    try {
      await this.auth.verifyEmail(dto.email, dto.code);
      return { ok: true };
    } catch (err) {
      rethrowAuth(err);
    }
  }

  @Public()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post("login")
  @HttpCode(HttpStatus.OK)
  async login(
    @Body(new ZodPipe(zLoginRequest)) dto: LoginRequest,
    @Req() req: AuthHttpRequest,
    @Res({ passthrough: true }) reply: CookieReply,
  ): Promise<AuthTokensResponse> {
    try {
      const outcome = await this.auth.login(dto, this.meta(req, dto.deviceFingerprint));
      if (outcome.totpRequired) {
        // password valid, TOTP code missing → 200, client must retry with code
        return { accessToken: "", accessTokenExpiresIn: 0, totpRequired: true };
      }
      this.setRefreshCookie(reply, outcome);
      return {
        accessToken: outcome.accessToken,
        accessTokenExpiresIn: outcome.accessTokenExpiresIn,
        totpRequired: false,
      };
    } catch (err) {
      rethrowAuth(err);
    }
  }

  @Public()
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @Post("refresh")
  @HttpCode(HttpStatus.OK)
  async refresh(
    @Req() req: AuthHttpRequest,
    @Res({ passthrough: true }) reply: CookieReply,
  ): Promise<AuthTokensResponse> {
    try {
      const tokens = await this.auth.refresh(req.cookies[REFRESH_COOKIE], this.meta(req));
      this.setRefreshCookie(reply, tokens);
      return {
        accessToken: tokens.accessToken,
        accessTokenExpiresIn: tokens.accessTokenExpiresIn,
        totpRequired: false,
      };
    } catch (err) {
      this.clearRefreshCookie(reply);
      rethrowAuth(err);
    }
  }

  @Public()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post("forgot")
  @HttpCode(HttpStatus.OK)
  async forgot(
    @Body(new ZodPipe(zForgotPasswordRequest)) dto: ForgotPasswordRequest,
    @Req() req: AuthHttpRequest,
  ): Promise<Ok> {
    await this.auth.forgotPassword(dto.email, this.meta(req));
    return { ok: true }; // ALWAYS ok — no enumeration
  }

  @Public()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post("reset")
  @HttpCode(HttpStatus.OK)
  async reset(@Body(new ZodPipe(zResetPasswordRequest)) dto: ResetPasswordRequest): Promise<Ok> {
    try {
      await this.auth.resetPassword(dto.token, dto.password);
      return { ok: true };
    } catch (err) {
      rethrowAuth(err);
    }
  }

  // ── authenticated endpoints (global JwtAuthGuard applies) ───────────────

  @Post("logout")
  @HttpCode(HttpStatus.OK)
  async logout(
    @CurrentAuth() auth: AccessTokenPayload,
    @Res({ passthrough: true }) reply: CookieReply,
  ): Promise<Ok> {
    await this.auth.logout(auth.sub, auth.sid);
    this.clearRefreshCookie(reply);
    return { ok: true };
  }

  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post("2fa/setup")
  @HttpCode(HttpStatus.OK)
  async totpSetup(@CurrentUserId() userId: string): Promise<TotpSetupResponse> {
    try {
      return await this.totp.setup(userId);
    } catch (err) {
      rethrowAuth(err);
    }
  }

  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post("2fa/enable")
  @HttpCode(HttpStatus.OK)
  async totpEnable(
    @CurrentUserId() userId: string,
    @Body(new ZodPipe(zTotpEnableRequest)) dto: TotpEnableRequest,
  ): Promise<Ok> {
    try {
      await this.totp.enable(userId, dto.code);
      return { ok: true };
    } catch (err) {
      rethrowAuth(err);
    }
  }

  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post("2fa/verify")
  @HttpCode(HttpStatus.OK)
  async totpVerify(
    @CurrentUserId() userId: string,
    @Body(new ZodPipe(zTotpVerifyRequest)) dto: TotpVerifyRequest,
  ): Promise<Ok> {
    try {
      await this.totp.assertCode(userId, dto.code);
      return { ok: true };
    } catch (err) {
      rethrowAuth(err);
    }
  }

  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post("pin/set")
  @HttpCode(HttpStatus.OK)
  async setPin(
    @CurrentUserId() userId: string,
    @Body(new ZodPipe(zSetPinRequest)) dto: SetPinRequest,
  ): Promise<Ok> {
    try {
      await this.pin.setPin(userId, dto.pin, dto.currentPassword);
      return { ok: true };
    } catch (err) {
      rethrowAuth(err);
    }
  }
}
