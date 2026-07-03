import type { ColumnType, Generated } from "kysely";
import type {
  AccountKind,
  AdminRole,
  AssetCode,
  DepositStatus,
  DisputeResolution,
  DisputeStatus,
  EntryReason,
  KycStatus,
  OfferSide,
  OfferStatus,
  PaymentMethod,
  TradeStatus,
  UserStatus,
  WithdrawalStatus,
} from "@quatatrade/shared";

/**
 * Kysely table types — MUST stay 1:1 with src/db/migrations/*.
 * bigint columns are real `bigint` in TS (pg int8 parser configured in database.provider).
 * jsonb columns insert as pre-stringified JSON (never raw objects/arrays — node-pg
 * would coerce JS arrays into PG array literals).
 */

type Timestamp = ColumnType<Date, Date | string | undefined, never>;
type Json<T> = ColumnType<T, string, string>;

export interface UsersTable {
  id: string;
  email: string;
  phone: string | null;
  password_hash: string;
  pin_hash: string | null;
  pin_attempts: Generated<number>;
  pin_locked_until: ColumnType<Date | null, Date | null | undefined, Date | null>;
  failed_login_attempts: Generated<number>;
  locked_until: ColumnType<Date | null, Date | null | undefined, Date | null>;
  first_name: string | null;
  last_name: string | null;
  country: Generated<string>;
  email_verified_at: ColumnType<Date | null, Date | null | undefined, Date | null>;
  phone_verified_at: ColumnType<Date | null, Date | null | undefined, Date | null>;
  kyc_tier: Generated<number>;
  kyc_status: Generated<KycStatus>;
  totp_secret_enc: Buffer | null;
  totp_enabled: Generated<boolean>;
  status: Generated<UserStatus>;
  reputation_score: Generated<number>;
  display_name: string | null;
  avatar_style: string | null;
  avatar_seed: string | null;
  bio: string | null;
  pending_email: string | null;
  pending_email_token_hash: string | null;
  pending_email_expires_at: ColumnType<Date | null, Date | null | undefined, Date | null>;
  withdrawal_hold_until: ColumnType<Date | null, Date | null | undefined, Date | null>;
  /** off-platform receiving accounts, keyed by payment method (jsonb; read → object, write → JSON string) */
  payment_accounts: ColumnType<
    Partial<Record<PaymentMethod, { number: string; name: string }>>,
    string | undefined,
    string
  >;
  created_at: Timestamp;
  updated_at: ColumnType<Date | null, never, Date | string>;
}

export interface SessionsTable {
  id: string;
  user_id: string;
  refresh_hash: string;
  device_fingerprint: string | null;
  ip: string | null;
  user_agent: string | null;
  expires_at: ColumnType<Date, Date | string, Date | string>;
  revoked_at: ColumnType<Date | null, Date | null | undefined, Date | null>;
  rotated_from: string | null;
  created_at: Timestamp;
}

export interface AuthTokensTable {
  id: string;
  user_id: string;
  kind: "email_otp" | "phone_otp" | "password_reset";
  token_hash: string;
  expires_at: ColumnType<Date, Date | string, never>;
  consumed_at: ColumnType<Date | null, Date | null | undefined, Date | null>;
  attempts: Generated<number>;
  created_at: Timestamp;
}

export interface AdminsTable {
  id: string;
  email: string;
  password_hash: string;
  role: AdminRole;
  totp_secret_enc: Buffer | null;
  totp_enabled: Generated<boolean>;
  active: Generated<boolean>;
  created_at: Timestamp;
}

export interface AccountsTable {
  id: string;
  owner_user_id: string | null;
  kind: AccountKind;
  asset: AssetCode;
  created_at: Timestamp;
}

export interface JournalEntriesTable {
  id: string;
  reason: EntryReason;
  reference_type: string;
  reference_id: string;
  idempotency_key: string;
  created_by: string;
  created_at: Timestamp;
}

export interface LedgerEntriesTable {
  id: string;
  journal_id: string;
  account_id: string;
  asset: AssetCode;
  amount: bigint;
  created_at: Timestamp;
}

export interface AccountBalancesTable {
  account_id: string;
  kind: AccountKind;
  balance: Generated<bigint>;
  version: Generated<bigint>;
}

export interface DepositAddressesTable {
  id: string;
  user_id: string;
  asset: AssetCode;
  address: string;
  derivation_index: number;
  derivation_path: string;
  active: Generated<boolean>;
  created_at: Timestamp;
}

export interface DepositsTable {
  id: string;
  user_id: string;
  asset: AssetCode;
  address: string;
  tx_hash: string;
  log_index: Generated<number>;
  amount: bigint;
  token_contract: string;
  block_number: bigint | null;
  confirmations: Generated<number>;
  status: Generated<DepositStatus>;
  credited_journal_id: string | null;
  /** On-chain sender (TRC20 `from`) — screened against the AML blocklist (item 4b). */
  from_address: string | null;
  /** Tainted-source hold: true → never auto-credited, awaits compliance review. */
  aml_hold: Generated<boolean>;
  aml_reason: string | null;
  created_at: Timestamp;
  updated_at: ColumnType<Date | null, never, Date | string>;
}

export interface WithdrawalsTable {
  id: string;
  user_id: string;
  asset: AssetCode;
  to_address: string;
  amount: bigint;
  fee: bigint;
  status: Generated<WithdrawalStatus>;
  risk_score: number | null;
  risk_flags: Json<Record<string, unknown>> | null;
  approved_by: string | null;
  second_approver: string | null;
  tx_hash: string | null;
  failure_reason: string | null;
  debit_journal_id: string | null;
  idempotency_key: string;
  created_at: Timestamp;
  updated_at: ColumnType<Date | null, never, Date | string>;
}

export interface OffersTable {
  id: string;
  user_id: string;
  side: OfferSide;
  asset: AssetCode;
  price_xaf_per_unit: bigint;
  min_trade: bigint;
  max_trade: bigint;
  remaining: bigint;
  payment_methods: PaymentMethod[];
  terms: string | null;
  status: Generated<OfferStatus>;
  created_at: Timestamp;
  updated_at: ColumnType<Date | null, never, Date | string>;
}

export interface TradesTable {
  id: string;
  short_ref: string;
  offer_id: string;
  seller_id: string;
  buyer_id: string;
  asset: AssetCode;
  amount: bigint;
  price_xaf_per_unit: bigint;
  fiat_amount_xaf: bigint;
  payment_method: PaymentMethod;
  fee_bps: number;
  fee_amount: bigint;
  status: Generated<TradeStatus>;
  payment_deadline: ColumnType<Date | null, Date | null | undefined, Date | null>;
  completed_at: ColumnType<Date | null, Date | null | undefined, Date | null>;
  escrow_journal_id: string | null;
  release_journal_id: string | null;
  created_at: Timestamp;
  updated_at: ColumnType<Date | null, never, Date | string>;
}

export interface TradeEventsTable {
  id: string;
  trade_id: string;
  from_status: TradeStatus | null;
  to_status: TradeStatus;
  actor: string;
  metadata: Json<Record<string, unknown>> | null;
  created_at: Timestamp;
}

export interface TradeTransitionsTable {
  from_status: TradeStatus;
  to_status: TradeStatus;
}

export interface TradePaymentsTable {
  id: string;
  trade_id: string;
  reference: string;
  sender_name: string;
  sender_number: string;
  proof_files: Json<string[]>;
  submitted_at: Timestamp;
}

export interface DisputesTable {
  id: string;
  trade_id: string;
  opened_by: string;
  reason: string;
  status: Generated<DisputeStatus>;
  resolution: DisputeResolution | null;
  resolved_by: string | null;
  resolution_notes: string | null;
  resolved_at: ColumnType<Date | null, Date | null | undefined, Date | null>;
  created_at: Timestamp;
}

export interface DisputeEvidenceTable {
  id: string;
  dispute_id: string;
  submitted_by: string;
  kind: string;
  files: Json<string[]> | null;
  note: string | null;
  created_at: Timestamp;
}

export interface TradeMessagesTable {
  id: string;
  trade_id: string;
  sender_id: string;
  body: string | null;
  attachment_key: string | null;
  created_at: Timestamp;
}

export interface KycSubmissionsTable {
  id: string;
  user_id: string;
  tier: number;
  doc_type: string;
  files: Json<string[]>;
  ocr_prefill: Json<Record<string, unknown>> | null;
  status: Generated<KycStatus>;
  reviewed_by: string | null;
  review_notes: string | null;
  reviewed_at: ColumnType<Date | null, Date | null | undefined, Date | null>;
  retention_delete_after: ColumnType<Date, Date | string, Date | string>;
  created_at: Timestamp;
}

export interface AuditLogsTable {
  id: string;
  /** monotonic append-order sequence (migration 0008) — the hash chain orders by this */
  seq: Generated<bigint>;
  actor_type: string;
  actor_id: string | null;
  action: string;
  target_type: string | null;
  target_id: string | null;
  ip: string | null;
  metadata: Json<Record<string, unknown>> | null;
  prev_hash: Buffer | null;
  row_hash: Buffer | null;
  created_at: Timestamp;
}

export interface RiskEventsTable {
  id: string;
  user_id: string | null;
  kind: string;
  score: number;
  flags: Json<Record<string, unknown>> | null;
  action_taken: string | null;
  created_at: Timestamp;
}

export interface NotificationsTable {
  id: string;
  user_id: string;
  channel: string;
  template: string;
  payload: Json<Record<string, unknown>>;
  status: Generated<string>;
  attempts: Generated<number>;
  read_at: ColumnType<Date | null, Date | null | undefined, Date | null>;
  delivered_at: ColumnType<Date | null, Date | null | undefined, Date | null>;
  created_at: Timestamp;
}

export interface SettingsTable {
  key: string;
  value: Json<unknown>;
  updated_by: string | null;
  updated_at: ColumnType<Date | null, Date | null | undefined, Date | string>;
}

export interface OutboxTable {
  id: string;
  event_type: string;
  payload: Json<Record<string, unknown>>;
  created_at: Timestamp;
  processed_at: ColumnType<Date | null, Date | null | undefined, Date | null>;
  attempts: Generated<number>;
  next_attempt_at: ColumnType<Date | null, Date | null | undefined, Date | null>;
}

export interface FaqsTable {
  id: string;
  category: Generated<string>;
  question: string;
  answer: string;
  sort_order: Generated<number>;
  published: Generated<boolean>;
  created_at: Timestamp;
  updated_at: ColumnType<Date | null, Date | null | undefined, Date | null>;
}

export interface ReviewsTable {
  id: string;
  author_name: string;
  location: string | null;
  rating: number;
  body: string;
  sort_order: Generated<number>;
  published: Generated<boolean>;
  created_at: Timestamp;
}

export interface EnquiriesTable {
  id: string;
  name: string;
  email: string;
  subject: string | null;
  message: string;
  status: Generated<string>;
  created_at: Timestamp;
}

export interface WithdrawalAddressesTable {
  id: string;
  user_id: string;
  asset: AssetCode;
  address: string;
  label: string | null;
  usable_at: ColumnType<Date, Date | string, Date | string>;
  active: Generated<boolean>;
  created_at: Timestamp;
}

/** AML / sanctions / wallet-blacklist (migration 0012). Deterministic screening only. */
export interface BlockedAddressesTable {
  id: string;
  asset: AssetCode;
  address: string;
  category: string;
  reason: string;
  source: Generated<string>;
  active: Generated<boolean>;
  created_by: Generated<string>;
  created_at: Timestamp;
  updated_at: ColumnType<Date | null, never, Date | string>;
}

export interface Database {
  users: UsersTable;
  sessions: SessionsTable;
  auth_tokens: AuthTokensTable;
  admins: AdminsTable;
  accounts: AccountsTable;
  journal_entries: JournalEntriesTable;
  ledger_entries: LedgerEntriesTable;
  account_balances: AccountBalancesTable;
  deposit_addresses: DepositAddressesTable;
  deposits: DepositsTable;
  withdrawals: WithdrawalsTable;
  withdrawal_addresses: WithdrawalAddressesTable;
  blocked_addresses: BlockedAddressesTable;
  offers: OffersTable;
  trades: TradesTable;
  trade_events: TradeEventsTable;
  trade_transitions: TradeTransitionsTable;
  trade_payments: TradePaymentsTable;
  disputes: DisputesTable;
  dispute_evidence: DisputeEvidenceTable;
  trade_messages: TradeMessagesTable;
  kyc_submissions: KycSubmissionsTable;
  audit_logs: AuditLogsTable;
  risk_events: RiskEventsTable;
  notifications: NotificationsTable;
  settings: SettingsTable;
  outbox: OutboxTable;
  faqs: FaqsTable;
  reviews: ReviewsTable;
  enquiries: EnquiriesTable;
}
