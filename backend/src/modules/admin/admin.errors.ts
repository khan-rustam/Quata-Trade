export class AdminError extends Error {
  constructor(message: string) {
    super(message);
    this.name = new.target.name;
  }
}

/**
 * Deliberately generic (Documents/08 §E — no enumeration): unknown email,
 * wrong password, wrong TOTP, inactive admin and rate-limited attempts all
 * produce this exact same error. The real reason lives only in audit_logs.
 */
export class AdminAuthError extends AdminError {
  constructor() {
    super("invalid credentials");
  }
}

/**
 * Step-up verification (the admin's OWN TOTP before a sensitive action)
 * failed — same generic shape for every cause.
 */
export class AdminVerificationError extends AdminError {
  constructor() {
    super("verification failed");
  }
}

export class AdminNotFoundError extends AdminError {
  constructor() {
    super("admin not found");
  }
}

export class TargetUserNotFoundError extends AdminError {
  constructor() {
    super("user not found");
  }
}

/** Illegal user status transition (e.g. touching a closed account). */
export class UserStatusChangeError extends AdminError {}

/** PATCH /admin/settings key outside the whitelist. */
export class SettingKeyNotAllowedError extends AdminError {
  constructor(key: string) {
    super(`setting key not editable: ${key}`);
  }
}

/** Setting value failed its per-key schema — would break the running app. */
export class InvalidSettingValueError extends AdminError {}

/** POST /admin/countries/:code with an unknown ISO code. */
export class CountryNotFoundError extends AdminError {
  constructor(code: string) {
    super(`country not found: ${code}`);
  }
}
