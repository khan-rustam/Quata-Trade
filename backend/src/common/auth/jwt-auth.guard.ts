import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { JwtService } from "@nestjs/jwt";
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
    try {
      const payload = await this.jwt.verifyAsync<AccessTokenPayload>(value.slice(7));
      if (payload.typ !== "user" && payload.typ !== "admin") throw new Error("bad typ");
      req.auth = payload;
      return true;
    } catch {
      throw new UnauthorizedException(); // generic — no token-debugging hints
    }
  }
}
