import { z } from "zod";

/**
 * AI-assisted content drafting — the FE/BE contract.
 *
 * ## Scope, and the line this must never cross
 *
 * The `Documents/` set forbids LLMs in the fraud/risk decision path in four
 * separate places (`01 §risk`, `02` tech-stack "do not", `06` risk module,
 * `CLAUDE.md`). Nothing in this file touches a risk, KYC, dispute or money
 * decision. It drafts **site copy** — FAQ answers, company blurbs — and
 * **translates** that copy to French, both admin-triggered and both requiring
 * a human to publish. The model never writes to a table; it returns text an
 * admin reads, edits and then saves through the existing content endpoints.
 *
 * A future contributor adding a `zRiskAssessRequest` here is doing the thing
 * the documents prohibit. Put it in a rules module, or don't.
 *
 * ## Why the response is text, not a persisted draft
 *
 * Keeping the output ephemeral means the model's mistakes can't accumulate in
 * the database, there is no half-approved state to reason about, and removing
 * the feature removes it completely. An admin who wants to keep a draft saves
 * it as an unpublished FAQ — a state the content module already models.
 */

/** Locales the drafting surface knows about. Pidgin is not in v1. */
export const AI_LOCALES = ["en", "fr"] as const;
export type AiLocale = (typeof AI_LOCALES)[number];

/** What kind of copy is being drafted — picks the system prompt. */
export const AI_DRAFT_KINDS = ["faq_answer", "company_blurb", "review_reply"] as const;
export type AiDraftKind = (typeof AI_DRAFT_KINDS)[number];

/**
 * Length caps exist for cost and for prompt-injection surface: the shorter the
 * admin-supplied text, the less room to smuggle instructions at the model. They
 * are not the defence — see the service's delimiting — but they bound it.
 */
export const zAiDraftRequest = z
  .object({
    kind: z.enum(AI_DRAFT_KINDS),
    /** The question to answer, or the topic to write about. */
    prompt: z.string().trim().min(3).max(600),
    /** Optional existing copy to rewrite rather than write from scratch. */
    context: z.string().trim().max(2_000).optional(),
    locale: z.enum(AI_LOCALES).default("en"),
  })
  .strict();
export type AiDraftRequest = z.infer<typeof zAiDraftRequest>;

export const zAiTranslateRequest = z
  .object({
    text: z.string().trim().min(1).max(4_000),
    /** Source is declared rather than sniffed — guessing gets it wrong on
     *  short strings, and a mis-detected source produces confident nonsense. */
    from: z.enum(AI_LOCALES),
    to: z.enum(AI_LOCALES),
  })
  .strict()
  .refine((v) => v.from !== v.to, {
    message: "Source and target locale must differ",
  });
export type AiTranslateRequest = z.infer<typeof zAiTranslateRequest>;

export const zAiDraftResponse = z
  .object({
    /** The drafted copy. Always shown to a human before it is published. */
    text: z.string(),
    /** Which model produced it, so a bad batch can be traced to a version. */
    model: z.string(),
    /** Output tokens billed. Surfaced so an admin sees the cost of a retry. */
    tokens: z.number().int().nonnegative(),
  })
  .strict();
export type AiDraftResponse = z.infer<typeof zAiDraftResponse>;

/** Whether the feature is usable at all, for the admin UI to branch on. */
export const zAiStatus = z
  .object({
    enabled: z.boolean(),
    model: z.string(),
    /** Human-readable reason when disabled (no key, flag off). Never a secret. */
    reason: z.string().nullable(),
  })
  .strict();
export type AiStatus = z.infer<typeof zAiStatus>;

/**
 * The OpenAI credential surface — admin only, WRITE-ONLY.
 *
 * There is deliberately no field here that could carry the key back out. The
 * screen shows whether one is configured, where it came from, who set it and
 * a truncated one-way fingerprint — enough to answer "is this the key I
 * pasted?" and nothing that could reconstruct it.
 */
export const zAiCredentialStatus = z
  .object({
    configured: z.boolean(),
    /** "admin" = set in this screen, "env" = falling back to the env var. */
    source: z.enum(["admin", "env"]).nullable(),
    /** First 8 hex chars of sha256(key). Identifies; never reconstructs. */
    fingerprint: z.string().nullable(),
    updatedAt: z.string().nullable(),
    updatedBy: z.string().nullable(),
  })
  .strict();
export type AiCredentialStatus = z.infer<typeof zAiCredentialStatus>;

export const zSetAiCredentialRequest = z
  .object({
    // Bounded, and required to look like a key rather than a pasted sentence:
    // a mistyped value silently disables drafting until someone notices.
    apiKey: z
      .string()
      .trim()
      .min(20, "That does not look like an API key")
      .max(300)
      .regex(/^[A-Za-z0-9_\-.]+$/, "An API key has no spaces or symbols"),
  })
  .strict();
export type SetAiCredentialRequest = z.infer<typeof zSetAiCredentialRequest>;
