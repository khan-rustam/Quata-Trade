"use client";

import { QuataApiClient } from "@quatatrade/shared";
import { API_BASE_URL } from "../env";

/**
 * Admin API client. Admins use a SEPARATE 10-minute access token (no refresh
 * cookie in v1 — Documents/10 D20). The token lives in memory only; on expiry
 * the admin re-logs in. RBAC is enforced server-side on every route.
 */
let adminToken: string | null = null;
const listeners = new Set<() => void>();

export function getAdminToken(): string | null {
  return adminToken;
}
export function setAdminToken(token: string | null): void {
  adminToken = token;
  for (const l of listeners) l();
}
export function subscribeAdminToken(cb: () => void): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

export const adminApi = new QuataApiClient({
  baseUrl: API_BASE_URL,
  getAccessToken: getAdminToken,
  onUnauthorized: () => setAdminToken(null),
});
