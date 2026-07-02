export class WalletError extends Error {
  constructor(message: string) {
    super(message);
    this.name = new.target.name;
  }
}

export class XpubNotConfiguredError extends WalletError {
  constructor() {
    super("wallet xpub is not configured");
  }
}

/**
 * Deliberately generic (Documents/08 §E — no user enumeration): thrown for
 * unknown recipient, self-transfer and non-active recipient alike, so the
 * response never reveals whether an email belongs to an account.
 */
export class TransferFailedError extends WalletError {
  constructor() {
    super("unable to complete transfer");
  }
}

/** Sender's own account is frozen/suspended — safe to say so (it's their account). */
export class AccountRestrictedError extends WalletError {
  constructor() {
    super("account is restricted");
  }
}

/** PIN check failed — message stays generic; lockout policy lives in the auth module. */
export class PinVerificationError extends WalletError {
  constructor() {
    super("PIN verification failed");
  }
}

/** PIN_SERVICE token not bound yet (auth module built in parallel). */
export class PinServiceUnavailableError extends WalletError {
  constructor() {
    super("PIN verification is unavailable");
  }
}
