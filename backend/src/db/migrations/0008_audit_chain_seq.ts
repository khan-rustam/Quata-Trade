import { sql, type Kysely } from "kysely";

/**
 * Security fix (money-path review §08 G): the audit hash-chain was ordered by
 * created_at = now() = transaction START time. Money-path audit rows are written
 * inside the outer money transaction, so a txn that started earlier can commit
 * (and append) later — ordering by created_at then forks the chain and makes
 * verifyChain() report false tampering.
 *
 * Fix: a monotonic append-order sequence assigned AT INSERT time. Combined with
 * the existing advisory lock in AuditService (which serializes the append
 * critical section), `seq` reflects true append order and the chain is stable.
 */
export async function up(db: Kysely<unknown>): Promise<void> {
  await sql`ALTER TABLE audit_logs ADD COLUMN seq bigint`.execute(db);
  await sql`CREATE SEQUENCE IF NOT EXISTS audit_logs_seq OWNED BY audit_logs.seq`.execute(db);
  // backfill any existing rows in a stable order, then enforce NOT NULL + default
  await sql`
    UPDATE audit_logs SET seq = t.rn
    FROM (SELECT id, row_number() OVER (ORDER BY created_at, id) AS rn FROM audit_logs) t
    WHERE audit_logs.id = t.id AND audit_logs.seq IS NULL`.execute(db);
  await sql`SELECT setval('audit_logs_seq', COALESCE((SELECT MAX(seq) FROM audit_logs), 0) + 1, false)`.execute(db);
  await sql`ALTER TABLE audit_logs ALTER COLUMN seq SET DEFAULT nextval('audit_logs_seq')`.execute(db);
  await sql`ALTER TABLE audit_logs ALTER COLUMN seq SET NOT NULL`.execute(db);
  await sql`CREATE UNIQUE INDEX audit_logs_seq_idx ON audit_logs (seq)`.execute(db);
  // app role may read/insert but the seq default fills itself; keep append-only RULEs intact
  await sql`GRANT USAGE, SELECT ON SEQUENCE audit_logs_seq TO quatatrade_app`.execute(db).catch(() => {
    /* role may not exist under some test bootstraps */
  });
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await sql`DROP INDEX IF EXISTS audit_logs_seq_idx`.execute(db);
  await sql`ALTER TABLE audit_logs DROP COLUMN IF EXISTS seq`.execute(db);
  await sql`DROP SEQUENCE IF EXISTS audit_logs_seq`.execute(db);
}
