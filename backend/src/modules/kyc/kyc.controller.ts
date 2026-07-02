import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  Get,
  HttpCode,
  Ip,
  Post,
} from "@nestjs/common";
import { zKycSubmitRequest, type KycStatusResponse, type KycSubmitRequest } from "@quatatrade/shared";
import { ZodPipe } from "../../common/zod.pipe";
import { CurrentUserId } from "../../common/auth/decorators";
import { KycService, type KycSubmitResult } from "./kyc.service";
import { zKycUploadRequest, type KycUploadRequest, type KycUploadResponse } from "./kyc.schemas";
import {
  FileOwnershipError,
  FileValidationError,
  PendingSubmissionExistsError,
  TierProgressionError,
} from "./kyc.errors";

/**
 * /api/v1/kyc — authenticated users only (global JwtAuthGuard; typ=user).
 * Admin review lives in the admin module → KycAdminService (no HTTP here).
 */
@Controller("kyc")
export class KycController {
  constructor(private readonly kyc: KycService) {}

  @Post("upload")
  @HttpCode(201)
  async upload(
    @CurrentUserId() userId: string,
    @Body(new ZodPipe(zKycUploadRequest)) dto: KycUploadRequest,
    @Ip() ip: string,
  ): Promise<KycUploadResponse> {
    try {
      return await this.kyc.upload(userId, dto, ip);
    } catch (err) {
      if (err instanceof FileValidationError) throw new BadRequestException(err.message);
      throw err;
    }
  }

  @Post("submit")
  @HttpCode(201)
  async submit(
    @CurrentUserId() userId: string,
    @Body(new ZodPipe(zKycSubmitRequest)) dto: KycSubmitRequest,
    @Ip() ip: string,
  ): Promise<KycSubmitResult> {
    try {
      return await this.kyc.submit(userId, dto, ip);
    } catch (err) {
      if (err instanceof PendingSubmissionExistsError) throw new ConflictException(err.message);
      if (err instanceof TierProgressionError || err instanceof FileOwnershipError) {
        throw new BadRequestException(err.message);
      }
      throw err;
    }
  }

  @Get("status")
  async status(@CurrentUserId() userId: string): Promise<KycStatusResponse> {
    return this.kyc.status(userId);
  }
}
