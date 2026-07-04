import { describe, expect, it } from "vitest";
import { zOffer, zTrade, zTradeDetailResponse, zTradeEvent } from "@quatatrade/shared";
import type { Selectable } from "kysely";
import type { OffersTable, TradesTable } from "../../db/types";
import { mapOffer, type TraderContext } from "../offers/offers.mapper";
import {
  displayNameOf,
  mapTrade,
  mapTradeDetail,
  mapTradeEvent,
  type PartyRow,
  type PaymentRow,
  type TradeEventRow,
} from "./trades.mapper";

/**
 * HTTP-layer mapper tests: DB row → shared wire schema. These lock the
 * FE/BE contract — if a mapper drifts from @quatatrade/shared, parse throws.
 */

const SELLER_ID = "0197a3c2-9d10-7abc-8def-000000000001";
const BUYER_ID = "0197a3c2-9d10-7abc-8def-000000000002";
const TRADE_ID = "0197a3c2-9d10-7abc-8def-000000000003";
const OFFER_ID = "0197a3c2-9d10-7abc-8def-000000000004";
const EVENT_ID = "0197a3c2-9d10-7abc-8def-000000000005";

const createdAt = new Date("2026-07-02T08:00:00.000Z");
const deadline = new Date("2026-07-02T08:30:00.000Z");

function tradeRow(overrides: Partial<Selectable<TradesTable>> = {}): Selectable<TradesTable> {
  return {
    id: TRADE_ID,
    short_ref: "QT-8F3K2",
    country: "CM",
    offer_id: OFFER_ID,
    seller_id: SELLER_ID,
    buyer_id: BUYER_ID,
    asset: "USDT_TRC20",
    amount: 1_000_000n,
    price_xaf_per_unit: 650n,
    fiat_amount_xaf: 650n,
    payment_method: "QUATAPAY",
    fee_bps: 30,
    fee_amount: 3_000n,
    status: "ESCROW_LOCKED",
    payment_deadline: deadline,
    completed_at: null,
    escrow_journal_id: null,
    release_journal_id: null,
    created_at: createdAt,
    updated_at: null,
    ...overrides,
  };
}

function parties(): Map<string, PartyRow> {
  return new Map<string, PartyRow>([
    [SELLER_ID, { id: SELLER_ID, first_name: "Alice", email: "alice.seller@example.com", reputation_score: 42, payment_accounts: {} }],
    [BUYER_ID, { id: BUYER_ID, first_name: null, email: "john.buyer@example.com", reputation_score: 7, payment_accounts: {} }],
  ]);
}

describe("displayNameOf — masked display names", () => {
  it("uses first_name when present", () => {
    expect(displayNameOf("Alice", "alice@example.com")).toBe("Alice");
  });

  it("masks the email local-part like jo*** when first_name is missing", () => {
    expect(displayNameOf(null, "john.buyer@example.com")).toBe("jo***");
    expect(displayNameOf("   ", "mary@example.com")).toBe("ma***");
  });

  it("handles a one-character local part without leaking more", () => {
    expect(displayNameOf(null, "a@example.com")).toBe("a***");
  });

  it("never contains the email domain", () => {
    expect(displayNameOf(null, "john@example.com")).not.toContain("example.com");
    expect(displayNameOf(null, "john@example.com")).not.toContain("@");
  });
});

describe("mapTrade — row → zTrade", () => {
  it("produces output the shared schema accepts", () => {
    const mapped = mapTrade(tradeRow(), parties(), null);
    expect(() => zTrade.parse(mapped)).not.toThrow();
  });

  it("round-trips bigints as decimal strings", () => {
    const row = tradeRow({ amount: 123_456_789_012_345n, fee_amount: 370_370_367_037n });
    const mapped = mapTrade(row, parties(), null);
    expect(mapped.amount).toBe("123456789012345");
    expect(BigInt(mapped.amount)).toBe(row.amount);
    expect(BigInt(mapped.feeAmount)).toBe(row.fee_amount);
    expect(BigInt(mapped.priceXafPerUnit)).toBe(row.price_xaf_per_unit);
    expect(BigInt(mapped.fiatAmountXaf)).toBe(row.fiat_amount_xaf);
  });

  it("computes buyerCredit = amount − fee exactly", () => {
    const mapped = mapTrade(tradeRow(), parties(), null);
    expect(mapped.buyerCredit).toBe("997000");
    expect(BigInt(mapped.buyerCredit) + BigInt(mapped.feeAmount)).toBe(1_000_000n);
  });

  it("maps parties with masked names and reputation", () => {
    const mapped = mapTrade(tradeRow(), parties(), null);
    expect(mapped.seller).toEqual({ id: SELLER_ID, displayName: "Alice", reputationScore: 42 });
    expect(mapped.buyer).toEqual({ id: BUYER_ID, displayName: "jo***", reputationScore: 7 });
  });

  it("serializes dates as ISO strings and nulls stay null", () => {
    const mapped = mapTrade(tradeRow(), parties(), null);
    expect(mapped.createdAt).toBe("2026-07-02T08:00:00.000Z");
    expect(mapped.paymentDeadline).toBe("2026-07-02T08:30:00.000Z");
    expect(mapped.completedAt).toBeNull();
    expect(mapped.payment).toBeNull();
  });

  it("maps a payment proof when present", () => {
    const payment: PaymentRow = {
      reference: "MP-123456",
      sender_name: "John B",
      sender_number: "+237650000000",
      proof_files: ["proofs/a.jpg", "proofs/b.jpg"],
      submitted_at: new Date("2026-07-02T08:10:00.000Z"),
    };
    const mapped = mapTrade(tradeRow({ status: "PAYMENT_SUBMITTED" }), parties(), payment);
    expect(mapped.payment).toEqual({
      reference: "MP-123456",
      senderName: "John B",
      senderNumber: "+237650000000",
      proofFiles: ["proofs/a.jpg", "proofs/b.jpg"],
      submittedAt: "2026-07-02T08:10:00.000Z",
    });
  });

  it("throws when a party row is missing (no silent partial responses)", () => {
    const onlySeller = new Map<string, PartyRow>([
      [SELLER_ID, { id: SELLER_ID, first_name: "Alice", email: "alice@example.com", reputation_score: 1, payment_accounts: {} }],
    ]);
    expect(() => mapTrade(tradeRow(), onlySeller, null)).toThrow(/party rows missing/);
  });
});

describe("mapTradeEvent — row → zTradeEvent", () => {
  const eventRow: TradeEventRow = {
    id: EVENT_ID,
    from_status: null,
    to_status: "OPENED",
    actor: `buyer:${BUYER_ID}`,
    created_at: createdAt,
  };

  it("parses against the shared schema, null from_status allowed", () => {
    const mapped = mapTradeEvent(eventRow);
    expect(() => zTradeEvent.parse(mapped)).not.toThrow();
    expect(mapped.fromStatus).toBeNull();
    expect(mapped.toStatus).toBe("OPENED");
    expect(mapped.createdAt).toBe("2026-07-02T08:00:00.000Z");
  });

  it("rejects unknown statuses instead of leaking bad enum values", () => {
    expect(() => mapTradeEvent({ ...eventRow, to_status: "NOT_A_STATUS" })).toThrow(/unknown trade status/);
  });
});

describe("mapTradeDetail — zTradeDetailResponse", () => {
  it("bundles trade + ordered events and passes the shared schema", () => {
    const events: TradeEventRow[] = [
      { id: EVENT_ID, from_status: null, to_status: "OPENED", actor: "buyer:x", created_at: createdAt },
      {
        id: "0197a3c2-9d10-7abc-8def-000000000006",
        from_status: "OPENED",
        to_status: "ESCROW_LOCKED",
        actor: "buyer:x",
        created_at: deadline,
      },
    ];
    const detail = mapTradeDetail(tradeRow(), parties(), null, events);
    expect(() => zTradeDetailResponse.parse(detail)).not.toThrow();
    expect(detail.events).toHaveLength(2);
    expect(detail.events[1]?.fromStatus).toBe("OPENED");
  });
});

describe("mapOffer — row → zOffer", () => {
  const offerRow: Selectable<OffersTable> = {
    id: OFFER_ID,
    user_id: SELLER_ID,
    country: "CM",
    side: "SELL",
    asset: "USDT_TRC20",
    price_xaf_per_unit: 655n,
    min_trade: 10_000_000n,
    max_trade: 500_000_000n,
    remaining: 1_000_000_000n,
    payment_methods: ["QUATAPAY", "MTN_MOMO"],
    terms: "Fast release",
    status: "ACTIVE",
    created_at: createdAt,
    updated_at: null,
  };

  const trader: TraderContext = {
    user: { id: SELLER_ID, first_name: null, email: "alice@example.com", reputation_score: 42, kyc_tier: 2 },
    stats: { completed: 7, cancelled: 2, expired: 1 },
  };

  it("passes the shared schema with bigint string round-trip", () => {
    const mapped = mapOffer(offerRow, trader);
    expect(() => zOffer.parse(mapped)).not.toThrow();
    expect(BigInt(mapped.remaining)).toBe(1_000_000_000n);
    expect(mapped.trader.displayName).toBe("al***");
  });

  it("computes completionRate = completed / max(1, terminal) * 100 rounded", () => {
    const mapped = mapOffer(offerRow, trader);
    expect(mapped.trader.completedTrades).toBe(7);
    expect(mapped.trader.completionRate).toBe(70); // 7 / 10 * 100
  });

  it("uses max(1, …) so a fresh trader is 0%, not NaN", () => {
    const fresh: TraderContext = { ...trader, stats: { completed: 0, cancelled: 0, expired: 0 } };
    expect(mapOffer(offerRow, fresh).trader.completionRate).toBe(0);
  });
});
