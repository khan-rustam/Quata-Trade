import { z } from "zod";
import { PAYMENT_METHODS, TRADE_STATUSES } from "../constants.js";
import {
  zAmount,
  zIdempotencyKey,
  zPaginated,
  zPin,
  zPositiveAmount,
  zTotpCode,
  zUuid,
} from "./common.js";
import { zAssetCode } from "./wallet.js";

export const zOpenTradeRequest = z
  .object({
    offerId: zUuid,
    /** crypto amount in smallest units */
    amount: zPositiveAmount,
    paymentMethod: z.enum(PAYMENT_METHODS),
    idempotencyKey: zIdempotencyKey,
  })
  .strict();
export type OpenTradeRequest = z.infer<typeof zOpenTradeRequest>;

export const zSubmitPaymentRequest = z
  .object({
    reference: z.string().trim().min(3).max(120),
    senderName: z.string().trim().min(2).max(120),
    senderNumber: z.string().trim().min(5).max(30),
    /** MinIO object keys returned by the upload endpoint */
    proofFiles: z.array(z.string().max(512)).max(5).default([]),
  })
  .strict();
export type SubmitPaymentRequest = z.infer<typeof zSubmitPaymentRequest>;

export const zConfirmTradeRequest = z
  .object({
    /** required when the seller has 2FA enabled */
    totpCode: zTotpCode.optional(),
    pin: zPin.optional(),
    idempotencyKey: zIdempotencyKey,
  })
  .strict();
export type ConfirmTradeRequest = z.infer<typeof zConfirmTradeRequest>;

export const zTradeParty = z.object({
  id: zUuid,
  displayName: z.string(),
  reputationScore: z.number().int(),
});

/** Where the buyer sends fiat off-platform — the seller's receiving account for this trade's method. */
export const zSellerPayTo = z.object({
  method: z.enum(PAYMENT_METHODS),
  number: z.string(),
  name: z.string(),
});

export const zTradePayment = z.object({
  reference: z.string(),
  senderName: z.string(),
  senderNumber: z.string(),
  proofFiles: z.array(z.string()),
  submittedAt: z.string(),
});

export const zTrade = z.object({
  id: zUuid,
  shortRef: z.string(),
  offerId: zUuid,
  seller: zTradeParty,
  buyer: zTradeParty,
  asset: zAssetCode,
  amount: zAmount,
  priceXafPerUnit: zAmount,
  fiatAmountXaf: zAmount,
  paymentMethod: z.enum(PAYMENT_METHODS),
  feeBps: z.number().int(),
  feeAmount: zAmount,
  /** amount − fee: what the buyer receives on release */
  buyerCredit: zAmount,
  status: z.enum(TRADE_STATUSES),
  paymentDeadline: z.string().nullable(),
  payment: zTradePayment.nullable(),
  /** null when the seller hasn't set a receiving account for this payment method */
  sellerPayTo: zSellerPayTo.nullable(),
  completedAt: z.string().nullable(),
  createdAt: z.string(),
});
export type Trade = z.infer<typeof zTrade>;

export const zTradeEvent = z.object({
  id: zUuid,
  fromStatus: z.enum(TRADE_STATUSES).nullable(),
  toStatus: z.enum(TRADE_STATUSES),
  actor: z.string(),
  createdAt: z.string(),
});
export type TradeEvent = z.infer<typeof zTradeEvent>;

export const zTradeDetailResponse = z.object({
  trade: zTrade,
  events: z.array(zTradeEvent),
  /** The dispute for this trade, if one was opened — lets a party reload and act on
   * it after leaving the room. null when the trade has never been disputed. */
  disputeId: zUuid.nullable(),
});

/** Payment-proof upload → the stored object key; include in submitPayment.proofFiles. */
export const zUploadKeyResponse = z.object({ key: z.string() });
/** Short-TTL presigned URLs for a trade's submitted proof files (party-scoped). */
export const zTradeProofUrlsResponse = z.object({ urls: z.array(z.string()) });

export const zTradesQuery = z.object({
  status: z.enum(TRADE_STATUSES).optional(),
  role: z.enum(["buyer", "seller"]).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});
export type TradesQuery = z.infer<typeof zTradesQuery>;

export const zTradesResponse = zPaginated(zTrade);

/** Pure fee preview (mirrors backend fees module exactly). */
export const zFeePreviewRequest = z
  .object({
    amount: zPositiveAmount,
    paymentMethod: z.enum(PAYMENT_METHODS),
    priceXafPerUnit: zPositiveAmount,
  })
  .strict();

export const zFeePreviewResponse = z.object({
  amount: zAmount,
  feeBps: z.number().int(),
  feeAmount: zAmount,
  buyerCredit: zAmount,
  fiatAmountXaf: zAmount,
});
export type FeePreviewResponse = z.infer<typeof zFeePreviewResponse>;
