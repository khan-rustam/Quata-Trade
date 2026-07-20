import { sql, type Kysely } from "kysely";

const OLD_ANSWER =
  "No. Trading fees are published on the Fees page (0.3%–0.5% per method) and shown before you open a trade. Withdrawals pay only the blockchain network fee, shown before you confirm.";

const NEW_ANSWER =
  "No. Every fee is published on the Fees page and shown before you confirm. Trading fees are charged per payment method; deposits and withdrawals each carry a platform fee in addition to the blockchain network fee, and the exact amounts are displayed before you commit.";

/**
 * The seeded "Are there any hidden fees?" answer told users that withdrawals pay
 * ONLY the blockchain network fee, while `withdrawal_fee` is configured at 1 USDT
 * and WithdrawalsService charges it on every withdrawal — a published statement
 * contradicting what is taken, on the FAQ entry specifically about hidden fees.
 *
 * Migration 0011 has already run on any live database, so correcting the seed
 * there would fix nothing deployed; this updates the row in place. Matched on the
 * exact old text so an operator who has since edited the answer keeps their
 * wording rather than having it silently overwritten.
 */
export async function up(db: Kysely<unknown>): Promise<void> {
  await sql`UPDATE faqs SET answer = ${NEW_ANSWER} WHERE answer = ${OLD_ANSWER}`.execute(db);
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await sql`UPDATE faqs SET answer = ${OLD_ANSWER} WHERE answer = ${NEW_ANSWER}`.execute(db);
}
