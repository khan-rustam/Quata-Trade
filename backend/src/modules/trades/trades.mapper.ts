import type { Kysely } from "kysely";
import {
  TRADE_STATUSES,
  zTrade,
  zTradeDetailResponse,
  zTradeEvent,
  type Trade,
  type TradeEvent,
  type TradeStatus,
} from "@quatatrade/shared";
import type { Database } from "../../db/types";
import type { TradeRow } from "../escrow/escrow.service";

/**
 * trades.mapper — DB rows → shared wire shapes (@quatatrade/shared).
 * bigint → decimal string, Date → ISO 8601 string, buyerCredit = amount − fee.
 * Outside production every mapped object is re-parsed with the shared zod
 * schema so contract drift throws server-side instead of reaching clients.
 * Never expose full emails: counterparties see first_name or "jo***".
 */

const VALIDATE_OUTPUT = process.env.NODE_ENV !== "production";

export interface PartyRow {
  id: string;
  first_name: string | null;
  email: string;
  reputation_score: number;
}

export interface PaymentRow {
  reference: string;
  sender_name: string;
  sender_number: string;
  proof_files: string[];
  submitted_at: Date;
}

export interface TradeEventRow {
  id: string;
  from_status: string | null;
  to_status: string;
  actor: string;
  created_at: Date;
}

export interface TradeDetailResponse {
  trade: Trade;
  events: TradeEvent[];
}

/** first_name when present, otherwise the email local-part masked like "jo***". */
export function displayNameOf(firstName: string | null, email: string): string {
  const name = firstName?.trim();
  if (name) return name;
  const localPart = email.split("@")[0] ?? "";
  return `${localPart.slice(0, 2)}***`;
}

/** Runtime narrowing without casts — trade_events rows come back as plain strings. */
function toTradeStatus(value: string): TradeStatus {
  const status = TRADE_STATUSES.find((s) => s === value);
  if (!status) throw new Error(`unknown trade status: ${value}`);
  return status;
}

function toParty(row: PartyRow): Trade["seller"] {
  return {
    id: row.id,
    displayName: displayNameOf(row.first_name, row.email),
    reputationScore: row.reputation_score,
  };
}

function toPayment(row: PaymentRow): NonNullable<Trade["payment"]> {
  return {
    reference: row.reference,
    senderName: row.sender_name,
    senderNumber: row.sender_number,
    proofFiles: row.proof_files,
    submittedAt: row.submitted_at.toISOString(),
  };
}

/** Map one trade row (+ optional payment proof) to the shared zTrade shape. */
export function mapTrade(
  row: TradeRow,
  parties: ReadonlyMap<string, PartyRow>,
  payment: PaymentRow | null,
): Trade {
  const seller = parties.get(row.seller_id);
  const buyer = parties.get(row.buyer_id);
  if (!seller || !buyer) {
    throw new Error(`party rows missing for trade ${row.id}`);
  }
  const trade: Trade = {
    id: row.id,
    shortRef: row.short_ref,
    offerId: row.offer_id,
    seller: toParty(seller),
    buyer: toParty(buyer),
    asset: row.asset,
    amount: row.amount.toString(),
    priceXafPerUnit: row.price_xaf_per_unit.toString(),
    fiatAmountXaf: row.fiat_amount_xaf.toString(),
    paymentMethod: row.payment_method,
    feeBps: row.fee_bps,
    feeAmount: row.fee_amount.toString(),
    buyerCredit: (row.amount - row.fee_amount).toString(),
    status: row.status,
    paymentDeadline: row.payment_deadline ? row.payment_deadline.toISOString() : null,
    payment: payment ? toPayment(payment) : null,
    completedAt: row.completed_at ? row.completed_at.toISOString() : null,
    createdAt: row.created_at.toISOString(),
  };
  return VALIDATE_OUTPUT ? zTrade.parse(trade) : trade;
}

export function mapTradeEvent(row: TradeEventRow): TradeEvent {
  const event: TradeEvent = {
    id: row.id,
    fromStatus: row.from_status === null ? null : toTradeStatus(row.from_status),
    toStatus: toTradeStatus(row.to_status),
    actor: row.actor,
    createdAt: row.created_at.toISOString(),
  };
  return VALIDATE_OUTPUT ? zTradeEvent.parse(event) : event;
}

export function mapTradeDetail(
  row: TradeRow,
  parties: ReadonlyMap<string, PartyRow>,
  payment: PaymentRow | null,
  events: readonly TradeEventRow[],
): TradeDetailResponse {
  const detail: TradeDetailResponse = {
    trade: mapTrade(row, parties, payment),
    events: events.map(mapTradeEvent),
  };
  return VALIDATE_OUTPUT ? zTradeDetailResponse.parse(detail) : detail;
}

/** Batch-load party display rows (one query per response, no N+1). */
export async function fetchParties(
  db: Kysely<Database>,
  userIds: readonly string[],
): Promise<Map<string, PartyRow>> {
  const unique = [...new Set(userIds)];
  if (unique.length === 0) return new Map();
  const rows = await db
    .selectFrom("users")
    .select(["id", "first_name", "email", "reputation_score"])
    .where("id", "in", unique)
    .execute();
  return new Map(rows.map((r) => [r.id, r]));
}

/** Batch-load payment proofs keyed by trade id (read-only, party-scoped by caller). */
export async function fetchPayments(
  db: Kysely<Database>,
  tradeIds: readonly string[],
): Promise<Map<string, PaymentRow>> {
  if (tradeIds.length === 0) return new Map();
  const rows = await db
    .selectFrom("trade_payments")
    .select(["trade_id", "reference", "sender_name", "sender_number", "proof_files", "submitted_at"])
    .where("trade_id", "in", [...tradeIds])
    .execute();
  return new Map(rows.map((r) => [r.trade_id, r]));
}
