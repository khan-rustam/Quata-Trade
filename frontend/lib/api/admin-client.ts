"use client";

import { QuataApiClient } from "@quatatrade/shared";
import { API_BASE_URL } from "../env";

/**
 * Admin API client.
 *
 * The access token is short-lived and lives in MEMORY ONLY — never
 * localStorage, per the frontend CLAUDE.md rule. What survives a page refresh
 * is the `qt_admin_refresh` httpOnly cookie, which this code cannot read by
 * design: only the browser and the server ever see it.
 *
 * That split is the whole design. An admin stays signed in for
 * `ADMIN_SESSION_TTL_HOURS` across refreshes and new tabs, while the
 * long-lived half of the credential is invisible to any script running on the
 * page — including injected script. Reverses Documents/10 D20; see
 * `backend/src/modules/admin/admin-session.service.ts` for the reasoning.
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

/**
 * In-flight refresh, shared by every caller.
 *
 * A dashboard fires several queries at once, so an expired token produces a
 * burst of simultaneous 401s. Without this, each one would start its own
 * refresh — and since refresh tokens ROTATE and a replayed token kills the
 * whole chain, the second request would present an already-rotated token and
 * log the admin out. The stampede would look exactly like a session hijack to
 * the server, because from the server's side it is indistinguishable from one.
 *
 * So: one refresh at a time, everyone awaits the same promise.
 */
let inFlight: Promise<boolean> | null = null;

async function refreshOnce(): Promise<boolean> {
  if (inFlight) return inFlight;
  inFlight = (async () => {
    try {
      const res = await adminApi.adminRefresh();
      if (res.accessToken) {
        setAdminToken(res.accessToken);
        return true;
      }
      setAdminToken(null);
      return false;
    } catch {
      // Expired, revoked, or never existed. The server has already cleared the
      // cookie; drop the in-memory token so the UI shows the login screen.
      setAdminToken(null);
      return false;
    } finally {
      inFlight = null;
    }
  })();
  return inFlight;
}

export const adminApi = new QuataApiClient({
  baseUrl: API_BASE_URL,
  getAccessToken: getAdminToken,
  // The shared client calls this on a 401 and then REPLAYS the original
  // request once. So a successful refresh here makes the replay succeed and
  // the admin never sees the failure — which is the point: no logout mid-task.
  // `/api/v1/admin/auth/*` is excluded from this hook upstream, so a failing
  // refresh cannot recurse.
  onUnauthorized: async () => {
    await refreshOnce();
  },
});

/**
 * Restore a session on page load.
 *
 * The access token died with the last page (memory only), but the cookie
 * outlives it. Calling this on mount is what turns "logged in" into something
 * that survives a refresh, a new tab, or closing the laptop lid.
 *
 * Resolves false when there is no live session — the caller shows the login
 * screen. It never throws: a failed restore is the normal signed-out case, not
 * an error.
 */
export async function restoreAdminSession(): Promise<boolean> {
  if (adminToken) return true;
  return refreshOnce();
}

/**
 * End the session on the server and locally.
 *
 * Order matters: revoke first, then clear. Clearing first would leave a live
 * server-side session behind if the network call failed — a logout that
 * doesn't log out.
 */
export async function endAdminSession(): Promise<void> {
  try {
    await adminApi.adminLogout();
  } catch {
    // Already expired, or offline. The cookie is cleared by the server on any
    // outcome it can reach, and the local token is dropped below regardless.
  }
  setAdminToken(null);
}
