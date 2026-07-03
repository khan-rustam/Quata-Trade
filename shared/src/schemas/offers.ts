import { z } from "zod";
import { OFFER_SIDES, OFFER_STATUSES, PAYMENT_METHODS } from "../constants.js";
import { zAmount, zPaginated, zPositiveAmount, zUuid } from "./common.js";
import { zAssetCode } from "./wallet.js";

export const zCreateOfferRequest = z
  .object({
    side: z.enum(OFFER_SIDES),
    asset: zAssetCode,
    /** XAF per whole USDT, e.g. "650" */
    priceXafPerUnit: zPositiveAmount,
    /** smallest units of the asset */
    minTrade: zPositiveAmount,
    maxTrade: zPositiveAmount,
    totalAmount: zPositiveAmount,
    paymentMethods: z.array(z.enum(PAYMENT_METHODS)).min(1),
    terms: z.string().trim().max(2000).optional(),
  })
  .strict()
  .refine((o) => BigInt(o.minTrade) <= BigInt(o.maxTrade), {
    message: "minTrade must be ≤ maxTrade",
    path: ["minTrade"],
  })
  .refine((o) => BigInt(o.maxTrade) <= BigInt(o.totalAmount), {
    message: "maxTrade must be ≤ totalAmount",
    path: ["maxTrade"],
  });
export type CreateOfferRequest = z.infer<typeof zCreateOfferRequest>;

export const zUpdateOfferRequest = z
  .object({
    priceXafPerUnit: zPositiveAmount.optional(),
    minTrade: zPositiveAmount.optional(),
    maxTrade: zPositiveAmount.optional(),
    paymentMethods: z.array(z.enum(PAYMENT_METHODS)).min(1).optional(),
    terms: z.string().trim().max(2000).nullable().optional(),
  })
  .strict();
export type UpdateOfferRequest = z.infer<typeof zUpdateOfferRequest>;

export const zOfferTrader = z.object({
  id: zUuid,
  displayName: z.string(),
  reputationScore: z.number().int(),
  completedTrades: z.number().int(),
  completionRate: z.number(), // 0..100, display only — not money
  kycTier: z.number().int(),
});

export const zOffer = z.object({
  id: zUuid,
  side: z.enum(OFFER_SIDES),
  asset: zAssetCode,
  priceXafPerUnit: zAmount,
  minTrade: zAmount,
  maxTrade: zAmount,
  remaining: zAmount,
  paymentMethods: z.array(z.enum(PAYMENT_METHODS)),
  terms: z.string().nullable(),
  status: z.enum(OFFER_STATUSES),
  trader: zOfferTrader,
  createdAt: z.string(),
});
export type Offer = z.infer<typeof zOffer>;

export const zOffersQuery = z.object({
  side: z.enum(OFFER_SIDES).optional(),
  method: z.enum(PAYMENT_METHODS).optional(),
  minAmount: zAmount.optional(),
  maxAmount: zAmount.optional(),
  verifiedOnly: z.coerce.boolean().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});
export type OffersQuery = z.infer<typeof zOffersQuery>;

export const zOffersResponse = zPaginated(zOffer);

/** A user's own offers — includes PAUSED/EXHAUSTED (not just ACTIVE), newest first. */
export const zMyOffersResponse = z.object({ items: z.array(zOffer) });
export type MyOffersResponse = z.infer<typeof zMyOffersResponse>;
