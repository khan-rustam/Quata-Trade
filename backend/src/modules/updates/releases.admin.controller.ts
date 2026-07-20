import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpException,
  NotFoundException,
  Param,
  Patch,
  Post,
  Query,
  Req,
} from "@nestjs/common";
import { z } from "zod";
import {
  APP_PLATFORMS,
  zPublishReleaseRequest,
  zReleaseStatusRequest,
  zUuid,
  type AppPlatform,
  type AppRelease,
  type PublishReleaseRequest,
  type ReleaseStatusRequest,
  type ReleasesResponse,
} from "@quatatrade/shared";
import { CurrentAdminId, Roles } from "../../common/auth/decorators";
import type { AuthenticatedRequest } from "../../common/auth/jwt.types";
import { ZodPipe } from "../../common/zod.pipe";
import { RBAC } from "../admin/admin.rbac";
import { AdminAuthService } from "../admin/admin-auth.service";
import { UpdatesService } from "./updates.service";
import { DuplicateReleaseError, ReleaseNotFoundError } from "./updates.errors";

const zAdminListQuery = z.object({ platform: z.enum(APP_PLATFORMS).optional() });

/**
 * Release Management (admin). SUPER_ADMIN only + TOTP step-up: publishing or
 * rolling back a release reaches every client, so it is treated like the other
 * high-blast-radius admin actions (kill switch, ledger adjustment). Every action
 * is hash-chain audit-logged.
 */
@Controller("admin/releases")
export class ReleasesAdminController {
  constructor(
    private readonly updates: UpdatesService,
    private readonly adminAuth: AdminAuthService,
  ) {}

  @Roles(...RBAC.manageReleases)
  @Get()
  async list(@Query(new ZodPipe(zAdminListQuery)) q: { platform?: AppPlatform }): Promise<ReleasesResponse> {
    return { items: await this.updates.listAll(q.platform) };
  }

  @Roles(...RBAC.manageReleases)
  @Post()
  async publish(
    @CurrentAdminId() adminId: string,
    @Body(new ZodPipe(zPublishReleaseRequest)) dto: PublishReleaseRequest,
    @Req() req: AuthenticatedRequest,
  ): Promise<AppRelease> {
    await this.adminAuth.verifyTotp(adminId, dto.totpCode, "release.publish", req.ip);
    try {
      return await this.updates.publish(adminId, dto, req.ip);
    } catch (err) {
      throw this.toHttp(err);
    }
  }

  @Roles(...RBAC.manageReleases)
  @Patch(":id")
  async setStatus(
    @CurrentAdminId() adminId: string,
    @Param("id", new ZodPipe(zUuid)) id: string,
    @Body(new ZodPipe(zReleaseStatusRequest)) dto: ReleaseStatusRequest,
    @Req() req: AuthenticatedRequest,
  ): Promise<AppRelease> {
    await this.adminAuth.verifyTotp(adminId, dto.totpCode, `release.${dto.status}`, req.ip);
    try {
      return await this.updates.setStatus(adminId, id, dto, req.ip);
    } catch (err) {
      throw this.toHttp(err);
    }
  }

  private toHttp(err: unknown): unknown {
    if (err instanceof HttpException) return err;
    if (err instanceof DuplicateReleaseError) return new BadRequestException(err.message);
    if (err instanceof ReleaseNotFoundError) return new NotFoundException(err.message);
    return err;
  }
}
