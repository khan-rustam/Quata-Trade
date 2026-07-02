import { sql, type Kysely } from "kysely";

/**
 * KYC, audit (hash-chained, append-only), risk, notifications, settings,
 * outbox (Documents/04-database-schema.md §4.3/§4.7; Documents/03 §module rules).
 * Also creates the restricted app role and applies REVOKE-based append-only
 * enforcement on top of the RULEs.
 */
export async function up(db: Kysely<unknown>): Promise<void> {
  await sql`
    CREATE TABLE kyc_submissions (
      id uuid PRIMARY KEY,
      user_id uuid NOT NULL REFERENCES users(id),
      tier smallint NOT NULL,
      doc_type text NOT NULL,
      files jsonb NOT NULL,
      ocr_prefill jsonb,
      status kyc_status NOT NULL DEFAULT 'PENDING',
      reviewed_by uuid REFERENCES admins(id),
      review_notes text,
      reviewed_at timestamptz,
      retention_delete_after date NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now()
    )`.execute(db);
  await sql`CREATE INDEX kyc_queue_idx ON kyc_submissions (status, created_at) WHERE status = 'PENDING'`.execute(db);

  await sql`
    CREATE TABLE audit_logs (
      id uuid PRIMARY KEY,
      actor_type text NOT NULL,
      actor_id uuid,
      action text NOT NULL,
      target_type text,
      target_id uuid,
      ip inet,
      metadata jsonb,
      prev_hash bytea,
      row_hash bytea,
      created_at timestamptz NOT NULL DEFAULT now()
    )`.execute(db);
  await sql`CREATE INDEX audit_logs_created_idx ON audit_logs (created_at DESC)`.execute(db);
  await sql`CREATE RULE audit_no_update AS ON UPDATE TO audit_logs DO INSTEAD NOTHING`.execute(db);
  await sql`CREATE RULE audit_no_delete AS ON DELETE TO audit_logs DO INSTEAD NOTHING`.execute(db);

  await sql`
    CREATE TABLE risk_events (
      id uuid PRIMARY KEY,
      user_id uuid REFERENCES users(id),
      kind text NOT NULL,
      score int NOT NULL,
      flags jsonb,
      action_taken text,
      created_at timestamptz NOT NULL DEFAULT now()
    )`.execute(db);
  await sql`CREATE INDEX risk_events_user_idx ON risk_events (user_id, created_at DESC)`.execute(db);

  await sql`
    CREATE TABLE notifications (
      id uuid PRIMARY KEY,
      user_id uuid NOT NULL REFERENCES users(id),
      channel text NOT NULL,
      template text NOT NULL,
      payload jsonb NOT NULL,
      status text NOT NULL DEFAULT 'queued',
      attempts int NOT NULL DEFAULT 0,
      read_at timestamptz,
      delivered_at timestamptz,
      created_at timestamptz NOT NULL DEFAULT now()
    )`.execute(db);
  await sql`CREATE INDEX notifications_user_idx ON notifications (user_id, created_at DESC)`.execute(db);

  await sql`
    CREATE TABLE settings (
      key text PRIMARY KEY,
      value jsonb NOT NULL,
      updated_by uuid,
      updated_at timestamptz
    )`.execute(db);

  // Transactional outbox: domain events written in the same tx as state
  // changes; the worker relays them to subscribers (notify/risk/audit).
  await sql`
    CREATE TABLE outbox (
      id uuid PRIMARY KEY,
      event_type text NOT NULL,
      payload jsonb NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now(),
      processed_at timestamptz,
      attempts int NOT NULL DEFAULT 0,
      next_attempt_at timestamptz
    )`.execute(db);
  await sql`CREATE INDEX outbox_pending_idx ON outbox (created_at) WHERE processed_at IS NULL`.execute(db);

  // ---- default runtime settings (tunable in admin; DB CHECKs stay as backstop)
  await sql`
    INSERT INTO settings (key, value) VALUES
      ('fee_bps', '{"QUATAPAY":30,"MTN_MOMO":50,"ORANGE_MONEY":50}'),
      ('trade_payment_window_minutes', '30'),
      ('withdrawal_caps', '{"per_tx_max":"1000000000","daily_max":"2000000000","dual_approval_threshold":"500000000","auto_approve_below":"0"}'),
      ('withdrawal_fee', '{"USDT_TRC20":"1000000"}'),
      ('kill_switches', '{"withdrawals_paused":false,"trades_paused":false}'),
      ('kyc_tier_limits', '{"0":{"maxTrade":"0","dailyWithdrawal":"0"},"1":{"maxTrade":"100000000","dailyWithdrawal":"100000000"},"2":{"maxTrade":"1000000000","dailyWithdrawal":"2000000000"},"3":{"maxTrade":"5000000000","dailyWithdrawal":"10000000000"}}'),
      ('deposit_policy', '{"min_amount":"1000000","confirmations":19}'),
      ('kyc_retention_days', '1825')
    ON CONFLICT (key) DO NOTHING`.execute(db);

  // ---- restricted app role (REVOKE layer on top of RULEs) ------------------
  const appPassword = (process.env.DATABASE_APP_PASSWORD ?? "app_dev_only").replace(/'/g, "''");
  await sql.raw(`
    DO $$
    BEGIN
      IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'quatatrade_app') THEN
        CREATE ROLE quatatrade_app LOGIN PASSWORD '${appPassword}';
      END IF;
    END $$;
  `).execute(db);
  await sql`GRANT CONNECT ON DATABASE quatatrade TO quatatrade_app`.execute(db).catch(() => {
    /* database name differs under Testcontainers — grant below still applies */
  });
  await sql`GRANT USAGE ON SCHEMA public TO quatatrade_app`.execute(db);
  await sql`GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO quatatrade_app`.execute(db);
  // Append-only tables: the app role can never UPDATE or DELETE.
  await sql`REVOKE UPDATE, DELETE ON ledger_entries, journal_entries, trade_events, audit_logs, dispute_evidence FROM quatatrade_app`.execute(db);
  // No hard deletes of money/business records (soft-delete via status only).
  await sql`REVOKE DELETE ON trades, offers, deposits, withdrawals, accounts, account_balances, users, kyc_submissions, trade_messages FROM quatatrade_app`.execute(db);
  // kysely migration bookkeeping stays owner-only.
  await sql`REVOKE ALL ON kysely_migration, kysely_migration_lock FROM quatatrade_app`.execute(db).catch(() => {
    /* tables may not exist yet on a fresh migrate — owner-only by default anyway */
  });
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await sql`DROP TABLE IF EXISTS outbox, settings, notifications, risk_events, audit_logs, kyc_submissions CASCADE`.execute(db);
}
