import { Module } from "@nestjs/common";
import { AiModule } from "../ai/ai.module";
import { ContentService } from "./content.service";
import { ContentController } from "./content.controller";
import { ContentAdminController } from "./content-admin.controller";
import { ContentAiController } from "./content-ai.controller";

/**
 * Admin-managed site content: company details, FAQ, reviews, contact enquiries.
 *
 * `AiModule` is imported here and, by design, nowhere near the money or risk
 * modules — drafting site copy is the only sanctioned LLM surface in this
 * codebase (Documents/10 → Deviations Log, 2026-07-31).
 */
@Module({
  imports: [AiModule],
  controllers: [ContentController, ContentAdminController, ContentAiController],
  providers: [ContentService],
  exports: [ContentService],
})
export class ContentModule {}
