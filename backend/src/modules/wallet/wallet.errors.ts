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

/**
 * The submitted extended key is not a valid account-level PUBLIC xpub (or is an
 * xprv). Message stays generic — never echo key material (Documents/08 §D).
 */
export class WalletConfigInvalidXpubError extends WalletError {
  constructor() {
    super("invalid wallet public key — expected an account-level xpub (never a private key)");
  }
}

/**
 * Refusing to rotate the active xpub because deposit addresses were already
 * derived from it: changing the key would orphan custody of those addresses.
 * The admin must pass acknowledgeReset to proceed (audited).
 */
export class WalletConfigRotationBlockedError extends WalletError {
  constructor(public readonly derivedAddressCount: number) {
    super(
      `refusing to rotate wallet key: ${derivedAddressCount} deposit address(es) were already derived from the current key — pass acknowledgeReset to override`,
    );
  }
}
