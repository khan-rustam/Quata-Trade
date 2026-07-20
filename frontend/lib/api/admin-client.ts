"use client";

import type { z } from "zod";
import {
  ApiClientError,
  QuataApiClient,
  zAdminHeldDepositRow,
  zAdminHeldDepositsResponse,
  type AdminHeldDepositDecision,
  type AdminHeldDepositRow,
  type AdminHeldDepositsResponse,
} from "@quatatrade/shared";
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

/**
 * The held-deposit review routes have no method on `QuataApiClient` yet, so they
 * go through this local helper. It keeps the shared client's contract exactly:
 * bearer token from the same in-memory store, `ApiClientError` on a non-2xx, and
 * the response parsed with the same zod schema the backend validates against.
 */
async function adminRequest<S extends z.ZodTypeAny>(
  method: "GET" | "POST",
  path: string,
  schema: S,
  body?: unknown,
  query?: Record<string, string | number | undefined>,
): Promise<z.infer<S>> {
  const url = new URL(path, API_BASE_URL);
  if (query) {
    for (const [k, v] of Object.entries(query)) {
      if (v !== undefined) url.searchParams.set(k, String(v));
    }
  }
  const token = getAdminToken();
  const res = await fetch(url.toString(), {
    method,
    headers: {
      ...(body !== undefined ? { "content-type": "application/json" } : {}),
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  const json: unknown = text.length > 0 ? JSON.parse(text) : null;
  if (!res.ok) {
    // Admin tokens are short-lived and have no refresh cookie — a 401 means
    // re-login, same as the shared client's onUnauthorized.
    if (res.status === 401) setAdminToken(null);
    throw new ApiClientError(res.status, json);
  }
  return schema.parse(json) as z.infer<S>;
}

/**
 * Held deposits (AML / policy holds). Release and reject are the ONLY exit from a
 * hold — an undecided deposit is skipped by the confirmation job forever.
 */
export const adminHeldDepositsApi = {
  queue: (query: {
    page: number;
    pageSize: number;
    hold: "all" | "aml" | "policy";
  }): Promise<AdminHeldDepositsResponse> =>
    adminRequest("GET", "/api/v1/admin/deposits/held", zAdminHeldDepositsResponse, undefined, query),
  release: (id: string, body: AdminHeldDepositDecision): Promise<AdminHeldDepositRow> =>
    adminRequest("POST", `/api/v1/admin/deposits/held/${id}/release`, zAdminHeldDepositRow, body),
  reject: (id: string, body: AdminHeldDepositDecision): Promise<AdminHeldDepositRow> =>
    adminRequest("POST", `/api/v1/admin/deposits/held/${id}/reject`, zAdminHeldDepositRow, body),
};
