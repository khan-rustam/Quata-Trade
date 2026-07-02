export class WithdrawalError extends Error {
  constructor(message: string) {
    super(message);
    this.name = new.target.name;
  }
}

/** Kill switch is on — controller maps to 503. */
export class WithdrawalsPausedError extends WithdrawalError {
  constructor() {
    super("withdrawals are paused");
  }
}

/** Account-state problems the user can see about themselves (KYC tier, email, 2FA setup). */
export class WithdrawalNotEligibleError extends WithdrawalError {}

/**
 * Deliberately generic (Documents/08 §E — no enumeration): a wrong TOTP code,
 * a wrong PIN and a locked PIN all produce this exact same error.
 */
export class WithdrawalVerificationError extends WithdrawalError {
  constructor() {
    super("verification failed");
  }
}

export class InvalidWithdrawalAddressError extends WithdrawalError {}

export class WithdrawalCapExceededError extends WithdrawalError {}

export class WithdrawalNotFoundError extends WithdrawalError {
  constructor(id: string) {
    super(`withdrawal not found: ${id}`);
  }
}

export class IllegalWithdrawalStateError extends WithdrawalError {
  constructor(from: string, action: string) {
    super(`cannot ${action} a withdrawal in status ${from}`);
  }
}

/** Dual-approval violations: same admin approving twice, etc. */
export class DualApprovalError extends WithdrawalError {}

/** Admin role not permitted for this approval stage (RBAC matrix, Documents/06). */
export class ApprovalNotAllowedError extends WithdrawalError {}

/** The idempotency key is already bound to a different principal/operation. */
export class IdempotencyConflictError extends WithdrawalError {
  constructor() {
    super("idempotency key already used");
  }
}
