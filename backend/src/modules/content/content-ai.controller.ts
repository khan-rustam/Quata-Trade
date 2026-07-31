import {
  Body,
  Controller,
  Delete,
  Get,
  HttpException,
  HttpStatus,
  Post,
  Put,
  Req,
} from "@nestjs/common";
import {
  zAiDraftRequest,
  zAiTranslateRequest,
  zSetAiCredentialRequest,
  type AiCredentialStatus,
  type AiDraftRequest,
  type AiDraftResponse,
  type AiStatus,
  type AiTranslateRequest,
  type SetAiCredentialRequest,
} from "@quatatrade/shared";
import { ZodPipe } from "../../common/zod.pipe";
import { CurrentAdminId, Roles } from "../../common/auth/decorators";
import type { AuthenticatedRequest } from "../../common/auth/jwt.types";
import { RBAC } from "../admin/admin.rbac";
import { AiCredentialsService } from "../ai/ai-credentials.service";
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
  constructor(
    private readonly ai: AiService,
    private readonly credentials: AiCredentialsService,
  ) {}

  /**
   * Whether drafting is usable, so the admin UI can hide the buttons rather
   * than offer something that will fail. Never returns any part of the key.
   */
  @Roles(...RBAC.editSettings)
  @Get("status")
  status(): Promise<AiStatus> {
    return this.ai.status();
  }

  // ── credentials ─────────────────────────────────────────────────────────
  //
  // SUPER_ADMIN only, deliberately narrower than the drafting endpoints
  // above. Using the feature is a content job; holding the key that bills the
  // OpenAI account is not, and `RBAC.editSettings` also includes
  // FINANCE_ADMIN. This matches how `manageWalletConfig` and `manageAdmins`
  // are scoped.

  /**
   * Whether a key is configured, where it came from, and its fingerprint.
   * Never the key — there is no code path that returns it.
   */
  @Roles(...RBAC.manageAdmins)
  @Get("credentials")
  credentialStatus(): Promise<AiCredentialStatus> {
    return this.credentials.status();
  }

  /** Store a new key, encrypted at rest. Audited. */
  @Roles(...RBAC.manageAdmins)
  @Put("credentials")
  setCredentials(
    @Body(new ZodPipe(zSetAiCredentialRequest)) dto: SetAiCredentialRequest,
    @CurrentAdminId() adminId: string,
    @Req() req: AuthenticatedRequest,
  ): Promise<AiCredentialStatus> {
    return this.credentials.set(dto.apiKey, { id: adminId, ip: req.ip });
  }

  /** Remove the admin-set key. Falls back to the env var, if one is set. */
  @Roles(...RBAC.manageAdmins)
  @Delete("credentials")
  clearCredentials(
    @CurrentAdminId() adminId: string,
    @Req() req: AuthenticatedRequest,
  ): Promise<AiCredentialStatus> {
    return this.credentials.clear({ id: adminId, ip: req.ip });
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
