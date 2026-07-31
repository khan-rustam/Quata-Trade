import { Module } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { Env } from "../../config/env";
import { AiService, type AiConfig } from "./ai.service";

/**
 * ai — admin content drafting and translation. NOTHING ELSE.
 *
 * Exported so `ContentModule` can inject it into the admin content
 * controller. It is deliberately NOT imported by `risk`, `kyc`, `disputes`,
 * `escrow`, `ledger` or `withdrawals`: `Documents/01`, `02`, `06` and
 * `CLAUDE.md` all forbid LLM calls in the fraud/risk decision path, and an
 * import into any of those modules is the prohibited thing rather than a
 * design question. See `Documents/10` → Deviations Log for why this module
 * exists at all.
 *
 * Config is resolved once from validated env into a plain object, following
 * `deposits.config.ts` — tests construct it directly rather than standing up
 * a ConfigService.
 */
export function aiConfigFromEnv(config: ConfigService<Env, true>): AiConfig {
  return {
    apiKey: config.get("OPENAI_API_KEY", { infer: true }),
    baseUrl: config.get("OPENAI_BASE_URL", { infer: true }),
    model: config.get("OPENAI_MODEL", { infer: true }),
    maxOutputTokens: config.get("OPENAI_MAX_OUTPUT_TOKENS", { infer: true }),
    timeoutMs: config.get("OPENAI_TIMEOUT_MS", { infer: true }),
  };
}

export const AI_CONFIG = "AI_CONFIG";

@Module({
  providers: [
    {
      provide: AI_CONFIG,
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>) => aiConfigFromEnv(config),
    },
    {
      provide: AiService,
      inject: [AI_CONFIG],
      useFactory: (cfg: AiConfig) => new AiService(cfg),
    },
  ],
  exports: [AiService],
})
export class AiModule {}
