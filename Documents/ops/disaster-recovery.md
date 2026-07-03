# Disaster Recovery (DR) Plan

Scope: recover QuataTrade to a correct, consistent state after data loss or host failure.
Custody/ledger system → **data integrity beats uptime**. When in doubt, keep withdrawals paused.

> Fill `[[…]]` (providers, regions, RTO/RPO sign-off) before launch.

## Targets
- **RPO** (max data loss): ≤ 5 min — met by pgBackRest continuous WAL archiving.
- **RTO** (max downtime): ≤ [[4h]] for the app; withdrawals stay paused until reconciliation is clean.

## Backup layers
1. **pgBackRest** — continuous WAL + periodic full/differential to offsite object storage (primary DR path).
2. **`scripts/backup-db.sh`** — nightly **encrypted** logical `pg_dump` (AES-256), local + offsite copy
   (belt-and-braces; also the easiest partial/table restore). `BACKUP_ENC_KEY` lives in the vault.
3. **restic** — offsite, encrypted, **different provider/region** from (1) so one provider outage ≠ total loss.
- MinIO (KYC/proofs/disputes/chat): replicate/backup the buckets; objects should be encrypted at rest (item 6b).
- Redis is a cache/queue — **not** a source of truth; it is rebuildable, do not treat as DR-critical.

## Restore procedure (logical backup)
```bash
# 1. Provision a fresh Postgres 16 + the quatatrade role/db (see HANDOFF.md).
# 2. Decrypt + restore into a SCRATCH db first, verify, then cut over.
openssl enc -d -aes-256-cbc -pbkdf2 -pass "env:BACKUP_ENC_KEY" -in quatatrade-<stamp>.dump.gz.enc \
  | gunzip | pg_restore --clean --if-exists --no-owner -d "$RESTORE_DATABASE_URL"
# 3. pnpm migrate            # idempotent — brings schema/roles current
# 4. Verify integrity BEFORE re-enabling money ops:
#    GET /api/v1/admin/audit-logs/verify        -> { ok: true }   (hash chain intact)
#    reconciliation cron / findCacheMismatches   -> no mismatches
```
(pgBackRest restore: `pgbackrest --stanza=quatatrade restore`, then start Postgres in recovery — see its docs.)

## Signer host (Host B) recovery
- **Cold keys are client-held hardware** — not on any server, not in any backup. Recover via the key-holder ceremony.
- Hot key: re-provision on a clean signer host, re-establish the WireGuard tunnel + mTLS, re-fund the operational float.
- Withdrawals stay paused until the signer path is verified end-to-end on testnet.

## Monthly restore drill (REQUIRED — the top-10 "backups never test-restored" gap)
1. Pull the latest encrypted backup → restore into a scratch db (never prod).
2. Run migrate + audit-chain verify + a spot balance check.
3. Record pass/fail + duration in `Documents/audits/`. A backup that has never been restored is not a backup.
