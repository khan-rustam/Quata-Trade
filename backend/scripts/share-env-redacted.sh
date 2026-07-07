#!/usr/bin/env bash
#
# share-env-redacted.sh — print a SAFE, secret-free view of an env file so it can
# be pasted for review. It does NOT send anything anywhere: it only prints to your
# terminal; you copy the output yourself.
#
#   • Non-secret config  -> shown in clear (so config can be verified)
#   • Connection URLs     -> host/db shown, any user:pass@ masked
#   • Secrets             -> shown ONLY as length + a short SHA-256 fingerprint
#   • Empty / dev-default -> flagged with ⚠  (so you can spot what's not prod-ready)
#
# Usage:
#   bash share-env-redacted.sh [path/to/.env]      # default: backend/.env
#
set -euo pipefail

ENVFILE="${1:-backend/.env}"
[ -f "$ENVFILE" ] || { echo "env file not found: $ENVFILE" >&2; exit 1; }

# sha256 helper (Linux: sha256sum, macOS: shasum -a 256)
_sha() { if command -v sha256sum >/dev/null 2>&1; then sha256sum; else shasum -a 256; fi; }
fp() { printf '%s' "$1" | _sha | cut -c1-10; }

# Non-secret keys — shown verbatim.
SHOW=" NODE_ENV PORT WEB_ORIGIN JWT_ACCESS_TTL_SECONDS REFRESH_TTL_DAYS ADMIN_2FA_REQUIRED \
MINIO_ENDPOINT MINIO_PORT MINIO_USE_SSL STORAGE_SSE_ENABLED SMTP_HOST SMTP_PORT SMTP_SECURE \
SMTP_FROM TRON_NETWORK TRONGRID_API_URL TRON_FALLBACK_RPC_URL USDT_TRC20_CONTRACT \
DEPOSIT_CONFIRMATIONS DEPOSIT_MIN_AMOUNT WALLET_HOT_ADDRESS SIGNER_MODE SIGNER_URL \
SIGNER_CA_CERT_PATH SIGNER_CLIENT_CERT_PATH SIGNER_CLIENT_KEY_PATH CLAMAV_ENABLED CLAMAV_HOST \
CLAMAV_PORT SWAGGER_ENABLED LOG_LEVEL "

# Connection URLs — show host/db, mask embedded credentials.
URLMASK=" DATABASE_URL DATABASE_MIGRATION_URL REDIS_URL "

echo "# Redacted view of $ENVFILE"
echo "# secrets appear only as (len=N fp=…) — never the real value"
echo "# --------------------------------------------------------------"

while IFS= read -r line || [ -n "$line" ]; do
  case "$line" in ''|\#*) continue ;; esac
  case "$line" in *=*) : ;; *) continue ;; esac

  key=${line%%=*}; val=${line#*=}
  key="${key#export }"                                  # tolerate `export KEY=`
  key="$(printf '%s' "$key" | tr -d '[:space:]')"
  val="${val%\"}"; val="${val#\"}"; val="${val%\'}"; val="${val#\'}"   # strip quotes

  flag=""
  printf '%s' "$val" | grep -qi 'dev_only\|change_me\|example' && flag=" ⚠ LOOKS LIKE A DEV/PLACEHOLDER VALUE"
  if [ -z "$val" ]; then echo "$key = (EMPTY) ⚠"; continue; fi

  # WALLET_XPUB is public IF it's an xpub. An xprv would be a PRIVATE key -> never print it.
  if [ "$key" = "WALLET_XPUB" ]; then
    case "$val" in
      xpub*) echo "$key = $val" ;;
      *)     echo "$key = (redacted len=${#val} fp=$(fp "$val")) ⚠ NOT an xpub — check this!" ;;
    esac
    continue
  fi

  case "$SHOW" in *" $key "*) echo "$key = ${val}${flag}"; continue ;; esac
  case "$URLMASK" in *" $key "*)
    masked="$(printf '%s' "$val" | sed -E 's#://[^:@/]+:[^@/]+@#://****:****@#')"
    echo "$key = ${masked}${flag}"; continue ;;
  esac

  # Default: fail closed — anything not explicitly safe is treated as a secret.
  echo "$key = (redacted len=${#val} fp=$(fp "$val"))${flag}"
done < "$ENVFILE"
