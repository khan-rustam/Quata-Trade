import type { UpdateType } from "@quatatrade/shared";

/** Lowest code that counts as "supported" when nothing has been published yet. */
export const DEFAULT_MIN_SUPPORTED = 1;

export interface ReleaseFacts {
  versionCode: number;
  updateType: UpdateType;
  minSupportedCode: number;
}

export interface UpdateDecision {
  updateAvailable: boolean;
  /** Installed build is below the minimum supported code → hard gate. */
  supported: boolean;
  /** Client must update: unsupported build, or a mandatory/security release. */
  mustUpdate: boolean;
  updateType: UpdateType | null;
  minSupportedCode: number;
}

/**
 * Pure update decision — the one place that decides optional vs mandatory vs
 * blocked. Kept free of DB/IO so it is exhaustively unit-tested.
 *
 * Rules:
 *  - An update exists when the newest published code is greater than the client's.
 *  - `supported` is false when the client is below the release's minSupportedCode.
 *  - `mustUpdate` when unsupported, OR the newest release is mandatory/security.
 *  - Nothing published ⇒ nothing to do, and everything is supported.
 */
export function decideUpdate(latest: ReleaseFacts | null, currentCode: number): UpdateDecision {
  if (!latest) {
    return {
      updateAvailable: false,
      supported: true,
      mustUpdate: false,
      updateType: null,
      minSupportedCode: DEFAULT_MIN_SUPPORTED,
    };
  }

  const updateAvailable = latest.versionCode > currentCode;
  const supported = currentCode >= latest.minSupportedCode;
  const forced = updateAvailable && latest.updateType !== "optional";

  return {
    updateAvailable,
    supported,
    mustUpdate: !supported || forced,
    updateType: updateAvailable ? latest.updateType : null,
    minSupportedCode: latest.minSupportedCode,
  };
}
