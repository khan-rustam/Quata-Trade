import { Inject, Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { authenticator } from "otplib";
import { toDataURL } from "qrcode";
import type { Kysely } from "kysely";
import { DB } from "../../db/database.module";
import type { Database } from "../../db/types";
import type { Env } from "../../config/env";
import { AuditService } from "../../common/audit/audit.service";
import { decryptSecret, encryptSecret } from "../../common/crypto";
import { InvalidCodeError, InvalidCredentialsError, TotpAlreadyEnabledError, TotpNotConfiguredError } from "./auth.errors";

const TOTP_ISSUER = "QuataTrade";

export interface TotpSetup {
  otpauthUrl: string;
  qrDataUrl: string;
}

/**
 * TOTP 2FA lifecycle. The secret is stored ONLY AES-256-GCM-encrypted
 * (users.totp_secret_enc) under MASTER_ENCRYPTION_KEY and is never logged,
 * audited, or returned after setup. Required for withdrawals + admin actions.
 */
@Injectable()
export class TotpService {
  constructor(
    @Inject(DB) private readonly db: Kysely<Database>,
    private readonly config: ConfigService<Env, true>,
    private readonly audit: AuditService,
  ) {}

  private get key(): string {
    return this.config.get("MASTER_ENCRYPTION_KEY", { infer: true });
  }

  /** Generate + store an encrypted secret; return provisioning URL and QR. */
  async setup(userId: string): Promise<TotpSetup> {
    const user = await this.db
      .selectFrom("users")
      .select(["id", "email", "totp_enabled"])
      .where("id", "=", userId)
      .executeTakeFirst();
    if (!user) throw new InvalidCredentialsError();
    if (user.totp_enabled) throw new TotpAlreadyEnabledError();

    const secret = authenticator.generateSecret();
    // guarded update: never overwrite the secret of an already-enabled account
    const res = await this.db
      .updateTable("users")
      .set({ totp_secret_enc: encryptSecret(secret, this.key), updated_at: new Date() })
      .where("id", "=", userId)
      .where("totp_enabled", "=", false)
      .executeTakeFirst();
    if (res.numUpdatedRows === 0n) throw new TotpAlreadyEnabledError();

    const otpauthUrl = authenticator.keyuri(user.email, TOTP_ISSUER, secret);
    const qrDataUrl = await toDataURL(otpauthUrl);
    await this.audit.log({
      actorType: "user",
      actorId: userId,
      action: "auth.2fa_setup_started",
      targetType: "user",
      targetId: userId,
    });
    return { otpauthUrl, qrDataUrl };
  }

  /** Turn 2FA on after the user proves possession of the secret. */
  async enable(userId: string, code: string): Promise<void> {
    const user = await this.db
      .selectFrom("users")
      .select(["id", "totp_secret_enc", "totp_enabled"])
      .where("id", "=", userId)
      .executeTakeFirst();
    if (!user || !user.totp_secret_enc) throw new TotpNotConfiguredError();
    if (user.totp_enabled) return; // idempotent
    if (!this.checkEncrypted(user.totp_secret_enc, code)) throw new InvalidCodeError();

    await this.db
      .updateTable("users")
      .set({
        totp_enabled: true,
        // Hold withdrawals for 24h after a 2FA change — defends against attacker-enrolled 2FA.
        withdrawal_hold_until: new Date(Date.now() + 24 * 60 * 60 * 1000),
        updated_at: new Date(),
      })
      .where("id", "=", userId)
      .execute();
    await this.audit.log({
      actorType: "user",
      actorId: userId,
      action: "auth.2fa_enabled",
      targetType: "user",
      targetId: userId,
    });
  }

  /**
   * Sensitive-flow check (withdrawals, seller confirm, /auth/2fa/verify):
   * throws unless 2FA is enabled AND the code is currently valid.
   */
  async assertCode(userId: string, code: string): Promise<void> {
    const user = await this.db
      .selectFrom("users")
      .select(["totp_secret_enc", "totp_enabled"])
      .where("id", "=", userId)
      .executeTakeFirst();
    if (!user || !user.totp_enabled || !user.totp_secret_enc || !this.checkEncrypted(user.totp_secret_enc, code)) {
      throw new InvalidCodeError();
    }
  }

  /** Pure check against an encrypted secret (used by AuthService.login). */
  checkEncrypted(encryptedSecret: Buffer, code: string): boolean {
    try {
      return authenticator.check(code, decryptSecret(encryptedSecret, this.key));
    } catch {
      return false; // corrupt blob / wrong key — never explain why
    }
  }
}
