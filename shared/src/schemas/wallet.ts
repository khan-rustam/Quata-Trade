import { z } from "zod";
import { ASSET_CODES, DEPOSIT_STATUSES, WITHDRAWAL_STATUSES } from "../constants.js";
import {
  zAmount,
  zIdempotencyKey,
  zPaginated,
  zPin,
  zPositiveAmount,
  zTotpCode,
  zTronAddress,
  zUuid,
} from "./common.js";

export const zAssetCode = z.enum(ASSET_CODES);

export const zBalance = z.object({
  asset: zAssetCode,
  available: zAmount,
  inEscrow: zAmount,
});
export type Balance = z.infer<typeof zBalance>;

export const zBalancesResponse = z.object({ balances: z.array(zBalance) });

export const zDepositAddressResponse = z.object({
  asset: zAssetCode,
  address: zTronAddress,
  network: z.string(), // "TRON (TRC20)"
  minDeposit: zAmount,
  confirmationsRequired: z.number().int(),
});
export type DepositAddressResponse = z.infer<typeof zDepositAddressResponse>;

export const zDeposit = z.object({
  id: zUuid,
  asset: zAssetCode,
  amount: zAmount,
  txHash: z.string(),
  confirmations: z.number().int(),
  status: z.enum(DEPOSIT_STATUSES),
  createdAt: z.string(),
});
export type Deposit = z.infer<typeof zDeposit>;

export const zDepositsResponse = zPaginated(zDeposit);

export const zWithdrawalRequest = z
  .object({
    asset: zAssetCode,
    toAddress: zTronAddress,
    amount: zPositiveAmount,
    totpCode: zTotpCode,
    pin: zPin,
    idempotencyKey: zIdempotencyKey,
  })
  .strict();
export type WithdrawalRequest = z.infer<typeof zWithdrawalRequest>;

export const zWithdrawal = z.object({
  id: zUuid,
  asset: zAssetCode,
  toAddress: z.string(),
  amount: zAmount,
  fee: zAmount,
  status: z.enum(WITHDRAWAL_STATUSES),
  txHash: z.string().nullable(),
  failureReason: z.string().nullable(),
  createdAt: z.string(),
});
export type Withdrawal = z.infer<typeof zWithdrawal>;

export const zWithdrawalsResponse = zPaginated(zWithdrawal);

/**
 * Withdrawal address whitelist. A withdrawal may ONLY go to a saved, active address
 * whose cooldown has elapsed (usableAt ≤ now) — an attacker can't add + immediately
 * drain to a fresh address.
 */
export const zWithdrawalAddress = z.object({
  id: zUuid,
  asset: zAssetCode,
  address: z.string(),
  label: z.string().nullable(),
  usableAt: z.string(), // ISO — withdrawals allowed only at/after this time
  active: z.boolean(),
  createdAt: z.string(),
});
export type WithdrawalAddress = z.infer<typeof zWithdrawalAddress>;

export const zWithdrawalAddressesResponse = z.object({ addresses: z.array(zWithdrawalAddress) });

export const zAddWithdrawalAddressRequest = z
  .object({
    asset: zAssetCode,
    address: zTronAddress,
    label: z.string().trim().max(60).optional(),
  })
  .strict();
export type AddWithdrawalAddressRequest = z.infer<typeof zAddWithdrawalAddressRequest>;

export const zInternalTransferRequest = z
  .object({
    toEmail: z.string().email(),
    asset: zAssetCode,
    amount: zPositiveAmount,
    pin: zPin,
    idempotencyKey: zIdempotencyKey,
  })
  .strict();
export type InternalTransferRequest = z.infer<typeof zInternalTransferRequest>;
