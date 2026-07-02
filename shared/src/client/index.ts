import type { z } from "zod";
import {
  zAuthTokensResponse,
  zRegisterResponse,
  type LoginRequest,
  type RegisterRequest,
} from "../schemas/auth.js";
import { zOk, type Ok } from "../schemas/common.js";
import { zSessionsResponse, zUserProfile, type UpdateProfileRequest } from "../schemas/users.js";
import { zKycStatusResponse, type KycSubmitRequest } from "../schemas/kyc.js";
import {
  zBalancesResponse,
  zDepositAddressResponse,
  zDepositsResponse,
  zWithdrawal,
  zWithdrawalsResponse,
  type InternalTransferRequest,
  type WithdrawalRequest,
} from "../schemas/wallet.js";
import {
  zOffer,
  zOffersResponse,
  type CreateOfferRequest,
  type OffersQuery,
  type UpdateOfferRequest,
} from "../schemas/offers.js";
import {
  zFeePreviewResponse,
  zTrade,
  zTradeDetailResponse,
  zTradesResponse,
  type ConfirmTradeRequest,
  type OpenTradeRequest,
  type SubmitPaymentRequest,
  type TradesQuery,
} from "../schemas/trades.js";
import { zDispute, type OpenDisputeRequest, type SubmitEvidenceRequest } from "../schemas/disputes.js";
import { zMessagesResponse, type SendMessageRequest } from "../schemas/chat.js";
import { zNotificationsResponse } from "../schemas/notifications.js";

export class ApiClientError extends Error {
  constructor(
    public readonly status: number,
    public readonly body: unknown,
    message?: string,
  ) {
    super(message ?? `API error ${status}`);
    this.name = "ApiClientError";
  }
}

export interface ApiClientOptions {
  baseUrl: string;
  /** Access token lives in memory only — never localStorage. */
  getAccessToken?: () => string | null;
  onUnauthorized?: () => void | Promise<void>;
  fetchFn?: typeof fetch;
}

type Query = Record<string, string | number | boolean | undefined>;

/**
 * The one and only HTTP client. Frontend components never call fetch directly
 * (Documents/07-frontend-spec.md). Every response is parsed with the same zod
 * schema the backend validates against — drift is a runtime + compile error.
 */
export class QuataApiClient {
  constructor(private readonly opts: ApiClientOptions) {}

  private async request<S extends z.ZodTypeAny>(
    method: string,
    path: string,
    schema: S,
    body?: unknown,
    query?: Query,
  ): Promise<z.infer<S>> {
    const url = new URL(path, this.opts.baseUrl);
    if (query) {
      for (const [k, v] of Object.entries(query)) {
        if (v !== undefined) url.searchParams.set(k, String(v));
      }
    }
    const token = this.opts.getAccessToken?.();
    const fetchFn = this.opts.fetchFn ?? fetch;
    const res = await fetchFn(url.toString(), {
      method,
      headers: {
        ...(body !== undefined ? { "content-type": "application/json" } : {}),
        ...(token ? { authorization: `Bearer ${token}` } : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
      credentials: "include", // refresh token cookie
    });

    if (res.status === 401) {
      await this.opts.onUnauthorized?.();
    }
    const text = await res.text();
    const json: unknown = text.length > 0 ? JSON.parse(text) : null;
    if (!res.ok) {
      throw new ApiClientError(res.status, json);
    }
    return schema.parse(json) as z.infer<S>;
  }

  // ---- auth ----
  register = (body: RegisterRequest) => this.request("POST", "/api/v1/auth/register", zRegisterResponse, body);
  verifyEmail = (body: { email: string; code: string }): Promise<Ok> =>
    this.request("POST", "/api/v1/auth/verify-email", zOk, body);
  login = (body: LoginRequest) => this.request("POST", "/api/v1/auth/login", zAuthTokensResponse, body);
  refresh = () => this.request("POST", "/api/v1/auth/refresh", zAuthTokensResponse);
  logout = (): Promise<Ok> => this.request("POST", "/api/v1/auth/logout", zOk);
  forgotPassword = (body: { email: string }): Promise<Ok> =>
    this.request("POST", "/api/v1/auth/forgot", zOk, body);
  resetPassword = (body: { token: string; password: string }): Promise<Ok> =>
    this.request("POST", "/api/v1/auth/reset", zOk, body);

  // ---- users ----
  me = () => this.request("GET", "/api/v1/users/me", zUserProfile);
  updateProfile = (body: UpdateProfileRequest) => this.request("PATCH", "/api/v1/users/me", zUserProfile, body);
  sessions = () => this.request("GET", "/api/v1/users/me/sessions", zSessionsResponse);
  revokeSession = (id: string): Promise<Ok> => this.request("DELETE", `/api/v1/users/me/sessions/${id}`, zOk);

  // ---- kyc ----
  kycStatus = () => this.request("GET", "/api/v1/kyc/status", zKycStatusResponse);
  kycSubmit = (body: KycSubmitRequest): Promise<Ok> => this.request("POST", "/api/v1/kyc/submit", zOk, body);

  // ---- wallet ----
  balances = () => this.request("GET", "/api/v1/wallet/balances", zBalancesResponse);
  depositAddress = (asset: string) =>
    this.request("GET", `/api/v1/wallet/${asset}/deposit-address`, zDepositAddressResponse);
  deposits = (query?: Query) => this.request("GET", "/api/v1/wallet/deposits", zDepositsResponse, undefined, query);
  requestWithdrawal = (body: WithdrawalRequest) => this.request("POST", "/api/v1/withdrawals", zWithdrawal, body);
  withdrawals = (query?: Query) => this.request("GET", "/api/v1/withdrawals", zWithdrawalsResponse, undefined, query);
  internalTransfer = (body: InternalTransferRequest): Promise<Ok> =>
    this.request("POST", "/api/v1/wallet/transfer", zOk, body);

  // ---- offers ----
  offers = (query?: OffersQuery) =>
    this.request("GET", "/api/v1/offers", zOffersResponse, undefined, query as Query);
  offer = (id: string) => this.request("GET", `/api/v1/offers/${id}`, zOffer);
  createOffer = (body: CreateOfferRequest) => this.request("POST", "/api/v1/offers", zOffer, body);
  updateOffer = (id: string, body: UpdateOfferRequest) =>
    this.request("PATCH", `/api/v1/offers/${id}`, zOffer, body);
  pauseOffer = (id: string) => this.request("POST", `/api/v1/offers/${id}/pause`, zOffer);
  activateOffer = (id: string) => this.request("POST", `/api/v1/offers/${id}/activate`, zOffer);
  deleteOffer = (id: string): Promise<Ok> => this.request("DELETE", `/api/v1/offers/${id}`, zOk);

  // ---- trades ----
  feePreview = (body: { amount: string; paymentMethod: string; priceXafPerUnit: string }) =>
    this.request("POST", "/api/v1/trades/fee-preview", zFeePreviewResponse, body);
  openTrade = (body: OpenTradeRequest) => this.request("POST", "/api/v1/trades", zTrade, body);
  trades = (query?: TradesQuery) =>
    this.request("GET", "/api/v1/trades", zTradesResponse, undefined, query as Query);
  trade = (id: string) => this.request("GET", `/api/v1/trades/${id}`, zTradeDetailResponse);
  submitPayment = (id: string, body: SubmitPaymentRequest) =>
    this.request("POST", `/api/v1/trades/${id}/pay`, zTrade, body);
  confirmTrade = (id: string, body: ConfirmTradeRequest) =>
    this.request("POST", `/api/v1/trades/${id}/confirm`, zTrade, body);
  cancelTrade = (id: string, body: { idempotencyKey: string }) =>
    this.request("POST", `/api/v1/trades/${id}/cancel`, zTrade, body);

  // ---- disputes ----
  openDispute = (tradeId: string, body: OpenDisputeRequest) =>
    this.request("POST", `/api/v1/trades/${tradeId}/dispute`, zDispute, body);
  dispute = (id: string) => this.request("GET", `/api/v1/disputes/${id}`, zDispute);
  submitEvidence = (id: string, body: SubmitEvidenceRequest) =>
    this.request("POST", `/api/v1/disputes/${id}/evidence`, zDispute, body);

  // ---- chat ----
  messages = (tradeId: string) => this.request("GET", `/api/v1/trades/${tradeId}/messages`, zMessagesResponse);
  sendMessage = (tradeId: string, body: SendMessageRequest) =>
    this.request("POST", `/api/v1/trades/${tradeId}/messages`, zMessagesResponse, body);

  // ---- notifications ----
  notifications = (query?: Query) =>
    this.request("GET", "/api/v1/notifications", zNotificationsResponse, undefined, query);
}
