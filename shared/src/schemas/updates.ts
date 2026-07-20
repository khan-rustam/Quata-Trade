import { z } from "zod";
import { APP_PLATFORMS, RELEASE_STATUSES, UPDATE_TYPES } from "../constants.js";
import { zTotpCode, zUuid } from "./common.js";

/** Human-facing semver-ish label, e.g. "1.4.2". */
export const zVersionLabel = z
  .string()
  .trim()
  .regex(/^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/, "version must look like 1.2.3");

/**
 * Monotonic build ordinal. Ordering NEVER uses the semver string ("1.10.0" sorts
 * before "1.9.0" lexically) — this integer is the single source of order.
 */
export const zVersionCode = z.number().int().positive().max(2_147_483_647);

export const zAppRelease = z.object({
  id: zUuid,
  platform: z.enum(APP_PLATFORMS),
  version: z.string(),
  versionCode: z.number().int(),
  updateType: z.enum(UPDATE_TYPES),
  status: z.enum(RELEASE_STATUSES),
  releaseNotes: z.string(),
  minSupportedCode: z.number().int(),
  /** Binary platforms only (APK); null for web/pwa which update via the service worker. */
  artifactUrl: z.string().nullable(),
  checksumSha256: z.string().nullable(),
  signature: z.string().nullable(),
  releasedAt: z.string(),
});
export type AppRelease = z.infer<typeof zAppRelease>;

/** GET /updates/version — the current production release for a platform. */
export const zVersionResponse = z.object({
  platform: z.enum(APP_PLATFORMS),
  latest: zAppRelease.nullable(),
  minSupportedCode: z.number().int(),
});
export type VersionResponse = z.infer<typeof zVersionResponse>;

/**
 * GET /updates/check — "I'm on versionCode N, what should I do?"
 * `supported=false` ⇒ the client must update before using the API further.
 */
export const zCheckUpdateResponse = z.object({
  platform: z.enum(APP_PLATFORMS),
  currentCode: z.number().int(),
  updateAvailable: z.boolean(),
  /** True when the installed build is below minSupportedCode (hard gate). */
  mustUpdate: z.boolean(),
  supported: z.boolean(),
  updateType: z.enum(UPDATE_TYPES).nullable(),
  latest: zAppRelease.nullable(),
  minSupportedCode: z.number().int(),
});
export type CheckUpdateResponse = z.infer<typeof zCheckUpdateResponse>;

export const zReleasesResponse = z.object({ items: z.array(zAppRelease) });
export type ReleasesResponse = z.infer<typeof zReleasesResponse>;

export const zMinSupportedResponse = z.object({
  platform: z.enum(APP_PLATFORMS),
  minSupportedCode: z.number().int(),
});
export type MinSupportedResponse = z.infer<typeof zMinSupportedResponse>;

/** Admin: publish a release. Strict — unknown fields rejected. */
export const zPublishReleaseRequest = z
  .object({
    platform: z.enum(APP_PLATFORMS),
    version: zVersionLabel,
    versionCode: zVersionCode,
    updateType: z.enum(UPDATE_TYPES),
    releaseNotes: z.string().trim().max(5000).default(""),
    minSupportedCode: zVersionCode,
    artifactUrl: z.string().url().max(2000).nullable().optional(),
    checksumSha256: z
      .string()
      .regex(/^[a-f0-9]{64}$/i, "checksum must be 64 hex chars")
      .nullable()
      .optional(),
    signature: z.string().max(4000).nullable().optional(),
    totpCode: zTotpCode.optional(),
  })
  .strict()
  .refine((v) => v.minSupportedCode <= v.versionCode, {
    message: "minSupportedCode cannot exceed the release's own versionCode",
    path: ["minSupportedCode"],
  })
  .refine((v) => v.platform === "web" || v.platform === "pwa" || Boolean(v.artifactUrl), {
    message: "binary platforms require an artifactUrl",
    path: ["artifactUrl"],
  });
export type PublishReleaseRequest = z.infer<typeof zPublishReleaseRequest>;

/** Admin: roll back / archive a release. */
export const zReleaseStatusRequest = z
  .object({
    status: z.enum(["rolled_back", "archived"]),
    reason: z.string().trim().min(5).max(500),
    totpCode: zTotpCode.optional(),
  })
  .strict();
export type ReleaseStatusRequest = z.infer<typeof zReleaseStatusRequest>;
