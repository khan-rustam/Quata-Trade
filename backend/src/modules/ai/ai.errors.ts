/**
 * The feature is off — no `OPENAI_API_KEY` configured.
 *
 * A distinct type from an upstream failure because the admin's next action
 * differs: this one is "ask ops to set the key", not "try again".
 */
export class AiDisabledError extends Error {
  constructor() {
    super("AI drafting is not configured");
    this.name = "AiDisabledError";
  }
}

/**
 * OpenAI was unreachable, slow, rate-limited, or returned something this
 * code cannot use.
 *
 * The message is written FOR THE ADMIN and is safe to return in an HTTP body.
 * The underlying cause stays in the log, deliberately: an OpenAI error body
 * can echo the request back, and the request carries both the operator's text
 * and — in the headers — the API key.
 */
export class AiUpstreamError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AiUpstreamError";
  }
}
