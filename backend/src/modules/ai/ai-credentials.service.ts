import { createHash } from "node:crypto";
import { Inject, Injectable, Logger } from "@nestjs/common";
import type { Kysely } from "kysely";
import { ConfigService } from "@nestjs/config";
import { AuditService } from "../../common/audit/audit.service";
import { decryptSecret, encryptSecret } from "../../common/crypto";
import { DB } from "../../db/database.module";
import type { Database } from "../../db/types";
import type { Env } from "../../config/env";

/**
 * The OpenAI API key, set by an admin and encrypted at rest.
 *
 * ## Why this exists rather than "just use the env var"
 *
 * The env var still works and is still the fallback — but rotating it means
 * an ops person with shell access, a file edit and a service restart. Putting
 * the key behind an admin screen makes rotation a thirty-second job for the
 * person who actually holds the OpenAI account. That is the whole benefit,
 * and it is worth the machinery below only because the machinery is honest
 * about being a secret store.
 *
 * ## The rules this follows, because it is QuataTrade's first admin-writable secret
 *
 * - **Encrypted at rest** with the same AES-256-GCM helper that protects TOTP
 *   seeds (`common/crypto.ts`), keyed by `MASTER_ENCRYPTION_KEY`. The
 *   database never holds the plaintext.
 * - **Write-only from the outside.** No endpoint returns the key, ever. The
 *   admin screen shows *configured / not configured*, who set it, when, and a
 *   truncated SHA-256 fingerprint — enough to answer "is this the key I
 *   pasted?" and nothing more. That fingerprint convention is the fleet
 *   standard for identifying a secret without printing it.
 * - **Audited.** Set and clear both write a hash-chained audit row. A secret
 *   that can change without a trace is worse than one that cannot change.
 * - **Never logged.** Not the key, not a prefix, not a length.
 *
 * ## Precedence
 *
 * DB value wins over env. An admin who pastes a key expects it to take
 * effect; silently preferring a stale env var would look like the screen is
 * broken. Clearing the DB value falls back to env, which is what makes this
 * safe to adopt incrementally.
 */

/** The `settings` row this lives in. The table is a generic KV store, so no
 *  migration is needed — and a secret in its own table would only advertise
 *  itself. */
export const AI_CREDENTIALS_KEY = "openai_credentials";

interface StoredCredentials {
  /** base64 of the AES-256-GCM blob from `encryptSecret`. */
  api_key_enc: string;
  /** First 8 hex chars of sha256(key). Identifies, never reconstructs. */
  fingerprint: string;
  set_at: string;
}

export interface AiCredentialStatus {
  configured: boolean;
  /** "admin" when an admin set it, "env" when falling back, null when absent. */
  source: "admin" | "env" | null;
  fingerprint: string | null;
  updatedAt: string | null;
  updatedBy: string | null;
}

/**
 * A one-way digest, truncated. Answers "same key as before?" and nothing else
 * — 8 hex chars is 32 bits, far too little to attack the preimage of a
 * high-entropy API key, and enough to spot a paste error.
 */
export function fingerprintOf(key: string): string {
  return createHash("sha256").update(key, "utf8").digest("hex").slice(0, 8);
}

function isStored(value: unknown): value is StoredCredentials {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  return typeof v.api_key_enc === "string" && typeof v.fingerprint === "string";
}

@Injectable()
export class AiCredentialsService {
  private readonly log = new Logger(AiCredentialsService.name);

  constructor(
    @Inject(DB) private readonly db: Kysely<Database>,
    private readonly config: ConfigService<Env, true>,
    private readonly audit: AuditService,
  ) {}

  private masterKey(): string {
    return this.config.get("MASTER_ENCRYPTION_KEY", { infer: true });
  }

  private envKey(): string {
    return this.config.get("OPENAI_API_KEY", { infer: true }).trim();
  }

  private async readRow(): Promise<{
    stored: StoredCredentials | null;
    updatedAt: Date | null;
    updatedBy: string | null;
  }> {
    const row = await this.db
      .selectFrom("settings")
      .select(["value", "updated_at", "updated_by"])
      .where("key", "=", AI_CREDENTIALS_KEY)
      .executeTakeFirst();

    if (!row || !isStored(row.value)) {
      return { stored: null, updatedAt: null, updatedBy: null };
    }
    return {
      stored: row.value,
      updatedAt: row.updated_at,
      updatedBy: row.updated_by,
    };
  }

  /**
   * The key to actually use: admin-set first, env second, empty when neither.
   *
   * A decryption failure returns "" rather than throwing — that would mean
   * `MASTER_ENCRYPTION_KEY` changed or the row was tampered with, and the
   * right behaviour is for drafting to report itself unconfigured, not for a
   * content screen to 500. It is logged loudly because it means someone needs
   * to re-enter the key.
   */
  async resolveKey(): Promise<string> {
    const { stored } = await this.readRow();
    if (stored) {
      try {
        return decryptSecret(
          Buffer.from(stored.api_key_enc, "base64"),
          this.masterKey(),
        );
      } catch {
        this.log.error(
          "Stored OpenAI credentials could not be decrypted — the master key " +
            "may have changed. Re-enter the key in admin settings.",
        );
        return "";
      }
    }
    return this.envKey();
  }

  /** What the admin screen renders. Never includes the key. */
  async status(): Promise<AiCredentialStatus> {
    const { stored, updatedAt, updatedBy } = await this.readRow();
    if (stored) {
      return {
        configured: true,
        source: "admin",
        fingerprint: stored.fingerprint,
        updatedAt: updatedAt?.toISOString() ?? stored.set_at,
        updatedBy,
      };
    }
    const env = this.envKey();
    return {
      configured: env !== "",
      source: env !== "" ? "env" : null,
      // Fingerprint the env key too, so an admin can tell whether the key
      // they are about to paste is the one already running.
      fingerprint: env !== "" ? fingerprintOf(env) : null,
      updatedAt: null,
      updatedBy: null,
    };
  }

  /** Store a new key. Returns its fingerprint so the UI can confirm the paste. */
  async set(
    apiKey: string,
    actor: { id: string; ip?: string },
  ): Promise<AiCredentialStatus> {
    const key = apiKey.trim();
    const fingerprint = fingerprintOf(key);
    const blob = encryptSecret(key, this.masterKey()).toString("base64");
    const now = new Date();

    const payload: StoredCredentials = {
      api_key_enc: blob,
      fingerprint,
      set_at: now.toISOString(),
    };

    await this.db
      .insertInto("settings")
      .values({
        key: AI_CREDENTIALS_KEY,
        // Kysely's Json wrapper is applied by the column type; the object is
        // serialized by the driver.
        value: payload as never,
        updated_by: actor.id,
        updated_at: now,
      })
      .onConflict((oc) =>
        oc.column("key").doUpdateSet({
          value: payload as never,
          updated_by: actor.id,
          updated_at: now,
        }),
      )
      .execute();

    // The fingerprint is in the audit metadata deliberately: it lets an
    // investigator correlate "which key was live during this window" without
    // the log ever holding the key.
    await this.audit.log({
      actorType: "admin",
      actorId: actor.id,
      action: "ai.credentials.set",
      targetType: "settings",
      targetId: AI_CREDENTIALS_KEY,
      ip: actor.ip,
      metadata: { fingerprint },
    });

    return {
      configured: true,
      source: "admin",
      fingerprint,
      updatedAt: now.toISOString(),
      updatedBy: actor.id,
    };
  }

  /** Remove the admin-set key. Falls back to env, if one is configured. */
  async clear(actor: { id: string; ip?: string }): Promise<AiCredentialStatus> {
    const { stored } = await this.readRow();
    await this.db
      .deleteFrom("settings")
      .where("key", "=", AI_CREDENTIALS_KEY)
      .execute();

    await this.audit.log({
      actorType: "admin",
      actorId: actor.id,
      action: "ai.credentials.cleared",
      targetType: "settings",
      targetId: AI_CREDENTIALS_KEY,
      ip: actor.ip,
      metadata: { fingerprint: stored?.fingerprint ?? null },
    });

    return this.status();
  }
}
