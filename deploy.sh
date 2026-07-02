#!/usr/bin/env bash
#
# QuataTrade — one-command production deploy.
#
#   ./deploy.sh
#
# Pulls the latest code, installs, builds (shared -> backend -> frontend),
# runs DB migrations, then gracefully reloads ONLY QuataTrade's pm2 processes
# (api, worker, web) and health-checks them. Safe to re-run; rolls the code
# back to the previous commit if any step fails.
#
# It never touches other projects on the box, never touches the signer, never
# deletes your gitignored .env files, and never runs Docker.
#
# Overridable via env vars (all optional):
#   QT_BRANCH=main
#   QT_APP_DIR=<repo dir>            (defaults to this script's directory)
#   QT_PNPM_VERSION=11.2.2
#   QT_API_HEALTH_URL=https://api.trade.quatadigital.com/health
#   QT_WEB_URL=https://trade.quatadigital.com
#   QT_WEB_PORT=3000                 (used by ecosystem.config.cjs)
#   QT_SKIP_MIGRATE=0                (set 1 to skip migrations)
#
set -Eeuo pipefail

# --- Resolve our real location BEFORE any git operation can rewrite this file ---
SELF="$(cd "$(dirname "${BASH_SOURCE[0]}")" >/dev/null 2>&1 && pwd)/$(basename "${BASH_SOURCE[0]}")"
: "${QT_APP_DIR:="$(dirname "$SELF")"}"
export QT_APP_DIR

# Re-exec from a throwaway copy so `git reset --hard` can't corrupt the script
# mid-run (git rewrites deploy.sh in place when a newer version is pulled).
if [ "${QT_REEXEC:-}" != "1" ]; then
  _copy="$(mktemp)"
  cp "$SELF" "$_copy"
  export QT_REEXEC=1
  exec bash "$_copy" "$@"
fi
trap 'rm -f "$SELF"' EXIT   # $SELF is the temp copy in the re-exec'd process

# ----------------------------- configuration --------------------------------
BRANCH="${QT_BRANCH:-main}"
APP_DIR="${QT_APP_DIR}"
PNPM_VERSION="${QT_PNPM_VERSION:-11.2.2}"
API_HEALTH_URL="${QT_API_HEALTH_URL:-https://api.trade.quatadigital.com/health}"
WEB_URL="${QT_WEB_URL:-https://trade.quatadigital.com}"
ECOSYSTEM="${QT_ECOSYSTEM:-$APP_DIR/ecosystem.config.cjs}"
SKIP_MIGRATE="${QT_SKIP_MIGRATE:-0}"
PM2_APPS=(quatatrade-api quatatrade-worker quatatrade-web)

# ------------------------------- helpers ------------------------------------
c_reset=$'\033[0m'; c_cyan=$'\033[1;36m'; c_green=$'\033[1;32m'; c_yellow=$'\033[1;33m'; c_red=$'\033[1;31m'
log()  { printf '\n%s▶ %s%s\n' "$c_cyan" "$*" "$c_reset"; }
ok()   { printf '%s✔ %s%s\n' "$c_green" "$*" "$c_reset"; }
warn() { printf '%s! %s%s\n' "$c_yellow" "$*" "$c_reset"; }
die()  { printf '%s✖ %s%s\n' "$c_red" "$*" "$c_reset" >&2; exit 1; }

PREV_COMMIT=""

restart_apps() {
  if [ -f "$ECOSYSTEM" ]; then
    pm2 startOrReload "$ECOSYSTEM" --update-env
  else
    # Fallback if the ecosystem file is missing: reload by pinned name only.
    local app
    for app in "${PM2_APPS[@]}"; do
      pm2 reload "$app" --update-env 2>/dev/null || pm2 restart "$app" 2>/dev/null || \
        warn "pm2 app '$app' not found — start it once via the ecosystem file."
    done
  fi
  pm2 save >/dev/null 2>&1 || true
}

rollback() {
  trap - ERR
  warn "Deploy failed. Rolling CODE back to ${PREV_COMMIT:-previous commit}…"
  if [ -n "$PREV_COMMIT" ]; then
    git -C "$APP_DIR" reset --hard "$PREV_COMMIT" || true
    ( cd "$APP_DIR" && pnpm install --frozen-lockfile && pnpm build ) || warn "Rollback rebuild failed — inspect manually."
    restart_apps || true
  fi
  warn "Code rolled back. NOTE: database migrations are NOT auto-reverted."
  warn "Migrations here are additive, so old code runs fine against the newer schema."
  warn "Logs:  pm2 logs quatatrade-api   |   pm2 logs quatatrade-worker"
  exit 1
}

pm2_status() { # <name> -> prints "online" / "down" / "missing"
  pm2 jlist 2>/dev/null | node -e '
    let s=""; process.stdin.on("data",d=>s+=d).on("end",()=>{
      let a=[]; try { a=JSON.parse(s) } catch {}
      const p=a.find(x=>x.name===process.argv[1]);
      process.stdout.write(!p ? "missing" : (p.pm2_env && p.pm2_env.status==="online" ? "online" : "down"));
    });' "$1" 2>/dev/null || echo "unknown"
}

check_url() { # <url> <attempts> -> 0 if healthy
  local url="$1" tries="${2:-10}" i
  command -v curl >/dev/null 2>&1 || { warn "curl not installed — skipping $url"; return 0; }
  for ((i=1; i<=tries; i++)); do
    if curl -fsS --max-time 5 "$url" >/dev/null 2>&1; then ok "healthy: $url"; return 0; fi
    sleep 3
  done
  warn "no healthy response from $url after $tries attempts"
  return 1
}

# ------------------------------- preflight ----------------------------------
cd "$APP_DIR"
log "QuataTrade deploy — $APP_DIR (branch: $BRANCH)"

command -v git  >/dev/null 2>&1 || die "git not found"
command -v node >/dev/null 2>&1 || die "node not found"
command -v pm2  >/dev/null 2>&1 || die "pm2 not found (npm i -g pm2)"
git rev-parse --is-inside-work-tree >/dev/null 2>&1 || die "$APP_DIR is not a git repository"

# Secrets live only on the box and are gitignored — refuse to proceed without them.
[ -f backend/.env ]        || die "backend/.env is missing — refusing to deploy (DB URL + secrets live here)"
[ -f frontend/.env.local ] || warn "frontend/.env.local not found — NEXT_PUBLIC_* will fall back to defaults at build time"

# Toolchain: pin pnpm via corepack, require Node >= 22.
if command -v corepack >/dev/null 2>&1; then
  corepack enable >/dev/null 2>&1 || true
  corepack prepare "pnpm@${PNPM_VERSION}" --activate >/dev/null 2>&1 || true
fi
command -v pnpm >/dev/null 2>&1 || die "pnpm not found — enable corepack or install pnpm@${PNPM_VERSION}"
node -e 'process.exit(parseInt(process.versions.node.split(".")[0],10) >= 22 ? 0 : 1)' \
  || die "Node >= 22 required (found $(node -v))"
ok "preflight ok — node $(node -v), pnpm $(pnpm -v)"

# Capture rollback point AFTER preflight so it only arms once we're committed.
PREV_COMMIT="$(git rev-parse HEAD)"
trap rollback ERR
log "current commit: $PREV_COMMIT"

# ------------------------------- pull ---------------------------------------
log "fetching origin/$BRANCH"
git fetch --prune origin "$BRANCH"
# reset --hard rewrites TRACKED files only; gitignored .env files are untouched.
git reset --hard "origin/$BRANCH"
NEW_COMMIT="$(git rev-parse HEAD)"
if [ "$PREV_COMMIT" = "$NEW_COMMIT" ]; then
  warn "no new commits — redeploying $NEW_COMMIT"
else
  ok "updated $PREV_COMMIT -> $NEW_COMMIT"
fi

# ------------------------------- install ------------------------------------
# Full install (NOT --prod): tsx (migrations) + nest/tsup/next (build) are dev deps.
# No --ignore-scripts: argon2/sharp/@swc must compile (allow-listed in pnpm-workspace.yaml).
log "installing dependencies (frozen lockfile)"
pnpm install --frozen-lockfile
ok "dependencies installed"

# ------------------------------- build --------------------------------------
# Ordered shared -> backend -> frontend by the root build script.
log "building shared -> backend -> frontend"
pnpm build
ok "build complete"

# ------------------------------ migrate -------------------------------------
if [ "$SKIP_MIGRATE" = "1" ]; then
  warn "QT_SKIP_MIGRATE=1 — skipping database migrations"
else
  # Runs in backend/ (loads backend/.env -> DATABASE_MIGRATION_URL, owner role).
  # A failure here aborts BEFORE any process is restarted (trap -> rollback).
  log "running database migrations"
  pnpm migrate
  ok "database schema up to date"
fi

# ------------------------------ restart -------------------------------------
log "reloading QuataTrade processes: ${PM2_APPS[*]}"
restart_apps
ok "processes reloaded"

# Code is live and migrated — stop rolling back on subsequent (non-fatal) checks.
trap - ERR

# --------------------------- verification -----------------------------------
log "verifying processes"
verify_fail=0
for app in "${PM2_APPS[@]}"; do
  st="$(pm2_status "$app")"
  case "$st" in
    online)  ok "pm2 $app: online" ;;
    missing) warn "pm2 $app: not registered (first run? check 'pm2 list')"; verify_fail=1 ;;
    *)       warn "pm2 $app: $st — check 'pm2 logs $app'"; verify_fail=1 ;;
  esac
done

log "health checks"
check_url "$API_HEALTH_URL" 12 || verify_fail=1   # /health -> {"status":"ok"}
check_url "$WEB_URL" 8         || verify_fail=1   # web root

echo
if [ "$verify_fail" -ne 0 ]; then
  warn "Deploy applied $NEW_COMMIT but some checks did not pass."
  warn "Inspect:  pm2 status   |   pm2 logs quatatrade-api   |   pm2 logs quatatrade-web"
  exit 2
fi

ok "Deploy complete — $NEW_COMMIT is live at $WEB_URL"
