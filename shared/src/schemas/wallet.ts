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
  /** Unconfirmed incoming deposits (SEEN/CONFIRMING) not yet credited. */
  pending: zAmount,
});
export type Balance = z.infer<typeof zBalance>;

/** Wallet/account status surfaced on the dashboard. */
export const zWalletStatus = z.enum(["active", "restricted"]);
export type WalletStatus = z.infer<typeof zWalletStatus>;

export const zBalancesResponse = z.object({ balances: z.array(zBalance), status: zWalletStatus });

/** Consolidated wallet metadata per asset (GET /wallet/info). */
export const zWalletInfo = z.object({
  asset: zAssetCode,
  network: z.string(),
  address: z.string().nullable(),
  provisioned: z.boolean(),
  active: z.boolean(),
  createdAt: z.string().nullable(),
});
export type WalletInfo = z.infer<typeof zWalletInfo>;
export const zWalletInfoResponse = z.object({ wallets: z.array(zWalletInfo), status: zWalletStatus });
export type WalletInfoResponse = z.infer<typeof zWalletInfoResponse>;

/** User-facing blockchain/network status (GET /wallet/blockchain-status). */
export const zBlockchainStatusItem = z.object({
  network: z.string(),
  reachable: z.boolean(),
  blockHeight: z.number().int().nullable(),
  confirmationsRequired: z.number().int(),
});
export type BlockchainStatusItem = z.infer<typeof zBlockchainStatusItem>;
export const zBlockchainStatusResponse = z.object({ networks: z.array(zBlockchainStatusItem) });
export type BlockchainStatusResponse = z.infer<typeof zBlockchainStatusResponse>;

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
  amount: zAmount, // gross received
  fee: zAmount, // platform deposit fee charged
  net: zAmount, // amount − fee (credited to the user)
  txHash: z.string(),
  confirmations: z.number().int(),
  status: z.enum(DEPOSIT_STATUSES),
  /**
   * Parked for manual review (source screening or the amount/limit policy). The
   * row keeps its SEEN/CONFIRMING status — holds are deliberately not a status
   * value — so without this flag a held deposit is indistinguishable from one
   * that is simply still confirming, and the user waits forever with no idea a
   * human has to act.
   */
  onHold: z.boolean(),
  /** Set once an admin decides: RELEASED (will credit) or REJECTED (never will). */
  holdResolution: z.enum(["RELEASED", "REJECTED"]).nullable(),
  createdAt: z.string(),
});
export type Deposit = z.infer<typeof zDeposit>;

export const zDepositsResponse = zPaginated(zDeposit);

/**
 * What a withdrawal will actually cost, before committing. The ledger debits
 * amount + fee, so a client that validates only against `available` lets the
 * user submit their whole balance and then get an insufficient-funds error.
 */
export const zWithdrawalQuote = z.object({
  amount: zAmount,
  fee: zAmount,
  networkFeeEstimate: zAmount,
  /** amount + fee — the figure that must fit inside the available balance. */
  total: zAmount,
});
export type WithdrawalQuote = z.infer<typeof zWithdrawalQuote>;

/**
 * The LIVE fee schedule, for the public /fees page.
 *
 * That page used to hardcode its numbers in the translation catalogue, so it
 * advertised a 0 USDT withdrawal fee while the configured value was 1 USDT and
 * the withdrawal path charged it. Publishing the configured values means the
 * page cannot contradict what is actually taken.
 */
export const zFeeSchedule = z.object({
  depositFee: z.object({ fixed: zAmount, bps: z.number().int() }),
  withdrawalFee: z.object({ fixed: zAmount, bps: z.number().int() }),
  /** Trading fee in basis points per payment rail (100 bps = 1%). */
  tradingFeeBps: z.record(z.string(), z.number().int()),
  sellerFeeBps: z.number().int(),
  minDeposit: zAmount,
});
export type FeeSchedule = z.infer<typeof zFeeSchedule>;

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
  fee: zAmount, // platform withdrawal fee (deducted)
  networkFeeEstimate: zAmount, // estimated on-chain network fee (display only)
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
