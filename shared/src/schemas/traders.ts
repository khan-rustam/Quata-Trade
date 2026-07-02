import { z } from "zod";
import { AVATAR_STYLES, REPUTATION_TIERS } from "../constants.js";
import { zUuid } from "./common.js";

/**
 * Public merchant profile — what any visitor sees about a trader before trading
 * with them (the P2P trust triple + tier). Read-only, whitelisted: never leaks
 * email, phone, real name (displayName is server-resolved: opt-in handle, else masked).
 */
export const zPublicTrader = z.object({
  id: zUuid,
  displayName: z.string(),
  avatarStyle: z.enum(AVATAR_STYLES).nullable(),
  avatarSeed: z.string().nullable(),
  bio: z.string().nullable(),
  reputationScore: z.number().int(),
  reputationTier: z.enum(REPUTATION_TIERS),
  completedTrades: z.number().int(),
  completionRate: z.number(), // 0..100, display only — not money
  kycTier: z.number().int().min(0).max(3),
  memberSince: z.string(), // ISO
  activeOffers: z.number().int(),
});
export type PublicTrader = z.infer<typeof zPublicTrader>;
