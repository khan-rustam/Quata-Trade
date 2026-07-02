import type { AdminRole } from "@quatatrade/shared";

/** Access-token payload. Kept minimal — authorization data is loaded server-side. */
export interface AccessTokenPayload {
  /** user or admin id */
  sub: string;
  /** principal type — admin tokens NEVER work on user routes and vice versa */
  typ: "user" | "admin";
  /** present only for typ=admin */
  role?: AdminRole;
  /** session id (users) — lets logout/freeze invalidate access early via denylist */
  sid?: string;
  iat?: number;
  exp?: number;
}

export interface AuthenticatedRequest {
  auth?: AccessTokenPayload;
  headers: Record<string, string | string[] | undefined>;
  ip?: string;
}
