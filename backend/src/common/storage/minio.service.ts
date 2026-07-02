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

  constructor(config: ConfigService<Env, true>) {
    this.client = new Client({
      endPoint: config.get("MINIO_ENDPOINT", { infer: true }),
      port: config.get("MINIO_PORT", { infer: true }),
      useSSL: config.get("MINIO_USE_SSL", { infer: true }),
      accessKey: config.get("MINIO_ACCESS_KEY", { infer: true }),
      secretKey: config.get("MINIO_SECRET_KEY", { infer: true }),
    });
  }

  /** Server-side upload after validation pipeline. Never trust client uploads directly. */
  async putObject(bucket: Bucket, key: string, data: Buffer, contentType: string): Promise<void> {
    await this.client.putObject(bucket, key, data, data.length, { "Content-Type": contentType });
  }

  /** Short-TTL presigned GET (default 5 minutes). */
  async presignedGet(bucket: Bucket, key: string, ttlSeconds = 300): Promise<string> {
    return this.client.presignedGetObject(bucket, key, ttlSeconds);
  }

  async removeObject(bucket: Bucket, key: string): Promise<void> {
    await this.client.removeObject(bucket, key);
  }
}
