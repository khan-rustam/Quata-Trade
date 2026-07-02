/** Domain errors for the users module — messages stay generic. */

export class UsersError extends Error {
  constructor(message: string) {
    super(message);
    this.name = new.target.name;
  }
}

export class UserNotFoundError extends UsersError {
  constructor() {
    super("user not found");
  }
}

/** Also thrown when the session belongs to someone else — same face (no IDOR leak). */
export class SessionNotFoundError extends UsersError {
  constructor() {
    super("session not found");
  }
}

export class UserNotActiveError extends UsersError {
  constructor(readonly status: string) {
    super(`user is ${status}`);
  }
}
