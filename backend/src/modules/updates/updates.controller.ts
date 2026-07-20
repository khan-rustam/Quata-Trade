import { Controller, Get, Query } from "@nestjs/common";
import { z } from "zod";
import {
  APP_PLATFORMS,
  type AppPlatform,
  type CheckUpdateResponse,
  type MinSupportedResponse,
  type ReleasesResponse,
  type VersionResponse,
} from "@quatatrade/shared";
import { Public } from "../../common/auth/decorators";
import { ZodPipe } from "../../common/zod.pipe";
import { UpdatesService } from "./updates.service";

/** `?platform=web` (default web). Query params are coerced from strings. */
const zPlatformQuery = z.object({
  platform: z.enum(APP_PLATFORMS).default("web"),
});

const zCheckQuery = z.object({
  platform: z.enum(APP_PLATFORMS).default("web"),
  /** The caller's installed build ordinal. */
  versionCode: z.coerce.number().int().min(0).default(0),
});

/**
 * Public update endpoints (Documents/12 update management). Unauthenticated by
 * design: a client must be able to learn it is too old to talk to the API *before*
 * it authenticates. Read-only; no secrets.
 */
@Controller("updates")
export class UpdatesController {
  constructor(private readonly updates: UpdatesService) {}

  @Public()
  @Get("version")
  version(@Query(new ZodPipe(zPlatformQuery)) q: { platform: AppPlatform }): Promise<VersionResponse> {
    return this.updates.versionInfo(q.platform);
  }

  @Public()
  @Get("check")
  check(
    @Query(new ZodPipe(zCheckQuery)) q: { platform: AppPlatform; versionCode: number },
  ): Promise<CheckUpdateResponse> {
    return this.updates.check(q.platform, q.versionCode);
  }

  @Public()
  @Get("releases")
  async releases(@Query(new ZodPipe(zPlatformQuery)) q: { platform: AppPlatform }): Promise<ReleasesResponse> {
    return { items: await this.updates.listPublished(q.platform) };
  }

  @Public()
  @Get("minimum-supported-version")
  async minimumSupportedVersion(
    @Query(new ZodPipe(zPlatformQuery)) q: { platform: AppPlatform },
  ): Promise<MinSupportedResponse> {
    const info = await this.updates.versionInfo(q.platform);
    return { platform: info.platform, minSupportedCode: info.minSupportedCode };
  }
}
