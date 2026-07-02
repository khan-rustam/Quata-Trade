import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  ForbiddenException,
  Get,
  NotFoundException,
  Param,
  Post,
  Query,
  ServiceUnavailableException,
  UnprocessableEntityException,
} from "@nestjs/common";
import {
  serializeAmount,
  zPagination,
  zUuid,
  zWithdrawalRequest,
  type Pagination,
  type Withdrawal,
  type WithdrawalRequest,
} from "@quatatrade/shared";
import { ZodPipe } from "../../common/zod.pipe";
import { CurrentUserId } from "../../common/auth/decorators";
import { InsufficientFundsError, SerializationRetryExhaustedError } from "../ledger/ledger.errors";
import { WithdrawalsService, type WithdrawalRow } from "./withdrawals.service";
import {
  IdempotencyConflictError,
  InvalidWithdrawalAddressError,
  WithdrawalCapExceededError,
  WithdrawalNotEligibleError,
  WithdrawalsPausedError,
  WithdrawalVerificationError,
} from "./withdrawals.errors";

interface WithdrawalsPage {
  items: Withdrawal[];
  page: number;
  pageSize: number;
  total: number;
}

/** DB row → zWithdrawal wire shape (amounts as strings, never numbers). */
function toWire(row: WithdrawalRow): Withdrawal {
  return {
    id: row.id,
    asset: row.asset,
    toAddress: row.to_address,
    amount: serializeAmount(row.amount),
    fee: serializeAmount(row.fee),
    status: row.status,
    txHash: row.tx_hash,
    failureReason: row.failure_reason,
    createdAt: row.created_at.toISOString(),
  };
}

/**
 * User-facing withdrawal endpoints only. Admin approve/reject have NO routes
 * here — the admin module calls WithdrawalsService methods behind RolesGuard.
 */
@Controller("withdrawals")
export class WithdrawalsController {
  constructor(private readonly withdrawals: WithdrawalsService) {}

  @Post()
  async request(
    @CurrentUserId() userId: string,
    @Body(new ZodPipe(zWithdrawalRequest)) dto: WithdrawalRequest,
  ): Promise<Withdrawal> {
    try {
      return toWire(await this.withdrawals.request(userId, dto));
    } catch (err) {
      throw this.mapError(err);
    }
  }

  @Get()
  async list(
    @CurrentUserId() userId: string,
    @Query(new ZodPipe(zPagination)) query: Pagination,
  ): Promise<WithdrawalsPage> {
    const { items, total } = await this.withdrawals.listForUser(userId, query.page, query.pageSize);
    return { items: items.map(toWire), page: query.page, pageSize: query.pageSize, total };
  }

  @Get(":id")
  async get(
    @CurrentUserId() userId: string,
    @Param("id", new ZodPipe(zUuid)) id: string,
  ): Promise<Withdrawal> {
    const row = await this.withdrawals.getForUser(id, userId);
    if (!row) throw new NotFoundException("withdrawal not found");
    return toWire(row);
  }

  /** Domain errors → HTTP without leaking internals (generic auth failures). */
  private mapError(err: unknown): Error {
    if (err instanceof WithdrawalsPausedError) return new ServiceUnavailableException(err.message);
    if (err instanceof WithdrawalVerificationError) return new ForbiddenException(err.message);
    if (err instanceof WithdrawalNotEligibleError) return new ForbiddenException(err.message);
    if (err instanceof InvalidWithdrawalAddressError) return new BadRequestException(err.message);
    if (err instanceof WithdrawalCapExceededError) return new UnprocessableEntityException(err.message);
    if (err instanceof IdempotencyConflictError) return new ConflictException(err.message);
    if (err instanceof InsufficientFundsError) return new UnprocessableEntityException("insufficient balance");
    if (err instanceof SerializationRetryExhaustedError) {
      return new ConflictException("temporary contention — please retry");
    }
    return err instanceof Error ? err : new Error(String(err));
  }
}
