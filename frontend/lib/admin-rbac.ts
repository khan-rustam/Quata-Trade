import type { AdminRole } from "@quatatrade/shared";

/**
 * Frontend nav gating mirrors the server RBAC matrix (Documents/06). The server
 * is the source of truth — this only decides which nav links to SHOW; a hidden
 * route still 403s server-side if reached directly.
 */
export const RBAC = {
  viewDashboards: ["SUPER_ADMIN", "FINANCE_ADMIN", "COMPLIANCE_ADMIN", "SUPPORT_ADMIN", "MODERATOR", "AUDITOR", "ANALYST"],
  approveWithdrawal: ["SUPER_ADMIN", "FINANCE_ADMIN"],
  resolveDispute: ["SUPER_ADMIN", "COMPLIANCE_ADMIN", "SUPPORT_ADMIN"],
  kycReview: ["SUPER_ADMIN", "COMPLIANCE_ADMIN"],
  freezeUser: ["SUPER_ADMIN", "COMPLIANCE_ADMIN", "SUPPORT_ADMIN", "MODERATOR"],
  killSwitch: ["SUPER_ADMIN", "FINANCE_ADMIN"],
  editSettings: ["SUPER_ADMIN", "FINANCE_ADMIN"],
  viewAudit: ["SUPER_ADMIN", "COMPLIANCE_ADMIN", "AUDITOR"],
} satisfies Record<string, AdminRole[]>;

export function can(role: AdminRole | undefined, action: keyof typeof RBAC): boolean {
  return role ? RBAC[action].some((r) => r === role) : false;
}
