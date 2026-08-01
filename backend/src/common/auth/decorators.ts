import { createParamDecorator, SetMetadata, type ExecutionContext } from "@nestjs/common";
import type { AdminRole } from "@quatatrade/shared";
import type { AccessTokenPayload, AuthenticatedRequest } from "./jwt.types";

export const IS_PUBLIC_KEY = "isPublic";
/** Opt-out of the global JwtAuthGuard (login, register, health...). */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);

export const ROLES_KEY = "roles";
/** Admin route: allowed roles per the RBAC matrix (Documents/06). */
export const Roles = (...roles: AdminRole[]) => SetMetadata(ROLES_KEY, roles);

export const REQUIRES_VERIFIED_EMAIL_KEY = "requiresVerifiedEmail";
/**
 * Action that must not run on an unverified email — KYC, deposits, trading,
 * transfers. Enforced by EmailVerifiedGuard. Deliberately NOT applied to login
 * or to read-only browsing: the rule is "verify before you transact", not
 * "verify before you look around" (see EmailVerifiedGuard).
 */
export const RequiresVerifiedEmail = () => SetMetadata(REQUIRES_VERIFIED_EMAIL_KEY, true);

/** Injects the verified token payload. */
export const CurrentAuth = createParamDecorator((_: unknown, ctx: ExecutionContext): AccessTokenPayload => {
  const req = ctx.switchToHttp().getRequest<AuthenticatedRequest>();
  if (!req.auth) throw new Error("CurrentAuth used on an unauthenticated route");
  return req.auth;
});

/** Injects the authenticated USER id (guards guarantee typ=user). */
export const CurrentUserId = createParamDecorator((_: unknown, ctx: ExecutionContext): string => {
  const req = ctx.switchToHttp().getRequest<AuthenticatedRequest>();
  if (!req.auth || req.auth.typ !== "user") throw new Error("CurrentUserId requires a user principal");
  return req.auth.sub;
});

/** Injects the authenticated ADMIN id (guards guarantee typ=admin). */
export const CurrentAdminId = createParamDecorator((_: unknown, ctx: ExecutionContext): string => {
  const req = ctx.switchToHttp().getRequest<AuthenticatedRequest>();
  if (!req.auth || req.auth.typ !== "admin") throw new Error("CurrentAdminId requires an admin principal");
  return req.auth.sub;
});
