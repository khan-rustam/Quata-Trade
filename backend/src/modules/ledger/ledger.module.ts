import { Module } from "@nestjs/common";
import { LedgerService } from "./ledger.service";

/**
 * ledger — the only writer of journal_entries/ledger_entries/account_balances.
 * NO HTTP endpoints (internal service only).
 * Callers: deposits, withdrawals, escrow, treasury, admin adjustments.
 */
@Module({
  providers: [LedgerService],
  exports: [LedgerService],
})
export class LedgerModule {}
