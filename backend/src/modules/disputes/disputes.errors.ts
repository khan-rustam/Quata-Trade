export class DisputesError extends Error {
  constructor(message: string) {
    super(message);
    this.name = new.target.name;
  }
}

/** Dispute missing OR requester is not a party — indistinguishable on purpose (no IDOR leak). */
export class DisputeNotFoundError extends DisputesError {
  constructor() {
    super("dispute not found");
  }
}

/** UNIQUE(trade_id) hit — one dispute per trade, ever. */
export class DisputeAlreadyOpenError extends DisputesError {
  constructor() {
    super("a dispute already exists for this trade");
  }
}

/** Evidence/uploads are frozen once the dispute is RESOLVED. */
export class DisputeResolvedError extends DisputesError {
  constructor() {
    super("dispute is already resolved");
  }
}

/** Re-resolve attempted with a DIFFERENT outcome — never silently flip a resolution. */
export class ConflictingResolutionError extends DisputesError {
  constructor() {
    super("dispute was already resolved with a different outcome");
  }
}

export class InvalidEvidenceFileError extends DisputesError {
  constructor(reason: string) {
    super(`invalid evidence file: ${reason}`);
  }
}
