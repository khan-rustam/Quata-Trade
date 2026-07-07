import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  ForbiddenException,
  Get,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UnauthorizedException,
  UnprocessableEntityException,
} from "@nestjs/common";
import { z } from "zod";
import {
  zApproveWithdrawalRequest,
  zFreezeUserRequest,
  zKillSwitchRequest,
  zKycReviewRequest,
  zPagination,
  zRejectWithdrawalRequest,
  zResolveDisputeRequest,
  zUpdateCountryRequest,
  zUpdateSettingRequest,
  zActivateWalletConfigRequest,
  zCreateAdminRequest,
  zUpdateAdminRequest,
  zResetAdminTotpRequest,
  zAlertsQuery,
  zAdminMetricsQuery,
  zUuid,
  type AdminCountriesResponse,
  type AdminKpisResponse,
  type AdminKycDocumentsResponse,
  type AdminMetricsQuery,
  type AdminMetricsResponse,
  type AdminProfile,
  type AdminUserDetail,
  type KillSwitchRequest,
  type KillSwitchState,
  type Pagination,
  type ResolveDisputeRequest,
  type UpdateCountryRequest,
  type ActivateWalletConfigRequest,
  type AdminWalletConfigResponse,
  type SystemHealthResponse,
  type AdminAccountsResponse,
  type AdminAccount,
  type CreateAdminRequest,
  type UpdateAdminRequest,
  type ResetAdminTotpRequest,
  type AlertsQuery,
  type AlertsResponse,
  type AlertItem,
} from "@quatatrade/shared";
import { ZodPipe } from "../../common/zod.pipe";
import { CurrentAdminId, CurrentAuth, Roles } from "../../common/auth/decorators";
import type { AccessTokenPayload, AuthenticatedRequest } from "../../common/auth/jwt.types";
import { AuditService } from "../../common/audit/audit.service";
import { KycAdminService } from "../kyc/kyc-admin.service";
import { ReviewNotAllowedError, SubmissionNotFoundError } from "../kyc/kyc.errors";
import { DisputesAdminService, type DisputeQueuePage, type ResolveResult } from "../disputes/disputes-admin.service";
import { ConflictingResolutionError, DisputeNotFoundError } from "../disputes/disputes.errors";
import { IllegalTransitionError, TradeNotFoundError } from "../escrow/escrow.errors";
import { WithdrawalsService } from "../withdrawals/withdrawals.service";
import { WalletConfigService } from "../wallet/wallet-config.service";
import { WalletConfigInvalidXpubError, WalletConfigRotationBlockedError } from "../wallet/wallet.errors";
import { SettingsService } from "../settings/settings.service";
import {
  ApprovalNotAllowedError,
  DualApprovalError,
  IllegalWithdrawalStateError,
  WithdrawalNotFoundError,
} from "../withdrawals/withdrawals.errors";
import { InsufficientFundsError, SerializationRetryExhaustedError } from "../ledger/ledger.errors";
import { AdminAuthService } from "./admin-auth.service";
import { AdminService, type AdjustmentResult, type UserModerationAction } from "./admin.service";
import { SystemHealthService } from "./system-health.service";
import { AdminTeamService } from "./admin-team.service";
import { AlertsAdminService } from "./alerts-admin.service";
import { RBAC } from "./admin.rbac";
import {
  zAdminAuditQuery,
  zAdminTradesQuery,
  zAdminUsersQuery,
  zAdminWithdrawalsQuery,
  zLedgerAdjustmentRequest,
  type AdminAuditQuery,
  type AdminTradesQuery,
  type AdminUsersQuery,
  type AdminWithdrawalsQuery,
  type KycQueueRow,
  type LedgerAdjustmentRequest,
} from "./admin.schemas";
import {
  AdminAccountNotFoundError,
  AdminEmailExistsError,
  AdminManagementError,
  AlertNotFoundError,
  AdminNotFoundError,
  AdminVerificationError,
  CountryNotFoundError,
  InvalidSettingValueError,
  SettingKeyNotAllowedError,
  TargetUserNotFoundError,
  UserStatusChangeError,
} from "./admin.errors";

type FreezeUserRequest = z.infer<typeof zFreezeUserRequest>;
type KycReviewRequest = z.infer<typeof zKycReviewRequest>;
type ApproveWithdrawalRequest = z.infer<typeof zApproveWithdrawalRequest>;
type RejectWithdrawalRequest = z.infer<typeof zRejectWithdrawalRequest>;
type UpdateSettingRequest = z.infer<typeof zUpdateSettingRequest>;

interface Paged<T> {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
}

/** Domain errors → HTTP. Verification failures stay generic (no oracle). */
function mapAdminError(err: unknown): Error {
  if (err instanceof AdminVerificationError) return new UnauthorizedException("verification failed");
  if (err instanceof AdminNotFoundError) return new UnauthorizedException();
  if (err instanceof TargetUserNotFoundError) return new NotFoundException("user not found");
  if (err instanceof UserStatusChangeError) return new ConflictException(err.message);
  if (err instanceof SettingKeyNotAllowedError) return new BadRequestException(err.message);
  if (err instanceof InvalidSettingValueError) return new BadRequestException(err.message);
  if (err instanceof CountryNotFoundError) return new NotFoundException(err.message);
  if (err instanceof AdminAccountNotFoundError) return new NotFoundException(err.message);
  if (err instanceof AlertNotFoundError) return new NotFoundException(err.message);
  if (err instanceof AdminEmailExistsError) return new ConflictException(err.message);
  if (err instanceof AdminManagementError) return new ConflictException(err.message);
  if (err instanceof WalletConfigInvalidXpubError) return new BadRequestException(err.message);
  if (err instanceof WalletConfigRotationBlockedError) return new ConflictException(err.message);
  if (err instanceof SubmissionNotFoundError) return new NotFoundException("submission not found");
  if (err instanceof ReviewNotAllowedError) return new ConflictException(err.message);
  if (err instanceof DisputeNotFoundError) return new NotFoundException(err.message);
  if (err instanceof ConflictingResolutionError) return new ConflictException(err.message);
  if (err instanceof TradeNotFoundError) return new NotFoundException("trade not found");
  if (err instanceof IllegalTransitionError) return new ConflictException(err.message);
  if (err instanceof WithdrawalNotFoundError) return new NotFoundException("withdrawal not found");
  if (err instanceof IllegalWithdrawalStateError) return new ConflictException(err.message);
  if (err instanceof DualApprovalError) return new ConflictException(err.message);
  if (err instanceof ApprovalNotAllowedError) return new ForbiddenException(err.message);
  if (err instanceof InsufficientFundsError) return new UnprocessableEntityException("insufficient balance");
  if (err instanceof SerializationRetryExhaustedError) {
    return new ConflictException("temporary contention — please retry");
  }
  return err instanceof Error ? err : new Error(String(err));
}

/**
 * /admin/** — every route carries @Roles(...) from the doc-06 RBAC matrix
 * (admin.rbac.ts). No HTTP here moves money or trade state directly: this
 * controller only delegates to the owning services.
 */
@Controller("admin")
export class AdminController {
  constructor(
    private readonly adminAuth: AdminAuthService,
    private readonly admin: AdminService,
    private readonly kycAdmin: KycAdminService,
    private readonly disputesAdmin: DisputesAdminService,
    private readonly withdrawals: WithdrawalsService,
    private readonly walletConfig: WalletConfigService,
    private readonly systemHealth: SystemHealthService,
    private readonly team: AdminTeamService,
    private readonly alerts: AlertsAdminService,
    private readonly audit: AuditService,
    private readonly settings: SettingsService,
  ) {}

  private ip(req: AuthenticatedRequest): string | undefined {
    return req.ip;
  }

  // ── profile ───────────────────────────────────────────────────────────────

  @Roles(...RBAC.viewDashboards)
  @Get("me")
  async me(@CurrentAdminId() adminId: string): Promise<AdminProfile> {
    try {
      return await this.adminAuth.getProfile(adminId);
    } catch (err) {
      throw mapAdminError(err);
    }
  }

  // ── dashboards (all 7 roles) ──────────────────────────────────────────────

  @Roles(...RBAC.viewDashboards)
  @Get("kpis")
  async kpis(): Promise<AdminKpisResponse> {
    return this.admin.kpis();
  }

  @Roles(...RBAC.viewDashboards)
  @Get("metrics")
  async metrics(@Query(new ZodPipe(zAdminMetricsQuery)) query: AdminMetricsQuery): Promise<AdminMetricsResponse> {
    return this.admin.metrics(query);
  }

  @Roles(...RBAC.viewDashboards)
  @Get("users")
  async users(@Query(new ZodPipe(zAdminUsersQuery)) query: AdminUsersQuery): Promise<Paged<unknown>> {
    const { items, total } = await this.admin.listUsers(query);
    return { items, page: query.page, pageSize: query.pageSize, total };
  }

  @Roles(...RBAC.viewDashboards)
  @Get("users/:id")
  async userDetail(@Param("id", new ZodPipe(zUuid)) userId: string): Promise<AdminUserDetail> {
    try {
      return await this.admin.getUserDetail(userId);
    } catch (err) {
      throw mapAdminError(err);
    }
  }

  @Roles(...RBAC.viewDashboards)
  @Get("trades")
  async trades(@Query(new ZodPipe(zAdminTradesQuery)) query: AdminTradesQuery): Promise<Paged<unknown>> {
    const { items, total } = await this.admin.listTrades(query);
    return { items, page: query.page, pageSize: query.pageSize, total };
  }

  @Roles(...RBAC.viewDashboards)
  @Get("withdrawals")
  async withdrawalQueue(
    @Query(new ZodPipe(zAdminWithdrawalsQuery)) query: AdminWithdrawalsQuery,
  ): Promise<Paged<unknown>> {
    const { items, total } = await this.admin.listWithdrawals(query);
    return { items, page: query.page, pageSize: query.pageSize, total };
  }

  @Roles(...RBAC.viewDashboards)
  @Get("kyc/queue")
  async kycQueue(@Query(new ZodPipe(zPagination)) query: Pagination): Promise<Paged<KycQueueRow>> {
    const { items, total } = await this.kycAdmin.queue(query);
    return {
      items: items.map((i) => ({
        id: i.id,
        userId: i.userId,
        userEmail: i.userEmail,
        tier: i.tier,
        docType: i.docType,
        files: i.files,
        submittedAt: i.submittedAt.toISOString(),
        retentionDeleteAfter: i.retentionDeleteAfter.toISOString(),
      })),
      page: query.page,
      pageSize: query.pageSize,
      total,
    };
  }

  @Roles(...RBAC.viewDashboards)
  @Get("disputes")
  async disputeQueue(@Query(new ZodPipe(zPagination)) query: Pagination): Promise<DisputeQueuePage> {
    return this.disputesAdmin.queue(query);
  }

  // ── user moderation (SUPER / COMPLIANCE / SUPPORT / MOD) ─────────────────

  @Roles(...RBAC.freezeUser)
  @Post("users/:id/freeze")
  @HttpCode(HttpStatus.OK)
  async freezeUser(
    @CurrentAdminId() adminId: string,
    @Param("id", new ZodPipe(zUuid)) userId: string,
    @Body(new ZodPipe(zFreezeUserRequest)) dto: FreezeUserRequest,
    @Req() req: AuthenticatedRequest,
  ): Promise<{ ok: true; status: string }> {
    return this.moderate(adminId, userId, "freeze", dto.reason, req);
  }

  @Roles(...RBAC.freezeUser)
  @Post("users/:id/suspend")
  @HttpCode(HttpStatus.OK)
  async suspendUser(
    @CurrentAdminId() adminId: string,
    @Param("id", new ZodPipe(zUuid)) userId: string,
    @Body(new ZodPipe(zFreezeUserRequest)) dto: FreezeUserRequest,
    @Req() req: AuthenticatedRequest,
  ): Promise<{ ok: true; status: string }> {
    return this.moderate(adminId, userId, "suspend", dto.reason, req);
  }

  @Roles(...RBAC.freezeUser)
  @Post("users/:id/restore")
  @HttpCode(HttpStatus.OK)
  async restoreUser(
    @CurrentAdminId() adminId: string,
    @Param("id", new ZodPipe(zUuid)) userId: string,
    @Body(new ZodPipe(zFreezeUserRequest)) dto: FreezeUserRequest,
    @Req() req: AuthenticatedRequest,
  ): Promise<{ ok: true; status: string }> {
    return this.moderate(adminId, userId, "restore", dto.reason, req);
  }

  private async moderate(
    adminId: string,
    userId: string,
    action: UserModerationAction,
    reason: string,
    req: AuthenticatedRequest,
  ): Promise<{ ok: true; status: string }> {
    try {
      const result = await this.admin.setUserStatus(adminId, userId, action, reason, this.ip(req));
      return { ok: true, status: result.status };
    } catch (err) {
      throw mapAdminError(err);
    }
  }

  // ── KYC review (SUPER / COMPLIANCE) — manual decisions only ──────────────

  @Roles(...RBAC.kycReview)
  @Get("kyc/:id/documents")
  async kycDocuments(
    @CurrentAdminId() adminId: string,
    @Param("id", new ZodPipe(zUuid)) submissionId: string,
    @Req() req: AuthenticatedRequest,
  ): Promise<AdminKycDocumentsResponse> {
    try {
      return await this.kycAdmin.documents(submissionId, adminId, this.ip(req));
    } catch (err) {
      throw mapAdminError(err);
    }
  }

  @Roles(...RBAC.kycReview)
  @Post("kyc/:id/approve")
  @HttpCode(HttpStatus.OK)
  async kycApprove(
    @CurrentAdminId() adminId: string,
    @Param("id", new ZodPipe(zUuid)) submissionId: string,
    @Body(new ZodPipe(zKycReviewRequest)) dto: KycReviewRequest,
    @Req() req: AuthenticatedRequest,
  ): Promise<unknown> {
    return this.reviewKyc(submissionId, adminId, "APPROVED", dto.notes, req);
  }

  @Roles(...RBAC.kycReview)
  @Post("kyc/:id/reject")
  @HttpCode(HttpStatus.OK)
  async kycReject(
    @CurrentAdminId() adminId: string,
    @Param("id", new ZodPipe(zUuid)) submissionId: string,
    @Body(new ZodPipe(zKycReviewRequest)) dto: KycReviewRequest,
    @Req() req: AuthenticatedRequest,
  ): Promise<unknown> {
    return this.reviewKyc(submissionId, adminId, "REJECTED", dto.notes, req);
  }

  @Roles(...RBAC.kycReview)
  @Post("kyc/:id/resubmit")
  @HttpCode(HttpStatus.OK)
  async kycResubmit(
    @CurrentAdminId() adminId: string,
    @Param("id", new ZodPipe(zUuid)) submissionId: string,
    @Body(new ZodPipe(zKycReviewRequest)) dto: KycReviewRequest,
    @Req() req: AuthenticatedRequest,
  ): Promise<unknown> {
    return this.reviewKyc(submissionId, adminId, "RESUBMIT", dto.notes, req);
  }

  private async reviewKyc(
    submissionId: string,
    adminId: string,
    decision: "APPROVED" | "REJECTED" | "RESUBMIT",
    notes: string | undefined,
    req: AuthenticatedRequest,
  ): Promise<unknown> {
    try {
      return await this.kycAdmin.review(submissionId, adminId, decision, notes, this.ip(req));
    } catch (err) {
      throw mapAdminError(err);
    }
  }

  // ── withdrawal approvals (matrix: approve SUPER+FINANCE, 2nd +COMPLIANCE) ─

  @Roles(...RBAC.secondApproveWithdrawal)
  @Post("withdrawals/:id/approve")
  @HttpCode(HttpStatus.OK)
  async approveWithdrawal(
    @CurrentAuth() auth: AccessTokenPayload,
    @Param("id", new ZodPipe(zUuid)) withdrawalId: string,
    @Body(new ZodPipe(zApproveWithdrawalRequest)) dto: ApproveWithdrawalRequest,
    @Req() req: AuthenticatedRequest,
  ): Promise<{ id: string; status: string; approvedBy: string | null; secondApprover: string | null }> {
    if (!auth.role) throw new ForbiddenException();
    try {
      // step-up: the admin's OWN TOTP before touching the withdrawal
      await this.adminAuth.verifyTotp(auth.sub, dto.totpCode, "withdrawal.approve", this.ip(req));
      const row = await this.withdrawals.approve(withdrawalId, auth.sub, auth.role);
      return { id: row.id, status: row.status, approvedBy: row.approved_by, secondApprover: row.second_approver };
    } catch (err) {
      throw mapAdminError(err);
    }
  }

  @Roles(...RBAC.approveWithdrawal)
  @Post("withdrawals/:id/reject")
  @HttpCode(HttpStatus.OK)
  async rejectWithdrawal(
    @CurrentAdminId() adminId: string,
    @Param("id", new ZodPipe(zUuid)) withdrawalId: string,
    @Body(new ZodPipe(zRejectWithdrawalRequest)) dto: RejectWithdrawalRequest,
    @Req() req: AuthenticatedRequest,
  ): Promise<{ id: string; status: string }> {
    try {
      await this.adminAuth.verifyTotp(adminId, dto.totpCode, "withdrawal.reject", this.ip(req));
      const row = await this.withdrawals.reject(withdrawalId, adminId, dto.reason);
      return { id: row.id, status: row.status };
    } catch (err) {
      throw mapAdminError(err);
    }
  }

  // ── disputes (SUPER / COMPLIANCE / SUPPORT) ───────────────────────────────

  @Roles(...RBAC.resolveDispute)
  @Post("disputes/:id/resolve")
  @HttpCode(HttpStatus.OK)
  async resolveDispute(
    @CurrentAdminId() adminId: string,
    @Param("id", new ZodPipe(zUuid)) disputeId: string,
    @Body(new ZodPipe(zResolveDisputeRequest)) dto: ResolveDisputeRequest,
    @Req() req: AuthenticatedRequest,
  ): Promise<ResolveResult> {
    try {
      // step-up: resolving a dispute releases/refunds escrow — require the
      // admin's OWN TOTP, exactly like withdrawal approve/reject (§08 E).
      await this.adminAuth.verifyTotp(adminId, dto.totpCode, "dispute.resolve", this.ip(req));
      return await this.disputesAdmin.resolve(disputeId, adminId, dto.resolution, dto.notes);
    } catch (err) {
      throw mapAdminError(err);
    }
  }

  // ── kill switch (view: dashboards; toggle: SUPER+FINANCE) ────────────────

  @Roles(...RBAC.viewDashboards)
  @Get("kill-switch")
  async killSwitch(): Promise<KillSwitchState> {
    return this.admin.getKillSwitch();
  }

  @Roles(...RBAC.killSwitch)
  @Post("kill-switch")
  @HttpCode(HttpStatus.OK)
  async setKillSwitch(
    @CurrentAdminId() adminId: string,
    @Body(new ZodPipe(zKillSwitchRequest)) dto: KillSwitchRequest,
    @Req() req: AuthenticatedRequest,
  ): Promise<KillSwitchState> {
    try {
      return await this.admin.setKillSwitch(adminId, dto, this.ip(req));
    } catch (err) {
      throw mapAdminError(err);
    }
  }

  // ── countries (view: dashboards; toggle: SUPER+FINANCE) ──────────────────

  @Roles(...RBAC.viewDashboards)
  @Get("countries")
  async countries(): Promise<AdminCountriesResponse> {
    return this.admin.listCountries();
  }

  @Roles(...RBAC.manageCountries)
  @Post("countries/:code")
  @HttpCode(HttpStatus.OK)
  async updateCountry(
    @CurrentAdminId() adminId: string,
    @Param("code", new ZodPipe(z.string().trim().length(2))) code: string,
    @Body(new ZodPipe(zUpdateCountryRequest)) dto: UpdateCountryRequest,
    @Req() req: AuthenticatedRequest,
  ): Promise<AdminCountriesResponse> {
    try {
      return await this.admin.updateCountry(adminId, code, dto, this.ip(req));
    } catch (err) {
      throw mapAdminError(err);
    }
  }

  // ── settings (SUPER + FINANCE) ────────────────────────────────────────────

  @Roles(...RBAC.editSettings)
  @Get("settings")
  async getSettings(): Promise<Awaited<ReturnType<SettingsService["adminSnapshot"]>>> {
    return this.settings.adminSnapshot();
  }

  @Roles(...RBAC.editSettings)
  @Patch("settings")
  async updateSetting(
    @CurrentAdminId() adminId: string,
    @Body(new ZodPipe(zUpdateSettingRequest)) dto: UpdateSettingRequest,
    @Req() req: AuthenticatedRequest,
  ): Promise<{ ok: true }> {
    try {
      await this.admin.updateSetting(adminId, dto.key, dto.value, dto.reason, dto.totpCode, this.ip(req));
      return { ok: true };
    } catch (err) {
      throw mapAdminError(err);
    }
  }

  // ── custodial wallet config (key ceremony — SUPER only, PUBLIC xpub) ──────

  @Roles(...RBAC.manageWalletConfig)
  @Get("wallet-config")
  async walletConfigView(): Promise<AdminWalletConfigResponse> {
    return this.walletConfig.view();
  }

  @Roles(...RBAC.manageWalletConfig)
  @Post("wallet-config/activate")
  @HttpCode(HttpStatus.OK)
  async walletConfigActivate(
    @CurrentAdminId() adminId: string,
    @Body(new ZodPipe(zActivateWalletConfigRequest)) dto: ActivateWalletConfigRequest,
    @Req() req: AuthenticatedRequest,
  ): Promise<AdminWalletConfigResponse> {
    try {
      // Step-up: the admin's OWN TOTP before rotating the custodial key (§08 E).
      await this.adminAuth.verifyTotp(adminId, dto.totpCode, "wallet.config_activate", this.ip(req));
      return await this.walletConfig.activate(adminId, dto, this.ip(req));
    } catch (err) {
      throw mapAdminError(err);
    }
  }

  // ── team / admin-account management (SUPER only, TOTP step-up) ────────────

  @Roles(...RBAC.manageAdmins)
  @Get("team")
  async teamList(): Promise<AdminAccountsResponse> {
    return { admins: await this.team.list() };
  }

  @Roles(...RBAC.manageAdmins)
  @Post("team")
  @HttpCode(HttpStatus.OK)
  async teamCreate(
    @CurrentAdminId() adminId: string,
    @Body(new ZodPipe(zCreateAdminRequest)) dto: CreateAdminRequest,
    @Req() req: AuthenticatedRequest,
  ): Promise<AdminAccount> {
    try {
      await this.adminAuth.verifyTotp(adminId, dto.totpCode, "admin.account_create", this.ip(req));
      return await this.team.create(adminId, dto, this.ip(req));
    } catch (err) {
      throw mapAdminError(err);
    }
  }

  @Roles(...RBAC.manageAdmins)
  @Patch("team/:id")
  async teamUpdate(
    @CurrentAdminId() adminId: string,
    @Param("id", new ZodPipe(zUuid)) id: string,
    @Body(new ZodPipe(zUpdateAdminRequest)) dto: UpdateAdminRequest,
    @Req() req: AuthenticatedRequest,
  ): Promise<AdminAccount> {
    try {
      await this.adminAuth.verifyTotp(adminId, dto.totpCode, "admin.account_update", this.ip(req));
      return await this.team.update(adminId, id, dto, this.ip(req));
    } catch (err) {
      throw mapAdminError(err);
    }
  }

  @Roles(...RBAC.manageAdmins)
  @Post("team/:id/reset-2fa")
  @HttpCode(HttpStatus.OK)
  async teamResetTotp(
    @CurrentAdminId() adminId: string,
    @Param("id", new ZodPipe(zUuid)) id: string,
    @Body(new ZodPipe(zResetAdminTotpRequest)) dto: ResetAdminTotpRequest,
    @Req() req: AuthenticatedRequest,
  ): Promise<AdminAccount> {
    try {
      await this.adminAuth.verifyTotp(adminId, dto.totpCode, "admin.account_reset_2fa", this.ip(req));
      return await this.team.resetTotp(adminId, id, this.ip(req));
    } catch (err) {
      throw mapAdminError(err);
    }
  }

  // ── system health (all admin roles can monitor) ──────────────────────────

  @Roles(...RBAC.viewDashboards)
  @Get("system/health")
  async systemHealthSnapshot(): Promise<SystemHealthResponse> {
    return this.systemHealth.snapshot();
  }

  // ── alerts feed (all admin roles view + acknowledge) ─────────────────────

  @Roles(...RBAC.viewDashboards)
  @Get("alerts")
  async alertsList(@Query(new ZodPipe(zAlertsQuery)) query: AlertsQuery): Promise<AlertsResponse> {
    return this.alerts.list(query);
  }

  @Roles(...RBAC.viewDashboards)
  @Post("alerts/:id/ack")
  @HttpCode(HttpStatus.OK)
  async alertAcknowledge(
    @CurrentAdminId() adminId: string,
    @Param("id", new ZodPipe(zUuid)) id: string,
  ): Promise<AlertItem> {
    try {
      return await this.alerts.acknowledge(adminId, id);
    } catch (err) {
      throw mapAdminError(err);
    }
  }

  // ── audit logs (SUPER / COMPLIANCE / AUDITOR) ─────────────────────────────

  @Roles(...RBAC.viewAuditLogs)
  @Get("audit-logs")
  async auditLogs(@Query(new ZodPipe(zAdminAuditQuery)) query: AdminAuditQuery): Promise<Paged<unknown>> {
    const { items, total } = await this.admin.listAuditLogs(query);
    return { items, page: query.page, pageSize: query.pageSize, total };
  }

  @Roles(...RBAC.viewAuditLogs)
  @Get("audit-logs/verify")
  async verifyAuditChain(): Promise<{ broken: string[] }> {
    return { broken: await this.audit.verifyChain() };
  }

  // ── ledger adjustment (SUPER only — the ONLY manual money endpoint) ──────

  @Roles(...RBAC.ledgerAdjustment)
  @Post("ledger/adjustment")
  @HttpCode(HttpStatus.OK)
  async ledgerAdjustment(
    @CurrentAdminId() adminId: string,
    @Body(new ZodPipe(zLedgerAdjustmentRequest)) dto: LedgerAdjustmentRequest,
    @Req() req: AuthenticatedRequest,
  ): Promise<AdjustmentResult> {
    try {
      return await this.admin.ledgerAdjustment(adminId, dto, this.ip(req));
    } catch (err) {
      throw mapAdminError(err);
    }
  }
}
