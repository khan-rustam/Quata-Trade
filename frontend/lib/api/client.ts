"use client";

import { QuataApiClient } from "@quatatrade/shared";
import { API_BASE_URL } from "../env";
import { getAccessToken, setAccessToken } from "./auth-store";

let refreshing: Promise<boolean> | null = null;

/**
 * The single typed API client (Documents/07). Components call this — never
 * fetch directly. Every response is parsed with the same zod schema the
 * backend validates against, so contract drift is a runtime + compile error.
 */
export const api = new QuataApiClient({
  baseUrl: API_BASE_URL,
  getAccessToken,
  onUnauthorized: async () => {
    // De-duplicate concurrent refreshes so a burst of 401s triggers one refresh.
    refreshing ??= (async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/api/v1/auth/refresh`, {
          method: "POST",
          credentials: "include",
        });
        if (!res.ok) {
          setAccessToken(null);
          return false;
        }
        const data = (await res.json()) as { accessToken?: string };
        setAccessToken(data.accessToken ?? null);
        return Boolean(data.accessToken);
      } catch {
        setAccessToken(null);
        return false;
      } finally {
        refreshing = null;
      }
    })();
    await refreshing;
  },
});
