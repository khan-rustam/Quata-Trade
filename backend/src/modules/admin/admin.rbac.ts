import { ADMIN_ROLES, type AdminRole } from "@quatatrade/shared";

/**
 * RBAC matrix — Documents/06-backend-modules.md (authoritative).
 * One constant per matrix row; controllers spread these into @Roles(...) so
 * the integration spec can assert route metadata === this table === the doc.
 *
 * | Action                | SUPER | FINANCE | COMPLIANCE | SUPPORT | MOD | AUDITOR | ANALYST |
 * | Approve withdrawal    |  ✓    |   ✓     |            |         |     |         |         |
 * | 2nd-approve large wd  |  ✓    |   ✓     |    ✓       |         |     |         |         |
 * | Resolve dispute       |  ✓    |         |    ✓       |   ✓     |     |         |         |
 * | KYC approve/reject    |  ✓    |         |    ✓       |         |     |         |         |
 * | Freeze/suspend user   |  ✓    |         |    ✓       |   ✓     |  ✓  |         |         |
 * | Kill switch           |  ✓    |   ✓     |            |         |     |         |         |
 * | Manage countries      |  ✓    |   ✓     |            |         |     |         |         |
 * | Ledger adjustment     |  ✓    |         |            |         |     |         |         |
 * | View dashboards       |  ✓    |   ✓     |    ✓       |   ✓     |  ✓  |   ✓     |   ✓     |
 * | Edit settings/fees    |  ✓    |   ✓     |            |         |     |         |         |
 * | View audit logs       |  ✓    |         |    ✓       |         |     |   ✓     |         |
 */
export const RBAC = {
  /** First approval. WithdrawalsService re-checks the stage-specific role. */
  approveWithdrawal: ["SUPER_ADMIN", "FINANCE_ADMIN"] as const,
  /**
   * Route-level roles for POST /admin/withdrawals/:id/approve: the 2nd
   * approver may also be COMPLIANCE_ADMIN, so the route admits all three and
   * WithdrawalsService enforces first-vs-second stage roles internally.
   */
  secondApproveWithdrawal: ["SUPER_ADMIN", "FINANCE_ADMIN", "COMPLIANCE_ADMIN"] as const,
  resolveDispute: ["SUPER_ADMIN", "COMPLIANCE_ADMIN", "SUPPORT_ADMIN"] as const,
  kycReview: ["SUPER_ADMIN", "COMPLIANCE_ADMIN"] as const,
  /**
   * Release/reject a held deposit. Same tier as KYC review: an AML hold is a
   * compliance call, and releasing one credits real money. Deliberately NOT
   * given to FINANCE — the hold exists because screening flagged the source.
   */
  reviewHeldDeposit: ["SUPER_ADMIN", "COMPLIANCE_ADMIN"] as const,
  freezeUser: ["SUPER_ADMIN", "COMPLIANCE_ADMIN", "SUPPORT_ADMIN", "MODERATOR"] as const,
  killSwitch: ["SUPER_ADMIN", "FINANCE_ADMIN"] as const,
  /** Enable/disable a market (phased country rollout) — same tier as the kill switch. */
  manageCountries: ["SUPER_ADMIN", "FINANCE_ADMIN"] as const,
  ledgerAdjustment: ["SUPER_ADMIN"] as const,
  /** Configure the custodial wallet public key (key ceremony) — SUPER only, like ledger adjustment. */
  manageWalletConfig: ["SUPER_ADMIN"] as const,
  /** Manage admin/team accounts (create, role, 2FA reset, deactivate) — SUPER only. */
  manageAdmins: ["SUPER_ADMIN"] as const,
  viewDashboards: ADMIN_ROLES,
  editSettings: ["SUPER_ADMIN", "FINANCE_ADMIN"] as const,
  /** Publish/roll back application releases (update management) — SUPER only: a
   *  bad or forced release reaches every client, so it is a release-engineering
   *  action, not a business-config one. */
  manageReleases: ["SUPER_ADMIN"] as const,
  viewAuditLogs: ["SUPER_ADMIN", "COMPLIANCE_ADMIN", "AUDITOR"] as const,
} satisfies Record<string, readonly AdminRole[]>;
