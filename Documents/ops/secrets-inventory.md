# QuataTrade — Secrets Inventory & Handling (2026-07-15)

Audit result: **no secret is committed to Git, none is hardcoded in source, none is exposed to the
browser.** `.gitignore` blocks `.env`/`.env.*` (allows only `.env.example`); the only tracked env
file is `.env.example`, which contains dev-only/placeholder values. Verified by scanning the full
Git history and every tracked file.

Handling rules (already enforced by the architecture):
- Secrets live **only** in `backend/.env` on the server (or a secrets vault later — audit B7), never in Git.
- `env.ts` validates on boot and **refuses to start** on dev secrets in production (hard-stops).
- `pino` redacts `authorization`, `cookie`, `set-cookie`, and any `*.password/pin/totpCode/token` in logs.
- Nothing sensitive is returned in API responses (mappers whitelist fields).

## A. Environment secrets (in `backend/.env` on the server)

| Name | Class | Protects | Rotation | Blast radius if leaked |
|---|---|---|---|---|
| `MASTER_ENCRYPTION_KEY` | **Critical** | AES-256-GCM for KYC files + TOTP secrets at rest | On suspicion only (re-encrypt data) | Decrypts stored KYC/PII + TOTP secrets |
| `JWT_ACCESS_SECRET` | **Critical** | Signs access tokens | Quarterly / on suspicion | Forge any user/admin session (≤10-15 min tokens) |
| `DATABASE_URL` / `DATABASE_APP_PASSWORD` / `DATABASE_MIGRATION_URL` | **Critical** | Postgres (the ledger) | On suspicion | Full DB read/write |
| `MINIO_SECRET_KEY` (+ `MINIO_ACCESS_KEY`) | **High** | Object store (KYC/proofs/disputes) | On suspicion | Read encrypted blobs (still need MASTER key to decrypt) |
| `SMTP_PASS` (+ `SMTP_USER`) | **High** | Hostinger mail sending | On suspicion | Send mail as the platform |
| `TRONGRID_API_KEY` | Medium | TronGrid rate limits | On suspicion | Rate-limit abuse (read-only chain data) |
| `ALERT_WEBHOOK_URL` | Medium | Ops alert delivery (contains a token) | On suspicion | Post to the alerts channel |
| `TELEGRAM_BOT_TOKEN` *(Phase B)* | **High** | Telegram alert bot | On suspicion | Send/act as the alert bot |
| `SIGNER_CLIENT_KEY_PATH` → the key **file** | **Critical** | mTLS client identity to Host B | With cert rotation | Impersonate the API to the signer (signer still re-checks policy) |
| `WALLET_XPUB` | Sensitive (not secret) | Deposit-address derivation | Only via key ceremony | **Privacy** only — watch-only, cannot spend. Reveals all deposit addresses on-chain |
| `COINGECKO_API_KEY` / `CRYPTOPANIC_API_KEY` | Low | Market data rate limits | Anytime | Rate-limit abuse |

**Not in the API/worker at all (by design):** the BIP39 seed / any `xprv` / hot-wallet spending key.
Those live offline (client custody) and, for the hot key, only on **Host B** (the signer). The golden
rule — verified in this audit — is that no spending-key material exists in the API, worker, DB, or logs.

## B. Secrets at rest in the database (all protected)

| Data | Protection |
|---|---|
| `users.password_hash`, `admins.password_hash`, `users.pin_hash` | argon2id (per-secret salt) |
| `users.totp_secret_enc`, `admins.totp_secret_enc` | AES-256-GCM under `MASTER_ENCRYPTION_KEY` |
| `sessions.refresh_hash` | SHA-256 of a 48-byte random token (raw token never stored) |
| KYC documents / proofs / dispute evidence (MinIO) | Private buckets + SSE-S3 + short-TTL presigned URLs |

## C. Frontend exposure

Only `NEXT_PUBLIC_SITE_URL` and `NEXT_PUBLIC_API_URL` reach the browser — both are public URLs. No
key, token, or password is bundled into frontend code. (Verified: no `process.env.<secret>` read in `frontend/`.)

## D. Rotation runbook (summary)
1. **Never** rotate `WALLET_XPUB` casually — it re-homes deposit-address derivation (custody-continuity guard blocks it once addresses exist).
2. Rotate app secrets by editing `backend/.env` on the server → `pm2 reload quatatrade-api quatatrade-worker`.
3. `MASTER_ENCRYPTION_KEY` rotation requires re-encrypting KYC/TOTP data — do it deliberately, with a migration, not ad-hoc.
4. On any suspected compromise: rotate `JWT_ACCESS_SECRET` (kills all sessions), DB password, and MinIO secret immediately; review the audit log.

## E. Open items (tracked elsewhere)
- **Secrets vault** (Infisical/SOPS) so secrets aren't plaintext on a shared box — audit **B7**.
- **Signer key material** on Host B — human-managed per `backend/SIGNER.md`.
