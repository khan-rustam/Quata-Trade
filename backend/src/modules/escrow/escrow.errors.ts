export class EscrowError extends Error {
  constructor(message: string) {
    super(message);
    this.name = new.target.name;
  }
}

export class TradeNotFoundError extends EscrowError {
  constructor(tradeId: string) {
    super(`trade not found: ${tradeId}`);
  }
}

export class IllegalTransitionError extends EscrowError {
  constructor(from: string, to: string) {
    super(`illegal trade transition ${from} -> ${to}`);
  }
}

export class NotTradePartyError extends EscrowError {
  constructor() {
    super("actor is not a party to this trade");
  }
}

export class TradesPausedError extends EscrowError {
  constructor() {
    super("trading is paused by kill switch");
  }
}

export class OfferUnavailableError extends EscrowError {
  constructor(reason: string) {
    super(`offer unavailable: ${reason}`);
  }
}

export class InvalidProofError extends EscrowError {
  constructor(reason: string) {
    super(`invalid payment proof: ${reason}`);
  }
}
