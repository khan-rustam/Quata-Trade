import { authenticator } from "otplib";

/** TOTP time-step in seconds (RFC 6238 default; matches otplib's default). */
const TOTP_PERIOD_SECONDS = 30;

/**
 * Verify a TOTP code against a secret and return the ABSOLUTE time-step it matched
 * (unix_seconds / period + drift window), or null if the code is invalid.
 *
 * The step is used for single-use enforcement: callers persist the last-accepted
 * step and reject any code whose step is <= it, so a captured code cannot be
 * replayed inside its validity window (Documents/08 §E).
 */
export function matchedTotpStep(code: string, secret: string): number | null {
  let delta: number | null;
  try {
    // checkDelta returns the window offset (…,-1,0,1,…) of the matching step, or null.
    delta = authenticator.checkDelta(code, secret);
  } catch {
    return null;
  }
  if (delta === null) return null;
  const currentStep = Math.floor(Date.now() / 1000 / TOTP_PERIOD_SECONDS);
  return currentStep + delta;
}
