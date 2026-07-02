export class KycError extends Error {
  constructor(message: string) {
    super(message);
    this.name = new.target.name;
  }
}

/** Decoded upload failed size / magic-byte validation (SVG and unknown types land here). */
export class FileValidationError extends KycError {}

/** A submitted object key does not live under the caller's own prefix — message stays generic (no enumeration). */
export class FileOwnershipError extends KycError {
  constructor() {
    super("one or more file keys are invalid");
  }
}

export class TierProgressionError extends KycError {
  constructor(currentTier: number, requestedTier: number) {
    super(`KYC tier must be requested sequentially: current tier ${currentTier}, requested ${requestedTier}`);
  }
}

export class PendingSubmissionExistsError extends KycError {
  constructor() {
    super("a KYC submission is already pending review");
  }
}

export class SubmissionNotFoundError extends KycError {
  constructor(submissionId: string) {
    super(`KYC submission not found: ${submissionId}`);
  }
}

/** Review rejected: missing/inactive admin or submission not PENDING. Manual decisions only. */
export class ReviewNotAllowedError extends KycError {}
