#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# QuataTrade — encrypted logical Postgres backup.
# Custody/ledger data: backups MUST be encrypted at rest and test-restored.
# This is the belt to pgBackRest's braces (see Documents/ops/disaster-recovery.md).
#
# Cron (2:07am UTC daily — off the :00 mark):
#   7 2 * * *  BACKUP_ENC_KEY=... DATABASE_URL=... /opt/quatatrade/scripts/backup-db.sh >> /var/log/quata-backup.log 2>&1
# ---------------------------------------------------------------------------
set -euo pipefail

: "${DATABASE_URL:?set DATABASE_URL (or DATABASE_MIGRATION_URL) to the DB to back up}"
: "${BACKUP_ENC_KEY:?set BACKUP_ENC_KEY (openssl rand -hex 32) — encrypts the backup at rest; store in the vault, NEVER in git}"
BACKUP_DIR="${BACKUP_DIR:-/var/backups/quatatrade}"
RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-14}"

mkdir -p "$BACKUP_DIR"
chmod 700 "$BACKUP_DIR"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
OUT="$BACKUP_DIR/quatatrade-$STAMP.dump.gz.enc"

echo "[$(date -u)] backup start -> $OUT"
# pg_dump (custom format) -> gzip -> AES-256-CBC (pbkdf2). `set -o pipefail` fails the
# whole run if pg_dump errors, so a broken dump never yields a "successful" backup.
pg_dump --format=custom --no-owner --no-privileges "$DATABASE_URL" \
  | gzip -9 \
  | openssl enc -aes-256-cbc -pbkdf2 -salt -pass "env:BACKUP_ENC_KEY" \
  > "$OUT"
chmod 600 "$OUT"

[ -s "$OUT" ] || { echo "ERROR: backup is empty — aborting" >&2; rm -f "$OUT"; exit 1; }
echo "[$(date -u)] backup ok: $(du -h "$OUT" | cut -f1)"

# --- OFFSITE (REQUIRED for real money): redundant, encrypted, DIFFERENT provider/region.
#     Uncomment and configure exactly one. The file is already encrypted at rest.
# restic backup "$OUT"
# aws s3 cp "$OUT" "s3://quata-offsite-backups/" --sse AES256
# rclone copy "$OUT" offsite:quata-backups/

# Local retention prune.
find "$BACKUP_DIR" -name 'quatatrade-*.dump.gz.enc' -mtime "+$RETENTION_DAYS" -delete
echo "[$(date -u)] pruned local backups older than ${RETENTION_DAYS}d"

# --- RESTORE (test monthly against a SCRATCH db — never prod):
#   openssl enc -d -aes-256-cbc -pbkdf2 -pass "env:BACKUP_ENC_KEY" -in <file>.dump.gz.enc \
#     | gunzip \
#     | pg_restore --clean --if-exists --no-owner -d "$RESTORE_DATABASE_URL"
#   Then run `pnpm migrate` (idempotent) and verify the audit chain:
#     GET /api/v1/admin/audit-logs/verify  ->  { ok: true }
