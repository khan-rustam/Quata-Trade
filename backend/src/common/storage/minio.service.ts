import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Client } from "minio";
import type { Env } from "../../config/env";

export type Bucket = "kyc" | "proofs" | "disputes" | "chat";

/**
 * Private object storage (Documents/02: MinIO, private buckets, presigned
 * URLs with short TTL, never public, never in webroot).
 */
@Injectable()
export class MinioService {
  private readonly client: Client;
  /** SSE-S3 at-rest encryption (item 6b): MinIO encrypts objects with its KMS; presigned GET is transparent. */
  private readonly sseEnabled: boolean;

  constructor(config: ConfigService<Env, true>) {
    this.client = new Client({
      endPoint: config.get("MINIO_ENDPOINT", { infer: true }),
      port: config.get("MINIO_PORT", { infer: true }),
      useSSL: config.get("MINIO_USE_SSL", { infer: true }),
      accessKey: config.get("MINIO_ACCESS_KEY", { infer: true }),
      secretKey: config.get("MINIO_SECRET_KEY", { infer: true }),
    });
    this.sseEnabled = config.get("STORAGE_SSE_ENABLED", { infer: true });
  }

  /**
   * Server-side upload after validation pipeline. Never trust client uploads
   * directly. When STORAGE_SSE_ENABLED, requests SSE-S3 so the object is
   * encrypted at rest (KYC/PII) — MinIO must have KMS configured (ops). Presigned
   * GET stays transparent (unlike app-level encryption, which would break it).
   */
  async putObject(bucket: Bucket, key: string, data: Buffer, contentType: string): Promise<void> {
    const metaData: Record<string, string> = { "Content-Type": contentType };
    if (this.sseEnabled) metaData["X-Amz-Server-Side-Encryption"] = "AES256";
    await this.client.putObject(bucket, key, data, data.length, metaData);
  }

  /** Short-TTL presigned GET (default 5 minutes). */
  async presignedGet(bucket: Bucket, key: string, ttlSeconds = 300): Promise<string> {
    return this.client.presignedGetObject(bucket, key, ttlSeconds);
  }

  async removeObject(bucket: Bucket, key: string): Promise<void> {
    await this.client.removeObject(bucket, key);
  }

  /**
   * Cheap reachability probe for health checks: a completed `bucketExists` call
   * (true OR false) proves the object store answered; only a connection/auth
   * failure throws → reported as down. No object is read or written.
   */
  async ping(): Promise<boolean> {
    try {
      await this.client.bucketExists("kyc");
      return true;
    } catch {
      return false;
    }
  }
}
