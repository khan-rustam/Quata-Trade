import { sql, type Kysely } from "kysely";

/** Disputes, evidence, per-trade chat (Documents/04-database-schema.md §4.6). */
export async function up(db: Kysely<unknown>): Promise<void> {
  await sql`
    CREATE TABLE disputes (
      id uuid PRIMARY KEY,
      trade_id uuid NOT NULL REFERENCES trades(id) UNIQUE,
      opened_by uuid NOT NULL REFERENCES users(id),
      reason text NOT NULL,
      status dispute_status NOT NULL DEFAULT 'OPEN',
      resolution text CHECK (resolution IN ('RELEASE_TO_BUYER','REFUND_TO_SELLER')),
      resolved_by uuid REFERENCES admins(id),
      resolution_notes text,
      resolved_at timestamptz,
      created_at timestamptz NOT NULL DEFAULT now()
    )`.execute(db);
  await sql`CREATE INDEX disputes_status_idx ON disputes (status) WHERE status <> 'RESOLVED'`.execute(db);

  await sql`
    CREATE TABLE dispute_evidence (
      id uuid PRIMARY KEY,
      dispute_id uuid NOT NULL REFERENCES disputes(id),
      submitted_by uuid NOT NULL,
      kind text NOT NULL,
      files jsonb,
      note text,
      created_at timestamptz NOT NULL DEFAULT now()
    )`.execute(db);
  await sql`CREATE INDEX dispute_evidence_dispute_idx ON dispute_evidence (dispute_id)`.execute(db);
  await sql`CREATE RULE dispute_evidence_no_update AS ON UPDATE TO dispute_evidence DO INSTEAD NOTHING`.execute(db);
  await sql`CREATE RULE dispute_evidence_no_delete AS ON DELETE TO dispute_evidence DO INSTEAD NOTHING`.execute(db);

  // Retained ≥ trade retention window for dispute export; no hard delete while disputed.
  await sql`
    CREATE TABLE trade_messages (
      id uuid PRIMARY KEY,
      trade_id uuid NOT NULL REFERENCES trades(id),
      sender_id uuid NOT NULL REFERENCES users(id),
      body text,
      attachment_key text,
      created_at timestamptz NOT NULL DEFAULT now(),
      CHECK (body IS NOT NULL OR attachment_key IS NOT NULL)
    )`.execute(db);
  await sql`CREATE INDEX trade_messages_trade_idx ON trade_messages (trade_id, created_at)`.execute(db);
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await sql`DROP TABLE IF EXISTS trade_messages CASCADE`.execute(db);
  await sql`DROP TABLE IF EXISTS dispute_evidence CASCADE`.execute(db);
  await sql`DROP TABLE IF EXISTS disputes CASCADE`.execute(db);
}
