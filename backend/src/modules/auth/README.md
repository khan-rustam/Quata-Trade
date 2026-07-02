# auth

Identity: register + email OTP, login (argon2id, lockout after 5 fails/15 min),
access JWT (≤10 min) + rotating refresh tokens (48-byte, sha256-hashed at rest,
httpOnly `qt_refresh` cookie scoped to `/api/v1/auth`), reuse detection revokes
the whole rotation chain, single-use password reset (revokes all sessions),
TOTP 2FA (secret AES-256-GCM-encrypted via `common/crypto`), transaction PIN.

Invariants: no user enumeration — register/login/forgot/reset always answer the
same shape/error; OTP/refresh/reset tokens stored only as sha256 hashes; codes,
secrets and hashes never logged or returned; every auth event goes through
AuditService; nothing here touches ledger/escrow tables.

Callers: HTTP via AuthController. Other modules may inject `PinService.verifyPin`
(wallet/withdrawals) and `TotpService.assertCode` (sensitive flows) — both throw.
