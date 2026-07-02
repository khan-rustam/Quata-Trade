import { sql, type Kysely } from "kysely";

/**
 * Offers, trades, escrow state machine (Documents/04-database-schema.md §4.5).
 * The trade_transitions table + trigger are the DB backstop of the FSM;
 * the service-level FSM in modules/escrow is the primary enforcement.
 */
export async function up(db: Kysely<unknown>): Promise<void> {
  await sql`
    CREATE TABLE offers (
      id uuid PRIMARY KEY,
      user_id uuid NOT NULL REFERENCES users(id),
      side offer_side NOT NULL,
      asset asset_code NOT NULL,
      price_xaf_per_unit bigint NOT NULL CHECK (price_xaf_per_unit > 0),
      min_trade bigint NOT NULL,
      max_trade bigint NOT NULL,
      remaining bigint NOT NULL CHECK (remaining >= 0),
      payment_methods payment_method[] NOT NULL,
      terms text,
      status offer_status NOT NULL DEFAULT 'ACTIVE',
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz,
      CHECK (min_trade > 0 AND min_trade <= max_trade)
    )`.execute(db);
  await sql`CREATE INDEX offers_browse_idx ON offers (status, side, asset)`.execute(db);
  await sql`CREATE INDEX offers_user_idx ON offers (user_id)`.execute(db);

  await sql`
    CREATE TABLE trades (
      id uuid PRIMARY KEY,
      short_ref text UNIQUE NOT NULL,
      offer_id uuid NOT NULL REFERENCES offers(id),
      seller_id uuid NOT NULL REFERENCES users(id),
      buyer_id uuid NOT NULL REFERENCES users(id),
      asset asset_code NOT NULL,
      amount bigint NOT NULL CHECK (amount > 0),
      price_xaf_per_unit bigint NOT NULL,
      fiat_amount_xaf bigint NOT NULL,
      payment_method payment_method NOT NULL,
      fee_bps int NOT NULL,
      fee_amount bigint NOT NULL CHECK (fee_amount >= 0),
      status trade_status NOT NULL DEFAULT 'OPENED',
      payment_deadline timestamptz,
      completed_at timestamptz,
      escrow_journal_id uuid REFERENCES journal_entries(id),
      release_journal_id uuid REFERENCES journal_entries(id),
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz,
      CHECK (buyer_id <> seller_id),
      CHECK (fee_amount < amount)
    )`.execute(db);
  await sql`CREATE INDEX trades_seller_idx ON trades (seller_id, created_at DESC)`.execute(db);
  await sql`CREATE INDEX trades_buyer_idx ON trades (buyer_id, created_at DESC)`.execute(db);
  await sql`CREATE INDEX trades_status_idx ON trades (status)`.execute(db);
  // partial index: the expiry job scans only ESCROW_LOCKED trades past deadline
  await sql`CREATE INDEX trades_deadline_idx ON trades (payment_deadline)
    WHERE status = 'ESCROW_LOCKED'`.execute(db);

  // Immutable event log — every transition writes here in the SAME transaction.
  await sql`
    CREATE TABLE trade_events (
      id uuid PRIMARY KEY,
      trade_id uuid NOT NULL REFERENCES trades(id),
      from_status trade_status,
      to_status trade_status NOT NULL,
      actor text NOT NULL,
      metadata jsonb,
      created_at timestamptz NOT NULL DEFAULT now()
    )`.execute(db);
  await sql`CREATE INDEX trade_events_trade_idx ON trade_events (trade_id, created_at)`.execute(db);
  await sql`CREATE RULE trade_events_no_update AS ON UPDATE TO trade_events DO INSTEAD NOTHING`.execute(db);
  await sql`CREATE RULE trade_events_no_delete AS ON DELETE TO trade_events DO INSTEAD NOTHING`.execute(db);

  await sql`
    CREATE TABLE trade_transitions (
      from_status trade_status,
      to_status trade_status,
      PRIMARY KEY (from_status, to_status)
    )`.execute(db);
  await sql`
    INSERT INTO trade_transitions VALUES
      ('OPENED','ESCROW_LOCKED'), ('OPENED','CANCELLED'),
      ('ESCROW_LOCKED','PAYMENT_SUBMITTED'), ('ESCROW_LOCKED','CANCELLED'),
      ('ESCROW_LOCKED','EXPIRED'), ('ESCROW_LOCKED','DISPUTED'),
      ('PAYMENT_SUBMITTED','COMPLETED'), ('PAYMENT_SUBMITTED','DISPUTED'),
      ('PAYMENT_SUBMITTED','CANCELLED'),
      ('DISPUTED','RESOLVED_RELEASE'), ('DISPUTED','RESOLVED_REFUND')`.execute(db);

  await sql`
    CREATE OR REPLACE FUNCTION assert_trade_transition() RETURNS trigger AS $$
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM trade_transitions
                     WHERE from_status = OLD.status AND to_status = NEW.status)
      THEN RAISE EXCEPTION 'illegal trade transition % -> %', OLD.status, NEW.status; END IF;
      RETURN NEW;
    END $$ LANGUAGE plpgsql`.execute(db);
  await sql`
    CREATE TRIGGER trg_trade_fsm BEFORE UPDATE OF status ON trades
      FOR EACH ROW
      WHEN (OLD.status IS DISTINCT FROM NEW.status)
      EXECUTE FUNCTION assert_trade_transition()`.execute(db);

  await sql`
    CREATE TABLE trade_payments (
      id uuid PRIMARY KEY,
      trade_id uuid NOT NULL REFERENCES trades(id) UNIQUE,
      reference text NOT NULL,
      sender_name text NOT NULL,
      sender_number text NOT NULL,
      proof_files jsonb NOT NULL,
      submitted_at timestamptz NOT NULL DEFAULT now()
    )`.execute(db);
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await sql`DROP TABLE IF EXISTS trade_payments CASCADE`.execute(db);
  await sql`DROP TRIGGER IF EXISTS trg_trade_fsm ON trades`.execute(db);
  await sql`DROP FUNCTION IF EXISTS assert_trade_transition CASCADE`.execute(db);
  await sql`DROP TABLE IF EXISTS trade_transitions CASCADE`.execute(db);
  await sql`DROP TABLE IF EXISTS trade_events CASCADE`.execute(db);
  await sql`DROP TABLE IF EXISTS trades CASCADE`.execute(db);
  await sql`DROP TABLE IF EXISTS offers CASCADE`.execute(db);
}
