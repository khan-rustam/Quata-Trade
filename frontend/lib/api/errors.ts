import { ApiClientError } from "@quatatrade/shared";

/** Extract a human-readable message from an ApiClientError body or Error. */
export function apiErrorMessage(err: unknown, fallback = "Something went wrong"): string {
  if (err instanceof ApiClientError) {
    const body = err.body as { message?: string | string[]; error?: string } | null;
    if (body?.message) return Array.isArray(body.message) ? body.message.join(", ") : body.message;
    if (body?.error) return body.error;
    return `Request failed (${err.status})`;
  }
  if (err instanceof Error) return err.message;
  return fallback;
}
