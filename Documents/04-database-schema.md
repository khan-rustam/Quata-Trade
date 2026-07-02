# 04 — Database Schema (PostgreSQL 16)

> Authoritative schema for Phase 1. All amounts BIGINT smallest units (USDT-TRC20 = 6 decimals → 1 USDT = 1_000_000). All tables get `created_at timestamptz NOT NULL DEFAULT now()`; mutable tables also `updated_at`. UUIDv7 primary keys (`id uuid PRIMARY KEY DEFAULT uuidv7()` via extension or app-generated).

## 4.1 Enums

```sql
CREATE TYPE asset_code       AS ENUM ('USDT_TRC20');            -- extend later: BTC, ETH
CREATE TYPE account_kind     AS ENUM ('user_available','user_escrow','platform_treasury',
                                      'platform_hot','platform_pending_sweep');
CREATE TYPE entry_reason     AS ENUM ('deposit_credit','withdrawal_debit','withdrawal_fee',
                                      'escrow_lock','escrow_release_buyer','escrow_release_fee',
                                      'escrow_refund','internal_transfer','adjustment');
CREATE TYPE trade_status     AS ENUM ('OPENED','ESCROW_LOCKED','PAYMENT_SUBMITTED',
                                      'COMPLETED','CANCELLED','EXPIRED','DISPUTED',
                                      'RESOLVED_RELEASE','RESOLVED_REFUND');
CREATE TYPE offer_status     AS ENUM ('ACTIVE','PAUSED','EXHAUSTED','DELETED');
CREATE TYPE offer_side       AS ENUM ('SELL','BUY');
CREATE TYPE payment_method   AS ENUM ('QUATAPAY','MTN_MOMO','ORANGE_MONEY');
CREATE TYPE kyc_status       AS ENUM ('NONE','PENDING','APPROVED','REJECTED','RESUBMIT');
CREATE TYPE withdrawal_status AS ENUM ('REQUESTED','RISK_HOLD','PENDING_APPROVAL','APPROVED',
                                       'SIGNING','BROADCAST','CONFIRMED','REJECTED','FAILED');
CREATE TYPE deposit_status   AS ENUM ('SEEN','CONFIRMING','CREDITED','ORPHANED','IGNORED_DUST');
CREATE TYPE dispute_status   AS ENUM ('OPEN','AWAITING_EVIDENCE','UNDER_REVIEW','RESOLVED');
CREATE TYPE admin_role       AS ENUM ('SUPER_ADMIN','FINANCE_ADMIN','COMPLIANCE_ADMIN',
                                      'SUPPORT_ADMIN','MODERATOR','AUDITOR','ANALYST');
```

## 4.2 The Ledger (heart of the system — append-only double-entry)

```sql
-- One row per (owner, kind, asset). Users get user_available + user_escrow per asset.
CREATE TABLE accounts (
  id          uuid PRIMARY KEY,
  owner_user_id uuid REFERENCES users(id),        -- NULL for platform accounts
  kind        account_kind NOT NULL,
  asset       asset_code   NOT NULL,
  UNIQUE (owner_user_id, kind, asset)
);

-- A journal groups the balanced legs of one economic event.
CREATE TABLE journal_entries (
  id              uuid PRIMARY KEY,
  reason          entry_reason NOT NULL,
  reference_type  text NOT NULL,        -- 'trade' | 'deposit' | 'withdrawal' | ...
  reference_id    uuid NOT NULL,
  idempotency_key text NOT NULL UNIQUE, -- retry-safe money movement
  created_by      text NOT NULL         -- 'system' | admin id
);

-- Legs. Amount signed: positive = credit, negative = debit.
CREATE TABLE ledger_entries (
  id          uuid PRIMARY KEY,
  journal_id  uuid NOT NULL REFERENCES journal_entries(id),
  account_id  uuid NOT NULL REFERENCES accounts(id),
  asset       asset_code NOT NULL,
  amount      bigint NOT NULL CHECK (amount <> 0),
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON ledger_entries (account_id, created_at);

-- Append-only enforcement at DB level:
CREATE RULE ledger_no_update AS ON UPDATE TO ledger_entries DO INSTEAD NOTHING;
CREATE RULE ledger_no_delete AS ON DELETE TO ledger_entries DO INSTEAD NOTHING;
-- (also REVOKE UPDATE, DELETE from the app role)

-- Zero-sum invariant per journal, deferred to commit:
CREATE OR REPLACE FUNCTION assert_journal_balanced() RETURNS trigger AS $$
BEGIN
  IF (SELECT COALESCE(SUM(amount),0) FROM ledger_entries WHERE journal_id = NEW.journal_id) <> 0
  THEN RAISE EXCEPTION 'journal % not balanced', NEW.journal_id; END IF;
  RETURN NULL;
END $$ LANGUAGE plpgsql;
CREATE CONSTRAINT TRIGGER trg_journal_balanced
  AFTER INSERT ON ledger_entries DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION assert_journal_balanced();

-- Cached balances (performance) — ONLY written by ledger service in the same tx,
-- with non-negativity enforced for user accounts:
CREATE TABLE account_balances (
  account_id uuid PRIMARY KEY REFERENCES accounts(id),
  balance    bigint NOT NULL DEFAULT 0,
  version    bigint NOT NULL DEFAULT 0,           -- optimistic check
  CONSTRAINT non_negative CHECK (balance >= 0)
);
```

**Ledger service contract (TypeScript):** single method `postJournal({reason, reference, idempotencyKey, legs: [{accountId, amount}]})` that, in ONE serializable transaction: locks affected `account_balances` rows `FOR UPDATE` in a **globally consistent order (sorted by account_id)** to prevent deadlocks, inserts journal + legs, updates cached balances, and relies on CHECK + trigger as the last line of defense. Nightly reconciliation job re-sums entries vs cache and vs on-chain wallet totals; any mismatch → alert + withdrawal pause.

## 4.3 Users, Auth, KYC

```sql
CREATE TABLE users (
  id uuid PRIMARY KEY, email citext UNIQUE NOT NULL, phone text UNIQUE,
  password_hash text NOT NULL, pin_hash text,
  first_name text, last_name text, country char(2) NOT NULL DEFAULT 'CM',
  email_verified_at timestamptz, phone_verified_at timestamptz,
  kyc_tier smallint NOT NULL DEFAULT 0, kyc_status kyc_status NOT NULL DEFAULT 'NONE',
  totp_secret_enc bytea, totp_enabled boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'active'
    CHECK (status IN ('active','frozen','suspended','closed')),
  reputation_score int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz
);

CREATE TABLE sessions (            -- rotating refresh tokens
  id uuid PRIMARY KEY, user_id uuid NOT NULL REFERENCES users(id),
  refresh_hash text NOT NULL, device_fingerprint text, ip inet, user_agent text,
  expires_at timestamptz NOT NULL, revoked_at timestamptz, rotated_from uuid
);

CREATE TABLE kyc_submissions (
  id uuid PRIMARY KEY, user_id uuid NOT NULL REFERENCES users(id),
  tier smallint NOT NULL, doc_type text NOT NULL,
  files jsonb NOT NULL,             -- MinIO object keys (encrypted objects)
  ocr_prefill jsonb,                -- assist only, never a decision
  status kyc_status NOT NULL DEFAULT 'PENDING',
  reviewed_by uuid REFERENCES admins(id), review_notes text, reviewed_at timestamptz,
  retention_delete_after date NOT NULL      -- data-protection retention schedule
);
```

## 4.4 Wallets, Deposits, Withdrawals

```sql
CREATE TABLE deposit_addresses (
  id uuid PRIMARY KEY, user_id uuid NOT NULL REFERENCES users(id),
  asset asset_code NOT NULL, address text NOT NULL UNIQUE,
  derivation_path text NOT NULL UNIQUE,      -- from xpub, e.g. m/44'/195'/0'/0/N
  active boolean NOT NULL DEFAULT true
);

CREATE TABLE deposits (
  id uuid PRIMARY KEY, user_id uuid NOT NULL, asset asset_code NOT NULL,
  address text NOT NULL, tx_hash text NOT NULL, log_index int NOT NULL DEFAULT 0,
  amount bigint NOT NULL CHECK (amount > 0),
  token_contract text NOT NULL,               -- MUST equal canonical USDT contract
  block_number bigint, confirmations int NOT NULL DEFAULT 0,
  status deposit_status NOT NULL DEFAULT 'SEEN',
  credited_journal_id uuid REFERENCES journal_entries(id),
  UNIQUE (tx_hash, log_index)                  -- idempotent scanning
);

CREATE TABLE withdrawals (
  id uuid PRIMARY KEY, user_id uuid NOT NULL, asset asset_code NOT NULL,
  to_address text NOT NULL, amount bigint NOT NULL CHECK (amount > 0),
  fee bigint NOT NULL CHECK (fee >= 0),
  status withdrawal_status NOT NULL DEFAULT 'REQUESTED',
  risk_score int, risk_flags jsonb,
  approved_by uuid REFERENCES admins(id), second_approver uuid REFERENCES admins(id),
  tx_hash text, failure_reason text,
  idempotency_key text NOT NULL UNIQUE,
  CONSTRAINT big_needs_two CHECK (amount < 500000000 OR second_approver IS NOT NULL)
  -- example: ≥500 USDT requires two admins; tune via config + keep DB backstop
);
```

## 4.5 Offers, Trades, Escrow State Machine

```sql
CREATE TABLE offers (
  id uuid PRIMARY KEY, user_id uuid NOT NULL REFERENCES users(id),
  side offer_side NOT NULL, asset asset_code NOT NULL,
  price_xaf_per_unit bigint NOT NULL CHECK (price_xaf_per_unit > 0),  -- XAF per whole USDT
  min_trade bigint NOT NULL, max_trade bigint NOT NULL,
  remaining bigint NOT NULL CHECK (remaining >= 0),
  payment_methods payment_method[] NOT NULL,
  terms text, status offer_status NOT NULL DEFAULT 'ACTIVE',
  CHECK (min_trade > 0 AND min_trade <= max_trade)
);

CREATE TABLE trades (
  id uuid PRIMARY KEY, short_ref text UNIQUE NOT NULL,   -- human ref e.g. QT-8F3K2
  offer_id uuid NOT NULL REFERENCES offers(id),
  seller_id uuid NOT NULL, buyer_id uuid NOT NULL CHECK (buyer_id <> seller_id),
  asset asset_code NOT NULL,
  amount bigint NOT NULL CHECK (amount > 0),             -- crypto in escrow
  price_xaf_per_unit bigint NOT NULL,
  fiat_amount_xaf bigint NOT NULL,
  payment_method payment_method NOT NULL,
  fee_bps int NOT NULL,                                   -- 30 or 50
  fee_amount bigint NOT NULL CHECK (fee_amount >= 0),
  status trade_status NOT NULL DEFAULT 'OPENED',
  payment_deadline timestamptz, completed_at timestamptz,
  escrow_journal_id uuid, release_journal_id uuid,
  CHECK (fee_amount < amount)
);

-- Immutable event log — every transition writes here in the SAME transaction:
CREATE TABLE trade_events (
  id uuid PRIMARY KEY, trade_id uuid NOT NULL REFERENCES trades(id),
  from_status trade_status, to_status trade_status NOT NULL,
  actor text NOT NULL,          -- 'buyer' | 'seller' | 'system' | 'admin:<id>'
  metadata jsonb, created_at timestamptz NOT NULL DEFAULT now()
);

-- Allowed transitions enforced in DB (backstop to the service-level FSM):
CREATE TABLE trade_transitions (from_status trade_status, to_status trade_status,
                                PRIMARY KEY (from_status,to_status));
INSERT INTO trade_transitions VALUES
 ('OPENED','ESCROW_LOCKED'), ('OPENED','CANCELLED'),
 ('ESCROW_LOCKED','PAYMENT_SUBMITTED'), ('ESCROW_LOCKED','CANCELLED'),
 ('ESCROW_LOCKED','EXPIRED'), ('ESCROW_LOCKED','DISPUTED'),
 ('PAYMENT_SUBMITTED','COMPLETED'), ('PAYMENT_SUBMITTED','DISPUTED'),
 ('PAYMENT_SUBMITTED','CANCELLED'),
 ('DISPUTED','RESOLVED_RELEASE'), ('DISPUTED','RESOLVED_REFUND');

CREATE OR REPLACE FUNCTION assert_trade_transition() RETURNS trigger AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM trade_transitions
                 WHERE from_status = OLD.status AND to_status = NEW.status)
  THEN RAISE EXCEPTION 'illegal trade transition % -> %', OLD.status, NEW.status; END IF;
  RETURN NEW;
END $$ LANGUAGE plpgsql;
CREATE TRIGGER trg_trade_fsm BEFORE UPDATE OF status ON trades
  FOR EACH ROW EXECUTE FUNCTION assert_trade_transition();
```

**Escrow lock procedure (service-level, serializable tx):** lock seller `user_available` balance row FOR UPDATE → verify `balance >= amount` → `postJournal(escrow_lock: available −amount / escrow +amount)` → decrement `offers.remaining` (guard `remaining >= amount`) → update trade status via FSM → insert trade_event → set `payment_deadline = now() + interval`. Any failure rolls back everything.

**Release (seller confirms):** verify actor is seller + 2FA/PIN if configured → status must be `PAYMENT_SUBMITTED` → `postJournal`: seller escrow −amount; buyer available +(amount−fee); treasury +fee → status `COMPLETED`. **Refund/expiry:** escrow −amount / seller available +amount. **Dispute:** status only; funds untouched; only `admin:<id>` actor may perform `RESOLVED_*`.

## 4.6 Payments proof, Disputes, Chat

```sql
CREATE TABLE trade_payments (
  id uuid PRIMARY KEY, trade_id uuid NOT NULL REFERENCES trades(id) UNIQUE,
  reference text NOT NULL, sender_name text NOT NULL, sender_number text NOT NULL,
  proof_files jsonb NOT NULL, submitted_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE disputes (
  id uuid PRIMARY KEY, trade_id uuid NOT NULL REFERENCES trades(id) UNIQUE,
  opened_by uuid NOT NULL, reason text NOT NULL,
  status dispute_status NOT NULL DEFAULT 'OPEN',
  resolution text CHECK (resolution IN ('RELEASE_TO_BUYER','REFUND_TO_SELLER')),
  resolved_by uuid REFERENCES admins(id), resolution_notes text, resolved_at timestamptz
);
CREATE TABLE dispute_evidence (
  id uuid PRIMARY KEY, dispute_id uuid NOT NULL REFERENCES disputes(id),
  submitted_by uuid NOT NULL, kind text NOT NULL, files jsonb, note text
);

CREATE TABLE trade_messages (
  id uuid PRIMARY KEY, trade_id uuid NOT NULL REFERENCES trades(id),
  sender_id uuid NOT NULL, body text, attachment_key text,
  created_at timestamptz NOT NULL DEFAULT now()
);  -- retained ≥ trade retention window for dispute export; no hard delete while trade disputed
```

## 4.7 Admin, Audit, Risk, Notify

```sql
CREATE TABLE admins (
  id uuid PRIMARY KEY, email citext UNIQUE NOT NULL, password_hash text NOT NULL,
  role admin_role NOT NULL, totp_secret_enc bytea NOT NULL,   -- 2FA mandatory
  active boolean NOT NULL DEFAULT true
);

CREATE TABLE audit_logs (        -- append-only (same RULE/REVOKE pattern as ledger)
  id uuid PRIMARY KEY, actor_type text NOT NULL, actor_id uuid,
  action text NOT NULL, target_type text, target_id uuid,
  ip inet, metadata jsonb, created_at timestamptz NOT NULL DEFAULT now(),
  prev_hash bytea, row_hash bytea          -- hash chain for tamper evidence
);

CREATE TABLE risk_events (
  id uuid PRIMARY KEY, user_id uuid, kind text NOT NULL, score int NOT NULL,
  flags jsonb, action_taken text, created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE notifications (
  id uuid PRIMARY KEY, user_id uuid NOT NULL, channel text NOT NULL,
  template text NOT NULL, payload jsonb NOT NULL,
  status text NOT NULL DEFAULT 'queued', attempts int NOT NULL DEFAULT 0,
  delivered_at timestamptz
);

CREATE TABLE settings (key text PRIMARY KEY, value jsonb NOT NULL,
                       updated_by uuid, updated_at timestamptz);
-- fee_bps per method, trade timeout minutes, withdrawal caps, kill switches, KYC tier limits
```

## 4.8 Isolation & locking policy (memorize)

| Operation | Isolation | Locking |
|---|---|---|
| postJournal (all money moves) | SERIALIZABLE (retry on 40001, max 3, jitter) | account_balances FOR UPDATE, sorted order |
| Trade open / escrow lock | SERIALIZABLE | seller balance row + offer row FOR UPDATE |
| Seller confirm / release | SERIALIZABLE | trade row FOR UPDATE first, then balances |
| Deposit credit | READ COMMITTED + UNIQUE(tx_hash,log_index) upsert | idempotent by constraint |
| Withdrawal request | SERIALIZABLE | balance FOR UPDATE (debit at request time into pending) |
| Reads/dashboards | READ COMMITTED | none |

Every money service method must be written to be **retried safely** (idempotency key) because serializable transactions will abort under contention — this is expected behavior, not an error.
