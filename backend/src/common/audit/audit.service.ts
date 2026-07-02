import { createHash } from "node:crypto";
import { Inject, Injectable } from "@nestjs/common";
import { sql, type Kysely, type Transaction } from "kysely";
import { DB } from "../../db/database.module";
import type { Database } from "../../db/types";
import { newId } from "../ids";

export interface AuditEntry {
  actorType: "admin" | "user" | "system";
  actorId: string | null;
  action: string;
  targetType?: string;
  targetId?: string;
  ip?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Deterministic JSON: object keys sorted recursively, undefined dropped.
 * REQUIRED for the hash chain — PostgreSQL jsonb does NOT preserve key order
 * (it sorts by length, then bytewise), so hashing raw JSON.stringify output
 * at write time made verifyChain() falsely flag every row whose metadata has
 * more than one key. Both log() and verifyChain() must use this.
 */
function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value !== null && typeof value === "object") {
    const source = value as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(source).sort()) {
      const item = source[key];
      if (item !== undefined) out[key] = canonicalize(item);
    }
    return out;
  }
  return value;
}

function canonicalJson(value: Record<string, unknown>): string {
  return JSON.stringify(canonicalize(value));
}

/**
 * Append-only, hash-chained audit log (Documents/04 §4.7, 08 §G).
 * row_hash = sha256(prev_hash ‖ canonical(entry)) — editing any historical row
 * breaks every subsequent hash. Chain head is serialized with an advisory
 * lock so concurrent writers can't fork the chain.
 */
@Injectable()
export class AuditService {
  constructor(@Inject(DB) private readonly db: Kysely<Database>) {}

  async log(entry: AuditEntry, trx?: Transaction<Database>): Promise<string> {
    const run = async (t: Transaction<Database>): Promise<string> => {
      await sql`SELECT pg_advisory_xact_lock(hashtext('audit_chain'))`.execute(t);
      const prev = await t
        .selectFrom("audit_logs")
        .select("row_hash")
        .orderBy("created_at", "desc")
        .orderBy("id", "desc")
        .limit(1)
        .executeTakeFirst();

      const id = newId();
      const prevHash = prev?.row_hash ?? Buffer.alloc(32);
      const canonical = canonicalJson({
        id,
        actorType: entry.actorType,
        actorId: entry.actorId,
        action: entry.action,
        targetType: entry.targetType ?? null,
        targetId: entry.targetId ?? null,
        metadata: entry.metadata ?? null,
      });
      const rowHash = createHash("sha256").update(prevHash).update(canonical).digest();

      await t
        .insertInto("audit_logs")
        .values({
          id,
          actor_type: entry.actorType,
          actor_id: entry.actorId,
          action: entry.action,
          target_type: entry.targetType ?? null,
          target_id: entry.targetId ?? null,
          ip: entry.ip ?? null,
          metadata: entry.metadata ? JSON.stringify(entry.metadata) : null,
          prev_hash: prevHash,
          row_hash: rowHash,
        })
        .execute();
      return id;
    };
    return trx ? run(trx) : this.db.transaction().execute(run);
  }

  /** Tamper check: recompute the chain; returns ids whose hash no longer matches. */
  async verifyChain(): Promise<string[]> {
    const rows = await this.db
      .selectFrom("audit_logs")
      .select(["id", "actor_type", "actor_id", "action", "target_type", "target_id", "metadata", "prev_hash", "row_hash"])
      .orderBy("created_at", "asc")
      .orderBy("id", "asc")
      .execute();

    const broken: string[] = [];
    let prevHash: Buffer = Buffer.alloc(32);
    for (const row of rows) {
      const canonical = canonicalJson({
        id: row.id,
        actorType: row.actor_type,
        actorId: row.actor_id,
        action: row.action,
        targetType: row.target_type,
        targetId: row.target_id,
        metadata: row.metadata,
      });
      const expected = createHash("sha256").update(prevHash).update(canonical).digest();
      if (!row.row_hash || !expected.equals(row.row_hash) || !row.prev_hash || !prevHash.equals(row.prev_hash)) {
        broken.push(row.id);
      }
      prevHash = row.row_hash ?? expected;
    }
    return broken;
  }
}
