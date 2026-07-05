import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  HttpCode,
  NotFoundException,
  Param,
  Post,
  Query,
  ServiceUnavailableException,
  UnprocessableEntityException,
} from "@nestjs/common";
import {
  serializeAmount,
  zAddWithdrawalAddressRequest,
  zPagination,
  zUuid,
  zWithdrawalRequest,
  type AddWithdrawalAddressRequest,
  type Ok,
  type Pagination,
  type Withdrawal,
  type WithdrawalAddress,
  type WithdrawalRequest,
} from "@quatatrade/shared";
import { ZodPipe } from "../../common/zod.pipe";
import { CurrentUserId } from "../../common/auth/decorators";
import { RiskService } from "../risk/risk.service";
import { SettingsService } from "../settings/settings.service";
import { InsufficientFundsError, SerializationRetryExhaustedError } from "../ledger/ledger.errors";
import { BlockedAddressError } from "../screening/screening.errors";
import { WithdrawalsService, type WithdrawalRow } from "./withdrawals.service";
import {
  IdempotencyConflictError,
  InvalidWithdrawalAddressError,
  WithdrawalAddressExistsError,
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
function toWire(row: WithdrawalRow, networkFeeEstimate: string): Withdrawal {
  return {
    id: row.id,
    asset: row.asset,
    toAddress: row.to_address,
    amount: serializeAmount(row.amount),
    fee: serializeAmount(row.fee),
    networkFeeEstimate,
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
  constructor(
    private readonly withdrawals: WithdrawalsService,
    private readonly risk: RiskService,
    private readonly settings: SettingsService,
  ) {}

  /** Per-asset network-fee estimate as a wire string (display only). */
  private async netEstimate(asset: string): Promise<string> {
    return serializeAmount(await this.settings.withdrawalNetworkFee(asset));
  }

  @Post()
  async request(
    @CurrentUserId() userId: string,
    @Body(new ZodPipe(zWithdrawalRequest)) dto: WithdrawalRequest,
  ): Promise<Withdrawal> {
    // Deterministic risk scoring (monitoring + auto-freeze on egregious velocity/
    // near-limit patterns). Fail-open; a committed auto-freeze is enforced by
    // WithdrawalsService.request's "account is not active" guard.
    await this.risk.scoreWithdrawal(userId, BigInt(dto.amount)).catch(() => undefined);
    try {
      const wd = await this.withdrawals.request(userId, dto);
      return toWire(wd, await this.netEstimate(wd.asset));
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
    const est = await this.netEstimate("USDT_TRC20");
    return { items: items.map((w) => toWire(w, est)), page: query.page, pageSize: query.pageSize, total };
  }

  // ---- address whitelist (declared before :id so /addresses isn't captured as an id) ----

  @Get("addresses")
  async listAddresses(@CurrentUserId() userId: string): Promise<{ addresses: WithdrawalAddress[] }> {
    return { addresses: await this.withdrawals.listAddresses(userId) };
  }

  @Post("addresses")
  async addAddress(
    @CurrentUserId() userId: string,
    @Body(new ZodPipe(zAddWithdrawalAddressRequest)) dto: AddWithdrawalAddressRequest,
  ): Promise<WithdrawalAddress> {
    try {
      return await this.withdrawals.addAddress(userId, dto);
    } catch (err) {
      throw this.mapError(err);
    }
  }

  @Delete("addresses/:id")
  @HttpCode(200)
  async removeAddress(
    @CurrentUserId() userId: string,
    @Param("id", new ZodPipe(zUuid)) id: string,
  ): Promise<Ok> {
    await this.withdrawals.removeAddress(userId, id);
    return { ok: true };
  }

  @Get(":id")
  async get(
    @CurrentUserId() userId: string,
    @Param("id", new ZodPipe(zUuid)) id: string,
  ): Promise<Withdrawal> {
    const row = await this.withdrawals.getForUser(id, userId);
    if (!row) throw new NotFoundException("withdrawal not found");
    return toWire(row, await this.netEstimate(row.asset));
  }

  /** Domain errors → HTTP without leaking internals (generic auth failures). */
  private mapError(err: unknown): Error {
    if (err instanceof WithdrawalsPausedError) return new ServiceUnavailableException(err.message);
    if (err instanceof WithdrawalVerificationError) return new ForbiddenException(err.message);
    if (err instanceof WithdrawalNotEligibleError) return new ForbiddenException(err.message);
    if (err instanceof InvalidWithdrawalAddressError) return new BadRequestException(err.message);
    // Generic — never disclose that an address is specifically sanctioned/blacklisted.
    if (err instanceof BlockedAddressError) return new ForbiddenException("this address is not permitted");
    if (err instanceof WithdrawalCapExceededError) return new UnprocessableEntityException(err.message);
    if (err instanceof IdempotencyConflictError) return new ConflictException(err.message);
    if (err instanceof WithdrawalAddressExistsError) return new ConflictException(err.message);
    if (err instanceof InsufficientFundsError) return new UnprocessableEntityException("insufficient balance");
    if (err instanceof SerializationRetryExhaustedError) {
      return new ConflictException("temporary contention — please retry");
    }
    return err instanceof Error ? err : new Error(String(err));
  }
}
