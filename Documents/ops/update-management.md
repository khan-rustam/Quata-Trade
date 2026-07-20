# QuataTrade — Update Management

Self-hosted, no third-party update service. Two halves:

1. **Web / PWA auto-update** — the service worker detects every deploy and prompts the user.
2. **Release registry + version APIs** — the authoritative "what is the current release, and is
   this build still supported?" source, used for release notes and version gating (and, later, by
   a mobile app).

## 1. Web / PWA auto-update (live today)

A deploy ships a new `sw.js`. The new worker **installs and waits** — it deliberately does *not*
`skipWaiting()`. The app then shows *"A new version of QuataTrade is available"* with **Update now /
Later**, and only reloads when the user accepts.

Why waiting matters: the app can never reload itself underneath an active trade. The prompt is also
**suppressed entirely** on money/security routes (trades, escrow, wallet deposit/withdraw/transfer,
KYC, auth, credential changes, and the admin withdrawal/dispute/KYC/ledger screens) and reappears
once the user leaves them. "Later" dismisses only that version; a newer deploy prompts again.

Checks run on an interval (15 min) and whenever the tab regains focus. Caches: only a static offline
page + icons. **No API response, authenticated page, or balance is ever cached.**

## 2. Release registry + version APIs

`app_releases` (migration `0031`) holds one row per release per platform.

**Ordering is by `version_code` (integer), never the semver string** — `"1.10.0" < "1.9.0"`
lexically, which would serve the wrong release. `version` is the human label.

### Public endpoints (unauthenticated by design — a client must be able to learn it is too old *before* it authenticates)
| Endpoint | Returns |
|---|---|
| `GET /api/v1/updates/version?platform=web` | Current published release + `minSupportedCode` |
| `GET /api/v1/updates/check?platform=web&versionCode=N` | `updateAvailable`, `updateType`, `supported`, `mustUpdate` |
| `GET /api/v1/updates/releases?platform=web` | Published history (release notes) |
| `GET /api/v1/updates/minimum-supported-version?platform=web` | `minSupportedCode` only |

### The decision rules (`updates.rules.ts`, unit-tested)
- `updateAvailable` — newest published `versionCode` > the client's.
- `supported` — client `versionCode` ≥ the release's `minSupportedCode`.
- `mustUpdate` — **not supported**, *or* the newest release is `mandatory` / `security`.
- Nothing published ⇒ nothing to do, everything supported.

Update types: `optional` (prompt, postponable) · `mandatory` (must update) · `security` (must
update, flagged as a security fix).

## 3. Publishing a release (admin)

**`/admin/releases`** → fill platform, version, build number, minimum supported build, notes → publish.
Requires **SUPER_ADMIN + TOTP step-up**, and is **hash-chain audit-logged** (`release.publish`).
Rolling back is the same gate (`release.rollback`) and requires a written reason.

- `(platform, version)` is unique — republishing the same version errors rather than silently duplicating.
- `minSupportedCode` cannot exceed the release's own build number (schema-enforced).
- Rolling back a release makes clients fall back to the previous published one on their next check.

### ⚠️ Why publishing is NOT automatic on deploy
The spec asked for "no manual publishing". We deliberately did **not** auto-publish from `deploy.sh`:
publishing can mark a release **mandatory**, which force-updates every client — so it must stay a
deliberate, TOTP-verified, audited action. An automated deploy hook would bypass that step-up and let
any deploy force every user to update.

The workflow is therefore: **deploy → open `/admin/releases` → publish (≈10 seconds)**. If you want
CI to publish automatically, that needs a dedicated service-account credential and an explicit
decision to weaken the step-up — ask before adding it.

## 4. Not built (and why)

- **Android APK distribution, Google Play, Apple App Store layers.** There is no mobile app
  (Documents/01 defers Flutter), so there is no client to serve. The schema already carries
  `artifact_url` / `checksum_sha256` / `signature` and the `android`/`ios` platforms, so adding an
  APK channel later is data + a download endpoint, not a redesign.
- **Remote config** (fees, limits, KYC/AML rules, risk settings, feature flags). Already exists as
  the admin-editable `settings` service + kill switches, with TOTP step-up and audit — not rebuilt.

## 5. Operating notes
- Bump `version_code` on **every** release; it is the only ordering key.
- Raise `minSupportedCode` only when you truly need to cut off old builds — it hard-blocks them.
- Roll back = "clients go back to the previous published release", not a code rollback. To revert the
  running code, use `deploy.sh` (see [disaster-recovery.md](disaster-recovery.md) Procedure E).
