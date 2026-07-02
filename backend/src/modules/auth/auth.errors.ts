/**
 * Domain errors for the auth module. Messages are deliberately generic —
 * they may reach API responses and MUST NOT enable user enumeration or leak
 * codes/secrets (Documents/08 §E).
 */

export class AuthError extends Error {
  constructor(message = "authentication failed") {
    super(message);
    this.name = new.target.name;
  }
}

/** Wrong email/password/TOTP, locked or closed account — always the same face. */
export class InvalidCredentialsError extends AuthError {
  constructor() {
    super("invalid credentials");
  }
}

/** Bad/expired/revoked refresh or reset token — always the same face. */
export class InvalidTokenError extends AuthError {
  constructor() {
    super("invalid or expired token");
  }
}

/** Bad/expired OTP or TOTP code on verification endpoints. */
export class InvalidCodeError extends AuthError {
  constructor() {
    super("invalid or expired code");
  }
}

export class TotpAlreadyEnabledError extends AuthError {
  constructor() {
    super("2FA is already enabled");
  }
}

export class TotpNotConfiguredError extends AuthError {
  constructor() {
    super("2FA setup is not complete");
  }
}

export class PinError extends AuthError {}

export class PinNotSetError extends PinError {
  constructor() {
    super("PIN is not set");
  }
}

export class PinLockedError extends PinError {
  constructor() {
    super("PIN is temporarily locked");
  }
}

export class InvalidPinError extends PinError {
  constructor() {
    super("invalid PIN");
  }
}
