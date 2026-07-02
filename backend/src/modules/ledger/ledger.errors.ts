export class LedgerError extends Error {
  constructor(message: string) {
    super(message);
    this.name = new.target.name;
  }
}

export class InsufficientFundsError extends LedgerError {
  constructor(
    public readonly accountId: string,
    public readonly available: bigint,
    public readonly required: bigint,
  ) {
    super(`insufficient funds on account ${accountId}: available ${available}, required ${required}`);
  }
}

export class UnbalancedJournalError extends LedgerError {
  constructor(sum: bigint) {
    super(`journal legs must sum to zero, got ${sum}`);
  }
}

export class InvalidJournalError extends LedgerError {}

export class UnknownAccountError extends LedgerError {
  constructor(accountId: string) {
    super(`account not found or asset mismatch: ${accountId}`);
  }
}

/** Thrown when serialization/deadlock retries are exhausted — caller may surface 409/503. */
export class SerializationRetryExhaustedError extends LedgerError {
  constructor(public override readonly cause: unknown) {
    super("money transaction retries exhausted");
  }
}
