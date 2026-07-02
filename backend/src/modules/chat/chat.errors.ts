export class ChatError extends Error {
  constructor(message: string) {
    super(message);
    this.name = new.target.name;
  }
}

/** Trade missing OR requester is not a party — indistinguishable on purpose (no IDOR leak). */
export class ChatAccessError extends ChatError {
  constructor() {
    super("trade not found");
  }
}

/** Trade reached a terminal status — chat is read-only. */
export class ChatReadOnlyError extends ChatError {
  constructor(status: string) {
    super(`chat is read-only while trade status is ${status}`);
  }
}

export class InvalidAttachmentError extends ChatError {
  constructor(reason: string) {
    super(`invalid attachment: ${reason}`);
  }
}
