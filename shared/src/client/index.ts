import type { z } from "zod";
import {
  zAuthTokensResponse,
  zRegisterResponse,
  zTotpSetupResponse,
  type LoginRequest,
  type RegisterRequest,
} from "../schemas/auth.js";
import { zAnyRecord, zOk, type Ok } from "../schemas/common.js";
import {
  zSessionsResponse,
  zUserProfile,
  type ChangeEmailRequest,
  type UpdateProfileRequest,
  type VerifyEmailChangeRequest,
} from "../schemas/users.js";
import { zPublicTrader } from "../schemas/traders.js";
import {
  zKycStatusResponse,
  zKycUploadResponse,
  type KycSubmitRequest,
  type KycUploadRequest,
} from "../schemas/kyc.js";
import {
  zBalancesResponse,
  zDepositAddressResponse,
  zDepositsResponse,
  zWithdrawal,
  zWithdrawalAddress,
  zWithdrawalAddressesResponse,
  zWithdrawalsResponse,
  type AddWithdrawalAddressRequest,
  type InternalTransferRequest,
  type WithdrawalRequest,
} from "../schemas/wallet.js";
import {
  zOffer,
  zOffersResponse,
  zMyOffersResponse,
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
import {
  zCompanyInfo,
  zEnquiryList,
  zFaq,
  zFaqList,
  zReview,
  zReviewList,
  type EnquiryRequest,
  type UpdateCompanyRequest,
  type UpdateEnquiryStatusRequest,
  type UpsertFaqRequest,
  type UpsertReviewRequest,
} from "../schemas/content.js";
import {
  zAdminDisputesResponse,
  zAdminKpisResponse,
  zAdminKycQueueResponse,
  zAdminProfile,
  zAdminRevenueResponse,
  zAdminTradesResponse,
  zAdminTreasuryResponse,
  zAdminUsersResponse,
  zAdminUserDetail,
  zAdminWithdrawalsResponse,
  zAuditLogsResponse,
  zAuditVerifyResponse,
  zKillSwitchState,
  zModerationResult,
  type AdminLoginRequest,
  type ApproveWithdrawalRequest,
  type KillSwitchRequest,
  type RejectWithdrawalRequest,
  type UpdateSettingRequest,
} from "../schemas/admin.js";
import type { KycReviewRequest } from "../schemas/kyc.js";
import type { ResolveDisputeRequest } from "../schemas/disputes.js";

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
  totpSetup = () => this.request("POST", "/api/v1/auth/2fa/setup", zTotpSetupResponse);
  totpEnable = (body: { code: string }): Promise<Ok> =>
    this.request("POST", "/api/v1/auth/2fa/enable", zOk, body);
  setPin = (body: { pin: string; currentPassword: string }): Promise<Ok> =>
    this.request("POST", "/api/v1/auth/pin/set", zOk, body);

  // ---- users ----
  me = () => this.request("GET", "/api/v1/users/me", zUserProfile);
  updateProfile = (body: UpdateProfileRequest) => this.request("PATCH", "/api/v1/users/me", zUserProfile, body);
  sessions = () => this.request("GET", "/api/v1/users/me/sessions", zSessionsResponse);
  revokeSession = (id: string): Promise<Ok> => this.request("DELETE", `/api/v1/users/me/sessions/${id}`, zOk);
  changeEmail = (body: ChangeEmailRequest) => this.request("POST", "/api/v1/users/me/email", zUserProfile, body);
  verifyEmailChange = (body: VerifyEmailChangeRequest) =>
    this.request("POST", "/api/v1/users/me/email/verify", zUserProfile, body);

  // ---- traders (public merchant profile) ----
  trader = (id: string) => this.request("GET", `/api/v1/traders/${id}`, zPublicTrader);

  // ---- kyc ----
  kycStatus = () => this.request("GET", "/api/v1/kyc/status", zKycStatusResponse);
  kycUpload = (body: KycUploadRequest) => this.request("POST", "/api/v1/kyc/upload", zKycUploadResponse, body);
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
  withdrawalAddresses = () =>
    this.request("GET", "/api/v1/withdrawals/addresses", zWithdrawalAddressesResponse);
  addWithdrawalAddress = (body: AddWithdrawalAddressRequest) =>
    this.request("POST", "/api/v1/withdrawals/addresses", zWithdrawalAddress, body);
  removeWithdrawalAddress = (id: string): Promise<Ok> =>
    this.request("DELETE", `/api/v1/withdrawals/addresses/${id}`, zOk);

  // ---- offers ----
  offers = (query?: OffersQuery) =>
    this.request("GET", "/api/v1/offers", zOffersResponse, undefined, query as Query);
  /** The caller's own offers (all statuses except deleted) for self-service management. */
  myOffers = () => this.request("GET", "/api/v1/offers/mine", zMyOffersResponse);
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
  markNotificationRead = (id: string): Promise<Ok> =>
    this.request("POST", `/api/v1/notifications/${id}/read`, zOk);

  // ---- content (public: company, faq, reviews, contact enquiry) ----
  company = () => this.request("GET", "/api/v1/content/company", zCompanyInfo);
  faqs = () => this.request("GET", "/api/v1/content/faqs", zFaqList);
  reviews = () => this.request("GET", "/api/v1/content/reviews", zReviewList);
  submitEnquiry = (body: EnquiryRequest): Promise<Ok> =>
    this.request("POST", "/api/v1/content/enquiries", zOk, body);

  // ---- content (admin: manage company/faq/reviews/enquiries) ----
  adminUpdateCompany = (body: UpdateCompanyRequest) =>
    this.request("PATCH", "/api/v1/admin/content/company", zCompanyInfo, body);
  adminFaqs = () => this.request("GET", "/api/v1/admin/content/faqs", zFaqList);
  adminUpsertFaq = (body: UpsertFaqRequest) => this.request("POST", "/api/v1/admin/content/faqs", zFaq, body);
  adminDeleteFaq = (id: string): Promise<Ok> => this.request("DELETE", `/api/v1/admin/content/faqs/${id}`, zOk);
  adminReviews = () => this.request("GET", "/api/v1/admin/content/reviews", zReviewList);
  adminUpsertReview = (body: UpsertReviewRequest) =>
    this.request("POST", "/api/v1/admin/content/reviews", zReview, body);
  adminDeleteReview = (id: string): Promise<Ok> =>
    this.request("DELETE", `/api/v1/admin/content/reviews/${id}`, zOk);
  adminEnquiries = (query?: Query) =>
    this.request("GET", "/api/v1/admin/content/enquiries", zEnquiryList, undefined, query);
  adminUpdateEnquiryStatus = (id: string, body: UpdateEnquiryStatusRequest): Promise<Ok> =>
    this.request("PATCH", `/api/v1/admin/content/enquiries/${id}`, zOk, body);

  // ---- admin (uses a separate admin token; RBAC enforced server-side) ----
  adminLogin = (body: AdminLoginRequest) =>
    this.request("POST", "/api/v1/admin/auth/login", zAuthTokensResponse, body);
  adminMe = () => this.request("GET", "/api/v1/admin/me", zAdminProfile);
  adminTotpSetup = () => this.request("POST", "/api/v1/admin/2fa/setup", zTotpSetupResponse);
  adminTotpEnable = (body: { code: string }): Promise<Ok> =>
    this.request("POST", "/api/v1/admin/2fa/enable", zOk, body);
  adminKpis = () => this.request("GET", "/api/v1/admin/kpis", zAdminKpisResponse);
  adminUsers = (query?: Query) =>
    this.request("GET", "/api/v1/admin/users", zAdminUsersResponse, undefined, query);
  /** Full user profile + balances + trades/withdrawals/deposits/kyc/sessions/risk for the detail page. */
  adminUserDetail = (id: string) =>
    this.request("GET", `/api/v1/admin/users/${id}`, zAdminUserDetail);
  adminModerateUser = (id: string, action: "freeze" | "suspend" | "restore", body: { reason: string }) =>
    this.request("POST", `/api/v1/admin/users/${id}/${action}`, zModerationResult, body);
  adminTrades = (query?: Query) =>
    this.request("GET", "/api/v1/admin/trades", zAdminTradesResponse, undefined, query);
  adminWithdrawals = (query?: Query) =>
    this.request("GET", "/api/v1/admin/withdrawals", zAdminWithdrawalsResponse, undefined, query);
  adminApproveWithdrawal = (id: string, body: ApproveWithdrawalRequest): Promise<unknown> =>
    this.request("POST", `/api/v1/admin/withdrawals/${id}/approve`, zAnyRecord, body);
  adminRejectWithdrawal = (id: string, body: RejectWithdrawalRequest): Promise<unknown> =>
    this.request("POST", `/api/v1/admin/withdrawals/${id}/reject`, zAnyRecord, body);
  adminKycQueue = (query?: Query) =>
    this.request("GET", "/api/v1/admin/kyc/queue", zAdminKycQueueResponse, undefined, query);
  adminReviewKyc = (id: string, decision: "approve" | "reject" | "resubmit", body: KycReviewRequest): Promise<unknown> =>
    this.request("POST", `/api/v1/admin/kyc/${id}/${decision}`, zAnyRecord, body);
  adminDisputes = (query?: Query) =>
    this.request("GET", "/api/v1/admin/disputes", zAdminDisputesResponse, undefined, query);
  adminResolveDispute = (id: string, body: ResolveDisputeRequest): Promise<unknown> =>
    this.request("POST", `/api/v1/admin/disputes/${id}/resolve`, zAnyRecord, body);
  adminKillSwitch = () => this.request("GET", "/api/v1/admin/kill-switch", zKillSwitchState);
  adminSetKillSwitch = (body: KillSwitchRequest) =>
    this.request("POST", "/api/v1/admin/kill-switch", zKillSwitchState, body);
  adminUpdateSetting = (body: UpdateSettingRequest): Promise<unknown> =>
    this.request("PATCH", "/api/v1/admin/settings", zAnyRecord, body);
  adminAuditLogs = (query?: Query) =>
    this.request("GET", "/api/v1/admin/audit-logs", zAuditLogsResponse, undefined, query);
  adminVerifyAudit = () => this.request("GET", "/api/v1/admin/audit-logs/verify", zAuditVerifyResponse);
  adminRevenue = () => this.request("GET", "/api/v1/admin/revenue", zAdminRevenueResponse);
  adminTreasury = () => this.request("GET", "/api/v1/admin/treasury/balances", zAdminTreasuryResponse);
}
