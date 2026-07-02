import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import type { AdminRole } from "@quatatrade/shared";
import { ROLES_KEY } from "./decorators";
import type { AuthenticatedRequest } from "./jwt.types";

/**
 * RBAC per the matrix in Documents/06-backend-modules.md.
 * Routes without @Roles() are user routes: admin tokens are rejected there,
 * and vice versa — the two principal types never cross.
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const roles = this.reflector.getAllAndOverride<AdminRole[] | undefined>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    const req = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const auth = req.auth;
    if (!auth) return true; // public route — JwtAuthGuard already allowed it

    if (!roles || roles.length === 0) {
      // user-space route: admins must use /admin routes, never impersonate users
      if (auth.typ !== "user") throw new ForbiddenException();
      return true;
    }
    if (auth.typ !== "admin" || !auth.role || !roles.includes(auth.role)) {
      throw new ForbiddenException();
    }
    return true;
  }
}
