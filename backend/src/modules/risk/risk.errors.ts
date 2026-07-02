/** Domain errors for the risk module (never surfaced verbatim to clients). */
export class RiskError extends Error {
  constructor(message: string) {
    super(message);
    this.name = new.target.name;
  }
}

export class RiskSubjectNotFoundError extends RiskError {
  constructor(userId: string) {
    super(`risk subject ${userId} not found`);
  }
}
