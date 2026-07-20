export class UpdatesError extends Error {
  constructor(message: string) {
    super(message);
    this.name = new.target.name;
  }
}

/** (platform, version) already exists — republishing is never a silent duplicate. */
export class DuplicateReleaseError extends UpdatesError {
  constructor() {
    super("a release with this platform and version already exists");
  }
}

export class ReleaseNotFoundError extends UpdatesError {
  constructor() {
    super("release not found");
  }
}
