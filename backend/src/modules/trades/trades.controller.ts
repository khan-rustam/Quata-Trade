import { createDecipheriv } from "node:crypto";
import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  Get,
  HttpCode,
  Inject,
  NotFoundException,
  Param,
  Post,
  Query,
  ServiceUnavailableException,
  UnauthorizedException,
  UnprocessableEntityException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import * as argon2 from "argon2";
import { matchedTotpStep } from "../../common/auth/totp-step";
import { z } from "zod";
import type { Kysely } from "kysely";
import {
  ASSET_DECIMALS,
  zConfirmTradeRequest,
  zFeePreviewRequest,
  zIdempotencyKey,
  zOpenTradeRequest,
  zSubmitPaymentRequest,
  zTradesQuery,
  zUuid,
  type ConfirmTradeRequest,
  type FeePreviewResponse,
  type OpenTradeRequest,
  type SubmitPaymentRequest,
  type Trade,
  type TradesQuery,
} from "@quatatrade/shared";
import { CurrentUserId } from "../../common/auth/decorators";
import { RiskService } from "../risk/risk.service";
import { ZodPipe } from "../../common/zod.pipe";
import { DB } from "../../db/database.module";
import type { Database } from "../../db/types";
import type { Env } from "../../config/env";
import { InsufficientFundsError } from "../ledger/ledger.errors";
import {
  EscrowError,
  IllegalTransitionError,
  InvalidProofError,
  OfferUnavailableError,
  TradeNotFoundError,
  TradesPausedError,
} from "../escrow/escrow.errors";
import type { TradeRow } from "../escrow/escrow.service";
import { fiatValueXaf, split } from "../fees/fees";
import { SettingsService } from "../settings/settings.service";
import { PromoService } from "../promo/promo.service";
import { TradesService } from "./trades.service";
import { fetchParties, fetchPayments, mapTrade, mapTradeDetail, type TradeDetailResponse } from "./trades.mapper";
import { missingSecondFactor } from "./second-factors";

/**
 * No shared schema exists for the cancel body (only the idempotency key) —
 * composed here from shared primitives so validation rules stay identical.
 */
const zCancelTradeRequest = z.object({ idempotencyKey: zIdempotencyKey }).strict();
type CancelTradeRequest = z.infer<typeof zCancelTradeRequest>;
type FeePreviewRequest = z.infer<typeof zFeePreviewRequest>;

interface TradesListResponse {
  items: Trade[];
  page: number;
  pageSize: number;
  total: number;
}

const PIN_MAX_ATTEMPTS = 5;
const PIN_LOCK_MINUTES = 15;
const GCM_IV_LENGTH = 12;
const GCM_TAG_LENGTH = 16;

/**
 * AES-256-GCM decrypt: payload layout iv(12) ‖ authTag(16) ‖ ciphertext.
 * Defined locally because src/common/crypto.ts does not exist yet — the auth
 * module MUST encrypt users.totp_secret_enc with this exact layout.
 */
function decryptTotpSecret(encrypted: Buffer, masterKeyB64: string): string {
  if (encrypted.length <= GCM_IV_LENGTH + GCM_TAG_LENGTH) {
    throw new Error("encrypted TOTP secret too short");
  }
  const key = Buffer.from(masterKeyB64, "base64");
  const iv = encrypted.subarray(0, GCM_IV_LENGTH);
  const authTag = encrypted.subarray(GCM_IV_LENGTH, GCM_IV_LENGTH + GCM_TAG_LENGTH);
  const ciphertext = encrypted.subarray(GCM_IV_LENGTH + GCM_TAG_LENGTH);
  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8");
}

/**
 * Domain error → HTTP status (task contract):
 * TradesPaused → 503, TradeNotFound → 404, IllegalTransition/OfferUnavailable → 409,
 * InsufficientFunds → 422. Messages stay generic — no balances/ids leak.
 */
function rethrowAsHttp(err: unknown): never {
  if (err instanceof TradesPausedError) throw new ServiceUnavailableException("trading is temporarily paused");
  if (err instanceof TradeNotFoundError) throw new NotFoundException("trade not found");
  if (err instanceof IllegalTransitionError) throw new ConflictException("trade is not in a state that allows this action");
  if (err instanceof OfferUnavailableError) throw new ConflictException(err.message);
  if (err instanceof InsufficientFundsError) throw new UnprocessableEntityException("insufficient available balance");
  if (err instanceof InvalidProofError) throw new BadRequestException(err.message);
  if (err instanceof EscrowError) throw new ConflictException(err.message);
  throw err;
}

/**
 * Local upload schema — @quatatrade/shared ships no upload schema; strict +
 * length-capped (3MB binary ≈ 4MB base64 chars), mirrors the chat attachment.
 */
const zProofUploadRequest = z
  .object({ file: z.string().min(4).max(4_300_000) })
  .strict();
type ProofUploadRequest = z.infer<typeof zProofUploadRequest>;

@Controller("trades")
export class TradesController {
  constructor(
    @Inject(DB) private readonly db: Kysely<Database>,
    private readonly trades: TradesService,
    private readonly settings: SettingsService,
    private readonly config: ConfigService<Env, true>,
    private readonly risk: RiskService,
    private readonly promo: PromoService,
  ) {}

  /**
   * Fee estimate — no DB writes. Auth required (kept non-public on purpose). The
   * quoted bps mirrors what openTrade will charge in the caller's market: an active
   * trading promo for that country overrides the rail fee, so the preview never
   * over-quotes a fee the user won't actually pay.
   */
  @Post("fee-preview")
  @HttpCode(200)
  async feePreview(
    @CurrentUserId() userId: string,
    @Body(new ZodPipe(zFeePreviewRequest)) dto: FeePreviewRequest,
  ): Promise<FeePreviewResponse> {
    const amount = BigInt(dto.amount);
    const railBps = await this.settings.feeBps(dto.paymentMethod);
    const user = await this.db
      .selectFrom("users")
      .select("country")
      .where("id", "=", userId)
      .executeTakeFirst();
    const promoBps = user ? await this.promo.tradingBps(user.country) : null;
    const feeBps = promoBps ?? railBps;
    const { buyerCredit, fee } = split(amount, feeBps);
    const fiatAmountXaf = fiatValueXaf(amount, BigInt(dto.priceXafPerUnit), ASSET_DECIMALS.USDT_TRC20);
    return {
      amount: amount.toString(),
      feeBps,
      feeAmount: fee.toString(),
      buyerCredit: buyerCredit.toString(),
      fiatAmountXaf: fiatAmountXaf.toString(),
    };
  }

  @Post()
  async open(
    @CurrentUserId() userId: string,
    @Body(new ZodPipe(zOpenTradeRequest)) dto: OpenTradeRequest,
  ): Promise<Trade> {
    // Deterministic risk scoring (monitoring + auto-freeze on egregious patterns).
    // Fail-open: a scoring outage must never block a legitimate trade; a committed
    // auto-freeze is enforced by openTrade's "party is not active" guard.
    await this.risk.scoreTradeOpen(userId, BigInt(dto.amount)).catch(() => undefined);
    const trade = await this.trades.openTrade(userId, dto).catch(rethrowAsHttp);
    return this.toWire(trade);
  }

  @Get()
  async list(
    @CurrentUserId() userId: string,
    @Query(new ZodPipe(zTradesQuery)) query: TradesQuery,
  ): Promise<TradesListResponse> {
    const { items, total } = await this.trades.listTradesForUser(userId, query);
    const [parties, payments] = await Promise.all([
      fetchParties(this.db, items.flatMap((t) => [t.seller_id, t.buyer_id])),
      fetchPayments(this.db, items.map((t) => t.id)),
    ]);
    return {
      items: items.map((t) => mapTrade(t, parties, payments.get(t.id) ?? null)),
      page: query.page,
      pageSize: query.pageSize,
      total,
    };
  }

  /** Party-scoped: non-parties get 404 (never 403 — no existence leak). */
  @Get(":id")
  async detail(
    @CurrentUserId() userId: string,
    @Param("id", new ZodPipe(zUuid)) id: string,
  ): Promise<TradeDetailResponse> {
    const trade = await this.trades.getTradeForParty(id, userId);
    if (!trade) throw new NotFoundException("trade not found");
    const [parties, payment, events, dispute] = await Promise.all([
      fetchParties(this.db, [trade.seller_id, trade.buyer_id]),
      this.trades.getPayment(id),
      this.trades.getEvents(id),
      // disputes.trade_id is UNIQUE — at most one dispute per trade. Surfacing its id
      // lets a party reload the room and act on the dispute (view + submit evidence).
      this.db.selectFrom("disputes").select("id").where("trade_id", "=", id).executeTakeFirst(),
    ]);
    return mapTradeDetail(trade, parties, payment, events, dispute?.id ?? null);
  }

  /** Buyer submits off-platform payment proof (service scopes to the buyer). */
  @Post(":id/pay")
  @HttpCode(200)
  async pay(
    @CurrentUserId() userId: string,
    @Param("id", new ZodPipe(zUuid)) id: string,
    @Body(new ZodPipe(zSubmitPaymentRequest)) dto: SubmitPaymentRequest,
  ): Promise<Trade> {
    const trade = await this.trades.submitPayment(id, userId, dto).catch(rethrowAsHttp);
    return this.toWire(trade);
  }

  /** Buyer uploads a payment receipt (base64) → private proofs bucket; returns the object key. */
  @Post(":id/proof")
  @HttpCode(200)
  async uploadProof(
    @CurrentUserId() userId: string,
    @Param("id", new ZodPipe(zUuid)) id: string,
    @Body(new ZodPipe(zProofUploadRequest)) dto: ProofUploadRequest,
  ): Promise<{ key: string }> {
    return this.trades.uploadProof(id, userId, dto.file).catch(rethrowAsHttp);
  }

  /** Party-scoped short-TTL presigned URLs for the trade's submitted proof files. */
  @Get(":id/proof-urls")
  async proofUrls(
    @CurrentUserId() userId: string,
    @Param("id", new ZodPipe(zUuid)) id: string,
  ): Promise<{ urls: string[] }> {
    return this.trades.proofUrls(id, userId).catch(rethrowAsHttp);
  }

  /**
   * Seller confirms fiat received → escrow releases. When the seller has 2FA
   * enabled the TOTP code is REQUIRED and verified before any state change;
   * PIN is verified when the seller has one set and supplied it (5-attempt lock).
   */
  @Post(":id/confirm")
  @HttpCode(200)
  async confirm(
    @CurrentUserId() userId: string,
    @Param("id", new ZodPipe(zUuid)) id: string,
    @Body(new ZodPipe(zConfirmTradeRequest)) dto: ConfirmTradeRequest,
  ): Promise<Trade> {
    await this.verifySecondFactors(userId, dto);
    const trade = await this.trades.confirmTrade(id, userId, dto.idempotencyKey).catch(rethrowAsHttp);
    return this.toWire(trade);
  }

  /** Buyer cancels; escrow refunds the seller (service enforces who may cancel). */
  @Post(":id/cancel")
  @HttpCode(200)
  async cancel(
    @CurrentUserId() userId: string,
    @Param("id", new ZodPipe(zUuid)) id: string,
    @Body(new ZodPipe(zCancelTradeRequest)) dto: CancelTradeRequest,
  ): Promise<Trade> {
    const trade = await this.trades.cancelTrade(id, userId, dto.idempotencyKey).catch(rethrowAsHttp);
    return this.toWire(trade);
  }

  private async toWire(trade: TradeRow): Promise<Trade> {
    const [parties, payments] = await Promise.all([
      fetchParties(this.db, [trade.seller_id, trade.buyer_id]),
      fetchPayments(this.db, [trade.id]),
    ]);
    return mapTrade(trade, parties, payments.get(trade.id) ?? null);
  }

  /**
   * 2FA + PIN checks for the CALLER's own account, before any money movement.
   * Failures are generic 401s — no hint whether TOTP or PIN mismatched, and
   * nothing about the code/secret is ever logged or returned.
   */
  private async verifySecondFactors(userId: string, dto: ConfirmTradeRequest): Promise<void> {
    const user = await this.db
      .selectFrom("users")
      .select(["totp_enabled", "totp_secret_enc", "pin_hash", "pin_attempts", "pin_locked_until"])
      .where("id", "=", userId)
      .executeTakeFirst();
    if (!user) throw new UnauthorizedException("verification failed");

    // Presence: an enrolled factor is MANDATORY on this money-release action and
    // can never be bypassed by omitting the field (Documents/08 §E).
    const missing = missingSecondFactor(
      { totpEnabled: user.totp_enabled, hasPin: Boolean(user.pin_hash) },
      dto,
    );
    if (missing === "totp") throw new BadRequestException("totpCode is required");
    if (missing === "pin") throw new BadRequestException("pin is required");

    if (user.totp_enabled && dto.totpCode) {
      let valid = false;
      if (user.totp_secret_enc) {
        try {
          const secret = decryptTotpSecret(
            user.totp_secret_enc,
            this.config.get("MASTER_ENCRYPTION_KEY", { infer: true }),
          );
          const step = matchedTotpStep(dto.totpCode, secret);
          if (step !== null) {
            // Single-use: advance the last-consumed step atomically; a replay loses the race.
            const res = await this.db
              .updateTable("users")
              .set({ totp_last_step: step })
              .where("id", "=", userId)
              .where((eb) => eb.or([eb("totp_last_step", "is", null), eb("totp_last_step", "<", step)]))
              .executeTakeFirst();
            valid = res.numUpdatedRows === 1n;
          }
        } catch {
          valid = false; // decrypt/verify failure — stay generic
        }
      }
      if (!valid) throw new UnauthorizedException("verification failed");
    }

    if (user.pin_hash && dto.pin) {
      if (user.pin_locked_until && user.pin_locked_until.getTime() > Date.now()) {
        throw new UnauthorizedException("verification failed");
      }
      const valid = await argon2.verify(user.pin_hash, dto.pin).catch(() => false);
      if (!valid) {
        const attempts = user.pin_attempts + 1;
        if (attempts >= PIN_MAX_ATTEMPTS) {
          await this.db
            .updateTable("users")
            .set({
              pin_attempts: 0,
              pin_locked_until: new Date(Date.now() + PIN_LOCK_MINUTES * 60_000),
              updated_at: new Date(),
            })
            .where("id", "=", userId)
            .execute();
        } else {
          await this.db
            .updateTable("users")
            .set({ pin_attempts: attempts, updated_at: new Date() })
            .where("id", "=", userId)
            .execute();
        }
        throw new UnauthorizedException("verification failed");
      }
      if (user.pin_attempts > 0 || user.pin_locked_until) {
        await this.db
          .updateTable("users")
          .set({ pin_attempts: 0, pin_locked_until: null, updated_at: new Date() })
          .where("id", "=", userId)
          .execute();
      }
    }
  }
}
