import { Inject, Injectable, Optional } from "@nestjs/common";
import { HttpException } from "@nestjs/common";
import { sql, type Kysely, type Selectable } from "kysely";
import type { AssetCode, InternalTransferRequest } from "@quatatrade/shared";
import { ASSET_CODES, parseAmount } from "@quatatrade/shared";
import { DB } from "../../db/database.module";
import type { Database, DepositAddressesTable, DepositsTable } from "../../db/types";
import { newId } from "../../common/ids";
import { LedgerService } from "../ledger/ledger.service";
import { AuditService } from "../../common/audit/audit.service";
import { deriveTronAddress } from "./derivation";
import { WalletConfigService } from "./wallet-config.service";
import {
  AccountRestrictedError,
  PinServiceUnavailableError,
  PinVerificationError,
  TransferFailedError,
  XpubNotConfiguredError,
} from "./wallet.errors";
import { PIN_SERVICE, WALLET_XPUB, type PinVerifier } from "./wallet.tokens";

export type DepositAddressRow = Selectable<DepositAddressesTable>;
export type DepositRow = Selectable<DepositsTable>;

export interface AssetBalance {
  asset: AssetCode;
  available: bigint;
  inEscrow: bigint;
}

const UNIQUE_VIOLATION = "23505";

function pgCode(err: unknown): string | undefined {
  if (typeof err === "object" && err !== null && "code" in err) {
    const code = (err as { code?: unknown }).code;
    return typeof code === "string" ? code : undefined;
  }
  return undefined;
}

/**
 * wallet — watch-only (Documents/06). Derives deposit addresses from the
 * account xpub (never any private key), serves ledger-derived balances
 * (never chain-derived), and executes QuataPay internal transfers through
 * LedgerService only. Deposits table is READ here; the deposits module owns
 * every write to it.
 */
@Injectable()
export class WalletService {
  constructor(
    @Inject(DB) private readonly db: Kysely<Database>,
    private readonly ledger: LedgerService,
    @Inject(WALLET_XPUB) private readonly xpub: string,
    @Optional() @Inject(PIN_SERVICE) private readonly pinService?: PinVerifier,
    // When present (production wiring), the DB-active production xpub takes
    // precedence over the env value. Absent in unit tests → env xpub is used.
    @Optional() private readonly walletConfig?: WalletConfigService,
    // Optional so unit tests can construct without it; the Nest app injects the
    // @Global AuditService and every internal transfer is audit-logged.
    @Optional() private readonly audit?: AuditService,
  ) {}

  /** The xpub to derive from: DB-active config when wired, else the env value. */
  private async resolveXpub(): Promise<string> {
    return this.walletConfig ? this.walletConfig.getActiveXpub() : this.xpub;
  }

  /** Ledger-derived balances (user_available + user_escrow) per asset. */
  async getBalances(userId: string): Promise<AssetBalance[]> {
    const balances: AssetBalance[] = [];
    for (const asset of ASSET_CODES) {
      const availableId = await this.ledger.getOrCreateAccount(userId, "user_available", asset);
      const escrowId = await this.ledger.getOrCreateAccount(userId, "user_escrow", asset);
      balances.push({
        asset,
        available: await this.ledger.balanceOf(availableId),
        inEscrow: await this.ledger.balanceOf(escrowId),
      });
    }
    return balances;
  }

  /**
   * One deposit address per (user, asset) — UNIQUE-backed. New addresses take
   * derivation_index = max+1 per asset, serialized by a pg advisory xact lock
   * so two concurrent firsts can never mint the same index; the
   * UNIQUE (asset, derivation_index) constraint is the DB backstop.
   */
  async getOrCreateDepositAddress(userId: string, asset: AssetCode): Promise<DepositAddressRow> {
    const existing = await this.findAddress(userId, asset);
    if (existing) return existing;
    const xpub = await this.resolveXpub();
    if (xpub.length === 0) throw new XpubNotConfiguredError();

    try {
      return await this.db.transaction().execute(async (trx) => {
        await sql`SELECT pg_advisory_xact_lock(hashtext('deposit_addresses'), hashtext(${asset}))`.execute(trx);

        // re-check under the lock — another request may have won the race
        const raced = await trx
          .selectFrom("deposit_addresses")
          .selectAll()
          .where("user_id", "=", userId)
          .where("asset", "=", asset)
          .executeTakeFirst();
        if (raced) return raced;

        const maxRow = await trx
          .selectFrom("deposit_addresses")
          .select(sql<number | null>`MAX(derivation_index)`.as("max"))
          .where("asset", "=", asset)
          .executeTakeFirst();
        const nextIndex = (maxRow?.max ?? -1) + 1;

        const derived = deriveTronAddress(xpub, nextIndex);
        return trx
          .insertInto("deposit_addresses")
          .values({
            id: newId(),
            user_id: userId,
            asset,
            address: derived.address,
            derivation_index: derived.derivationIndex,
            derivation_path: derived.derivationPath,
          })
          .returningAll()
          .executeTakeFirstOrThrow();
      });
    } catch (err) {
      if (pgCode(err) === UNIQUE_VIOLATION) {
        // UNIQUE(user_id, asset) backstop won a race we did not see — reuse theirs
        const winner = await this.findAddress(userId, asset);
        if (winner) return winner;
      }
      throw err;
    }
  }

  /** Own-deposits history, paginated (IDOR-proof: always scoped by userId). */
  async listDeposits(
    userId: string,
    page: number,
    pageSize: number,
  ): Promise<{ items: DepositRow[]; total: number }> {
    const [items, count] = await Promise.all([
      this.db
        .selectFrom("deposits")
        .selectAll()
        .where("user_id", "=", userId)
        .orderBy("created_at", "desc")
        .limit(pageSize)
        .offset((page - 1) * pageSize)
        .execute(),
      this.db
        .selectFrom("deposits")
        .select((eb) => eb.fn.countAll<bigint>().as("n"))
        .where("user_id", "=", userId)
        .executeTakeFirstOrThrow(),
    ]);
    return { items, total: Number(count.n) };
  }

  /**
   * QuataPay internal transfer: sender user_available → recipient
   * user_available (reason internal_transfer). PIN-gated; idempotency key is
   * namespaced by sender so one user can never replay another user's key.
   * Unknown/self/non-active recipients all fail with the SAME generic error.
   */
  async internalTransfer(
    userId: string,
    dto: InternalTransferRequest,
  ): Promise<{ journalId: string; replayed: boolean }> {
    if (!this.pinService) throw new PinServiceUnavailableError();
    try {
      await this.pinService.verifyPin(userId, dto.pin);
    } catch (err) {
      // auth module may throw HttpExceptions (e.g. 423 lockout) — keep them
      if (err instanceof HttpException) throw err;
      throw new PinVerificationError();
    }

    const amount = parseAmount(dto.amount);

    const sender = await this.db
      .selectFrom("users")
      .select(["id", "status"])
      .where("id", "=", userId)
      .executeTakeFirst();
    if (!sender || sender.status !== "active") throw new AccountRestrictedError();

    // citext column → case-insensitive match; generic error, no enumeration
    const recipient = await this.db
      .selectFrom("users")
      .select(["id", "status"])
      .where("email", "=", dto.toEmail)
      .executeTakeFirst();
    if (!recipient || recipient.id === userId || recipient.status !== "active") {
      throw new TransferFailedError();
    }

    return this.ledger.withMoneyTransaction(async (trx) => {
      const fromAccount = await this.ledger.getOrCreateAccount(userId, "user_available", dto.asset, trx);
      const toAccount = await this.ledger.getOrCreateAccount(recipient.id, "user_available", dto.asset, trx);
      const transferId = newId();
      const { journalId, replayed } = await this.ledger.postJournal(
        {
          reason: "internal_transfer",
          referenceType: "internal_transfer",
          referenceId: transferId,
          idempotencyKey: `internal_transfer:${userId}:${dto.idempotencyKey}`,
          createdBy: `user:${userId}`,
          asset: dto.asset,
          legs: [
            { accountId: fromAccount, amount: -amount },
            { accountId: toAccount, amount },
          ],
        },
        trx,
      );
      if (!replayed) {
        await trx
          .insertInto("outbox")
          .values({
            id: newId(),
            event_type: "wallet.internal_transfer",
            payload: JSON.stringify({
              journalId,
              fromUserId: userId,
              toUserId: recipient.id,
              asset: dto.asset,
              amount: dto.amount,
            }),
          })
          .execute();
        // Immutable audit trail — user-initiated money movement, like withdrawals.
        if (this.audit) {
          await this.audit.log(
            {
              actorType: "user",
              actorId: userId,
              action: "wallet.internal_transfer",
              targetType: "user",
              targetId: recipient.id,
              metadata: { fromUserId: userId, toUserId: recipient.id, asset: dto.asset, amount: dto.amount, journalId },
            },
            trx,
          );
        }
      }
      return { journalId, replayed };
    });
  }

  private async findAddress(userId: string, asset: AssetCode): Promise<DepositAddressRow | undefined> {
    return this.db
      .selectFrom("deposit_addresses")
      .selectAll()
      .where("user_id", "=", userId)
      .where("asset", "=", asset)
      .executeTakeFirst();
  }
}
