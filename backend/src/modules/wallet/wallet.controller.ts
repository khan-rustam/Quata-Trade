import {
  BadRequestException,
  Body,
  Controller,
  ForbiddenException,
  Get,
  HttpException,
  Param,
  Post,
  Query,
  ServiceUnavailableException,
  UnauthorizedException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { Env } from "../../config/env";
import { BlockchainRegistry } from "../blockchain/blockchain-registry.service";
import type {
  AssetCode,
  Balance,
  Deposit,
  DepositAddressResponse,
  InternalTransferRequest,
  Ok,
  Pagination,
  WalletStatus,
  WalletInfoResponse,
  BlockchainStatusResponse,
} from "@quatatrade/shared";
import { serializeAmount, zAssetCode, zInternalTransferRequest, zPagination } from "@quatatrade/shared";
import { CurrentUserId } from "../../common/auth/decorators";
import { ZodPipe } from "../../common/zod.pipe";
import { InsufficientFundsError } from "../ledger/ledger.errors";
import { SettingsService } from "../settings/settings.service";
import { DerivationError } from "./derivation";
import {
  AccountRestrictedError,
  PinServiceUnavailableError,
  PinVerificationError,
  TransferFailedError,
  XpubNotConfiguredError,
} from "./wallet.errors";
import { WalletService, type DepositRow } from "./wallet.service";

/**
 * User wallet routes (all behind the global JwtAuthGuard; RolesGuard rejects
 * admin tokens here). Responses conform to shared zod schemas —
 * zBalancesResponse / zDepositAddressResponse / zDepositsResponse / zOk.
 */
@Controller("wallet")
export class WalletController {
  constructor(
    private readonly wallet: WalletService,
    private readonly settings: SettingsService,
    private readonly chain: BlockchainRegistry,
    private readonly config: ConfigService<Env, true>,
  ) {}

  @Get("info")
  async info(@CurrentUserId() userId: string): Promise<WalletInfoResponse> {
    const [wallets, status] = await Promise.all([this.wallet.walletInfo(userId), this.wallet.walletStatus(userId)]);
    return { wallets, status };
  }

  @Get("blockchain-status")
  async blockchainStatus(): Promise<BlockchainStatusResponse> {
    const confirmationsRequired = this.config.get("DEPOSIT_CONFIRMATIONS", { infer: true });
    const health = await this.chain.healthAll();
    return {
      networks: health.map((h) => ({
        network: h.network,
        reachable: h.reachable,
        blockHeight: h.blockHeight,
        confirmationsRequired,
      })),
    };
  }

  @Get("balances")
  async balances(@CurrentUserId() userId: string): Promise<{ balances: Balance[]; status: WalletStatus }> {
    const [balances, status] = await Promise.all([this.wallet.getBalances(userId), this.wallet.walletStatus(userId)]);
    return {
      balances: balances.map((b) => ({
        asset: b.asset,
        available: serializeAmount(b.available),
        inEscrow: serializeAmount(b.inEscrow),
        pending: serializeAmount(b.pending),
      })),
      status,
    };
  }

  @Get("deposits")
  async deposits(
    @CurrentUserId() userId: string,
    @Query(new ZodPipe(zPagination)) pagination: Pagination,
  ): Promise<{ items: Deposit[]; page: number; pageSize: number; total: number }> {
    const { items, total } = await this.wallet.listDeposits(userId, pagination.page, pagination.pageSize);
    return {
      items: items.map((d) => this.toDeposit(d)),
      page: pagination.page,
      pageSize: pagination.pageSize,
      total,
    };
  }

  @Get(":asset/deposit-address")
  async depositAddress(
    @CurrentUserId() userId: string,
    @Param("asset", new ZodPipe(zAssetCode)) asset: AssetCode,
  ): Promise<DepositAddressResponse> {
    try {
      const row = await this.wallet.getOrCreateDepositAddress(userId, asset);
      const policy = await this.settings.depositPolicy();
      return {
        asset,
        address: row.address,
        network: "TRON (TRC20)",
        minDeposit: serializeAmount(policy.minAmount),
        confirmationsRequired: policy.confirmations,
      };
    } catch (err) {
      this.rethrow(err);
    }
  }

  @Post("transfer")
  async transfer(
    @CurrentUserId() userId: string,
    @Body(new ZodPipe(zInternalTransferRequest)) dto: InternalTransferRequest,
  ): Promise<Ok> {
    try {
      await this.wallet.internalTransfer(userId, dto);
      return { ok: true };
    } catch (err) {
      this.rethrow(err);
    }
  }

  private toDeposit(d: DepositRow): Deposit {
    return {
      id: d.id,
      asset: d.asset,
      amount: serializeAmount(d.amount),
      fee: serializeAmount(d.fee),
      net: serializeAmount(d.amount - d.fee),
      txHash: d.tx_hash,
      confirmations: d.confirmations,
      status: d.status,
      createdAt: d.created_at.toISOString(),
    };
  }

  /** Domain error → HTTP mapping. Messages stay fixed — never echo internals. */
  private rethrow(err: unknown): never {
    if (err instanceof HttpException) throw err;
    if (err instanceof TransferFailedError) throw new BadRequestException("unable to complete transfer");
    if (err instanceof InsufficientFundsError) throw new BadRequestException("insufficient balance");
    if (err instanceof AccountRestrictedError) throw new ForbiddenException("account is restricted");
    if (err instanceof PinVerificationError) throw new UnauthorizedException("PIN verification failed");
    if (err instanceof PinServiceUnavailableError) throw new ServiceUnavailableException("transfers are temporarily unavailable");
    if (err instanceof XpubNotConfiguredError || err instanceof DerivationError) {
      throw new ServiceUnavailableException("deposit addresses are temporarily unavailable");
    }
    throw err;
  }
}
