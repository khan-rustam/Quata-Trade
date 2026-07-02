import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  Get,
  NotFoundException,
  Param,
  Post,
} from "@nestjs/common";
import { z } from "zod";
import {
  zOpenDisputeRequest,
  zSubmitEvidenceRequest,
  zUuid,
  type OpenDisputeRequest,
  type SubmitEvidenceRequest,
} from "@quatatrade/shared";
import { ZodPipe } from "../../common/zod.pipe";
import { CurrentUserId } from "../../common/auth/decorators";
import { IllegalTransitionError, TradeNotFoundError } from "../escrow/escrow.errors";
import { DisputesService, type DisputeView } from "./disputes.service";
import {
  DisputeAlreadyOpenError,
  DisputeNotFoundError,
  DisputeResolvedError,
  InvalidEvidenceFileError,
} from "./disputes.errors";

/**
 * Local upload schema — @quatatrade/shared is frozen and ships no upload
 * schema; strict + length-capped (5MB binary ≈ 6.7MB base64 chars).
 */
const zEvidenceUploadRequest = z
  .object({
    /** raw base64 (no data: URL prefix) */
    file: z.string().min(4).max(7_200_000),
  })
  .strict();
type EvidenceUploadRequest = z.infer<typeof zEvidenceUploadRequest>;

@Controller()
export class DisputesController {
  constructor(private readonly disputes: DisputesService) {}

  @Post("trades/:id/dispute")
  async openDispute(
    @CurrentUserId() userId: string,
    @Param("id", new ZodPipe(zUuid)) tradeId: string,
    @Body(new ZodPipe(zOpenDisputeRequest)) dto: OpenDisputeRequest,
  ): Promise<DisputeView> {
    return this.mapErrors(() => this.disputes.openDispute(tradeId, userId, dto));
  }

  @Post("disputes/:id/evidence")
  async submitEvidence(
    @CurrentUserId() userId: string,
    @Param("id", new ZodPipe(zUuid)) disputeId: string,
    @Body(new ZodPipe(zSubmitEvidenceRequest)) dto: SubmitEvidenceRequest,
  ): Promise<DisputeView> {
    return this.mapErrors(() => this.disputes.submitEvidence(disputeId, userId, dto));
  }

  @Get("disputes/:id")
  async getDispute(
    @CurrentUserId() userId: string,
    @Param("id", new ZodPipe(zUuid)) disputeId: string,
  ): Promise<DisputeView> {
    return this.mapErrors(() => this.disputes.getDispute(disputeId, userId));
  }

  @Post("disputes/:id/upload")
  async uploadEvidence(
    @CurrentUserId() userId: string,
    @Param("id", new ZodPipe(zUuid)) disputeId: string,
    @Body(new ZodPipe(zEvidenceUploadRequest)) dto: EvidenceUploadRequest,
  ): Promise<{ key: string }> {
    return this.mapErrors(() => this.disputes.uploadEvidenceFile(disputeId, userId, dto.file));
  }

  /** Domain errors → HTTP; anything else bubbles to the global filter. */
  private async mapErrors<T>(fn: () => Promise<T>): Promise<T> {
    try {
      return await fn();
    } catch (err) {
      if (err instanceof TradeNotFoundError) throw new NotFoundException("trade not found");
      if (err instanceof DisputeNotFoundError) throw new NotFoundException("dispute not found");
      if (err instanceof DisputeAlreadyOpenError) throw new ConflictException(err.message);
      if (err instanceof DisputeResolvedError) throw new ConflictException(err.message);
      if (err instanceof IllegalTransitionError) {
        throw new ConflictException("trade is not in a disputable state");
      }
      if (err instanceof InvalidEvidenceFileError) throw new BadRequestException(err.message);
      throw err;
    }
  }
}
