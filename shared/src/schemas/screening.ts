import { z } from "zod";
import { zTronAddress, zUuid } from "./common.js";
import { zAssetCode } from "./wallet.js";

/**
 * AML / sanctions / wallet-blacklist screening contract (security remediation item 4).
 * A single deterministic blocklist consulted on every outbound withdrawal destination
 * and every inbound deposit source. Compliance-managed; no LLM in the AML path.
 */

/** Why an address is on the blocklist — drives review priority, never behaviour. */
export const zBlockCategory = z.enum(["sanctions", "blacklist", "manual"]);
export type BlockCategory = z.infer<typeof zBlockCategory>;

export const zBlockedAddress = z
  .object({
    id: zUuid,
    asset: zAssetCode,
    address: z.string(),
    category: zBlockCategory,
    reason: z.string(),
    source: z.string(),
    active: z.boolean(),
    createdAt: z.string(),
  })
  .strict();
export type BlockedAddress = z.infer<typeof zBlockedAddress>;

export const zBlockedAddressesResponse = z
  .object({ addresses: z.array(zBlockedAddress) })
  .strict();
export type BlockedAddressesResponse = z.infer<typeof zBlockedAddressesResponse>;

export const zBlockAddressRequest = z
  .object({
    asset: zAssetCode,
    address: zTronAddress,
    category: zBlockCategory,
    reason: z.string().min(1).max(500),
    source: z.string().max(100).optional(),
  })
  .strict();
export type BlockAddressRequest = z.infer<typeof zBlockAddressRequest>;
