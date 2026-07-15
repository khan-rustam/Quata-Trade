import { Inject, Injectable } from "@nestjs/common";
import * as argon2 from "argon2";
import { sql, type Kysely } from "kysely";
import { DB } from "../../db/database.module";
import type { Database } from "../../db/types";
import { AuditService } from "../../common/audit/audit.service";
import { InvalidCredentialsError, InvalidPinError, PinLockedError, PinNotSetError } from "./auth.errors";

const MAX_PIN_ATTEMPTS = 5;
const PIN_LOCK_MS = 15 * 60_000;

/**
 * Transaction PIN: argon2id-hashed, 5-attempt lockout (15 min).
 * verifyPin() is the single helper wallet/withdrawals call before moving
 * money — it throws typed PinErrors, callers must not swallow them.
 */
@Injectable()
export class PinService {
  constructor(
    @Inject(DB) private readonly db: Kysely<Database>,
    private readonly audit: AuditService,
  ) {}

  /** Set/replace the PIN. Requires the account password (step-up auth). */
  async setPin(userId: string, pin: string, currentPassword: string): Promise<void> {
    const user = await this.db
      .selectFrom("users")
      .select(["id", "password_hash"])
      .where("id", "=", userId)
      .executeTakeFirst();
    if (!user) throw new InvalidCredentialsError();

    const passwordOk = await argon2.verify(user.password_hash, currentPassword).catch(() => false);
    if (!passwordOk) throw new InvalidCredentialsError();

    const pinHash = await argon2.hash(pin, { type: argon2.argon2id });
    await this.db
      .updateTable("users")
      .set({ pin_hash: pinHash, pin_attempts: 0, pin_locked_until: null, updated_at: new Date() })
      .where("id", "=", userId)
      .execute();
    await this.audit.log({
      actorType: "user",
      actorId: userId,
      action: "auth.pin_set",
      targetType: "user",
      targetId: userId,
    });
  }

  /**
   * Verify the PIN for a sensitive operation. Throws:
   *  - PinNotSetError    → user has no PIN yet
   *  - PinLockedError    → locked for 15 min after 5 wrong attempts
   *  - InvalidPinError   → wrong PIN (attempt counted)
   */
  async verifyPin(userId: string, pin: string): Promise<void> {
    // Serialize a user's PIN attempts under a per-user advisory lock so concurrent
    // guesses cannot overshoot the 5-attempt lockout (each attempt increments and
    // re-checks the threshold while holding the lock). Same pattern as the
    // withdrawal daily-cap TOCTOU guard.
    await this.db.transaction().execute(async (trx) => {
      await sql`SELECT pg_advisory_xact_lock(hashtext('pin_verify'), hashtext(${userId}))`.execute(trx);

      const user = await trx
        .selectFrom("users")
        .select(["id", "pin_hash", "pin_attempts", "pin_locked_until"])
        .where("id", "=", userId)
        .executeTakeFirst();
      if (!user || !user.pin_hash) throw new PinNotSetError();
      if (user.pin_locked_until && user.pin_locked_until.getTime() > Date.now()) {
        throw new PinLockedError();
      }

      const ok = await argon2.verify(user.pin_hash, pin).catch(() => false);
      if (ok) {
        if (user.pin_attempts > 0 || user.pin_locked_until) {
          await trx
            .updateTable("users")
            .set({ pin_attempts: 0, pin_locked_until: null, updated_at: new Date() })
            .where("id", "=", userId)
            .execute();
        }
        return;
      }

      const row = await trx
        .updateTable("users")
        .set((eb) => ({ pin_attempts: eb("pin_attempts", "+", 1), updated_at: new Date() }))
        .where("id", "=", userId)
        .returning(["pin_attempts"])
        .executeTakeFirst();
      const attempts = row?.pin_attempts ?? 0;
      if (attempts >= MAX_PIN_ATTEMPTS) {
        await trx
          .updateTable("users")
          .set({ pin_locked_until: new Date(Date.now() + PIN_LOCK_MS), pin_attempts: 0, updated_at: new Date() })
          .where("id", "=", userId)
          .execute();
        await this.audit.log(
          {
            actorType: "system",
            actorId: null,
            action: "auth.pin_locked",
            targetType: "user",
            targetId: userId,
            metadata: { minutes: PIN_LOCK_MS / 60_000 },
          },
          trx,
        );
        throw new PinLockedError();
      }
      throw new InvalidPinError();
    });
  }
}
