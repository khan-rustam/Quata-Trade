import {
  Body,
  Controller,
  Get,
  HttpException,
  HttpStatus,
  Post,
} from "@nestjs/common";
import {
  zAiDraftRequest,
  zAiTranslateRequest,
  type AiDraftRequest,
  type AiDraftResponse,
  type AiStatus,
  type AiTranslateRequest,
} from "@quatatrade/shared";
import { ZodPipe } from "../../common/zod.pipe";
import { Roles } from "../../common/auth/decorators";
import { RBAC } from "../admin/admin.rbac";
import { AiDisabledError, AiUpstreamError } from "../ai/ai.errors";
import { AiService } from "../ai/ai.service";

/**
 * Admin content drafting — `/admin/content/ai/*`.
 *
 * The ONLY route into `AiService`. Everything here is:
 *
 *   • admin-authenticated, behind the same `RBAC.editSettings` as the rest of
 *     content administration (SUPER_ADMIN + FINANCE_ADMIN),
 *   • read-only with respect to the database — it returns text, and the admin
 *     publishes by calling the existing `POST /admin/content/faqs`, so a
 *     draft nobody approves changes nothing,
 *   • outside every money, risk, KYC and dispute path, which is what
 *     `Documents/01`, `02`, `06` and `CLAUDE.md` require.
 *
 * Separate file from `ContentAdminController` on purpose: this is the surface
 * a reviewer needs to be able to find and read in one go to confirm the
 * no-LLM-in-risk rule still holds. Burying two endpoints in a 91-line
 * controller of unrelated CRUD would hide exactly the thing that needs to
 * stay visible.
 */
@Controller("admin/content/ai")
export class ContentAiController {
  constructor(private readonly ai: AiService) {}

  /**
   * Whether drafting is usable, so the admin UI can hide the buttons rather
   * than offer something that will fail. Never returns any part of the key.
   */
  @Roles(...RBAC.editSettings)
  @Get("status")
  status(): AiStatus {
    return this.ai.status();
  }

  @Roles(...RBAC.editSettings)
  @Post("draft")
  async draft(
    @Body(new ZodPipe(zAiDraftRequest)) dto: AiDraftRequest,
  ): Promise<AiDraftResponse> {
    return this.wrap(() => this.ai.draft(dto));
  }

  @Roles(...RBAC.editSettings)
  @Post("translate")
  async translate(
    @Body(new ZodPipe(zAiTranslateRequest)) dto: AiTranslateRequest,
  ): Promise<AiDraftResponse> {
    return this.wrap(() => this.ai.translate(dto));
  }

  /**
   * Domain errors → HTTP. Anything else bubbles to the global filter, which
   * is correct: an unexpected exception here is a bug, and flattening it into
   * a friendly 502 would hide it.
   */
  private async wrap(fn: () => Promise<AiDraftResponse>): Promise<AiDraftResponse> {
    try {
      return await fn();
    } catch (err) {
      if (err instanceof AiDisabledError) {
        // 501, not 503: the service is not implemented *here* (no key), which
        // is a configuration state an admin can act on — not a transient
        // outage they should retry into.
        throw new HttpException(
          "AI drafting is not configured on this environment.",
          HttpStatus.NOT_IMPLEMENTED,
        );
      }
      if (err instanceof AiUpstreamError) {
        // The message is already written for the admin and carries nothing
        // from the upstream body — see AiUpstreamError's docstring.
        throw new HttpException(err.message, HttpStatus.BAD_GATEWAY);
      }
      throw err;
    }
  }
}
