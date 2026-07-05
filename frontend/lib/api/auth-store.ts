/**
 * Access token lives in MEMORY ONLY (Documents/07 frontend rules — never
 * localStorage). The refresh token is an httpOnly cookie the browser sends
 * automatically; on load/401 we call /auth/refresh to mint a new access token.
 */
let accessToken: string | null = null;

export function getAccessToken(): string | null {
  return accessToken;
}

export function setAccessToken(token: string | null): void {
  accessToken = token;
}
