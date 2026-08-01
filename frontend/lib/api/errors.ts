import { ApiClientError } from "@quatatrade/shared";
import { ZodError } from "zod";

/**
 * Extract a human-readable message from an ApiClientError body or Error.
 *
 * ## Why ZodError is intercepted before the generic Error branch
 *
 * `ZodError.message` is `JSON.stringify(issues)`. Without this branch it
 * falls through to `err.message` and prints a raw issue array at the user —
 * which is how a KYC submission that had **already succeeded** (documents
 * stored, confirmation email sent) came to display:
 *
 *     [ { "code": "invalid_literal", "expected": true, "path": [ "ok" ], … } ]
 *
 * A ZodError here is always a RESPONSE-validation failure: request-side
 * validation is caught at the form layer by the react-hook-form resolver
 * before any request goes out. That means our schema disagrees with our own
 * server — a bug the user did not cause, cannot act on, and in the worst
 * case is being shown for an operation that actually worked.
 *
 * It returns the caller's `fallback` rather than a message of its own,
 * because every caller already passes a translated, context-appropriate
 * string (`tx("errorSubmit")`). Inventing copy here would hardcode English
 * into a bilingual product.
 */
export function apiErrorMessage(err: unknown, fallback = "Something went wrong"): string {
  if (err instanceof ApiClientError) {
    const body = err.body as { message?: string | string[]; error?: string } | null;
    if (body?.message) return Array.isArray(body.message) ? body.message.join(", ") : body.message;
    if (body?.error) return body.error;
    return `Request failed (${err.status})`;
  }

  if (err instanceof ZodError) {
    // Loud in the console, quiet on screen. Contract drift has to be
    // findable — but not by the person trying to verify their identity.
    console.error("[api] response did not match its schema", err.issues);
    return fallback;
  }

  if (err instanceof Error) return err.message;
  return fallback;
}
