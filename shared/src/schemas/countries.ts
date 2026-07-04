import { z } from "zod";
import { zTotpCode } from "./common.js";

/**
 * Country market segmentation. The public shape lists only ENABLED markets a
 * user may sign up under; the admin shape includes disabled markets + the
 * enable/disable toggle. Enablement authority is server-side (the DB), never a
 * static enum here — launching a market must not require a contract redeploy.
 */
export const zCountry = z.object({
  code: z.string().length(2),
  nameEn: z.string(),
  nameFr: z.string(),
  dialCode: z.string(),
});
export type Country = z.infer<typeof zCountry>;

export const zCountriesResponse = z.object({ countries: z.array(zCountry) });
export type CountriesResponse = z.infer<typeof zCountriesResponse>;

/** Admin view — every market, enabled or not, for the rollout console. */
export const zAdminCountry = z.object({
  code: z.string().length(2),
  nameEn: z.string(),
  nameFr: z.string(),
  dialCode: z.string(),
  currencyCode: z.string(),
  enabled: z.boolean(),
  sortOrder: z.number().int(),
});
export type AdminCountry = z.infer<typeof zAdminCountry>;

export const zAdminCountriesResponse = z.object({ countries: z.array(zAdminCountry) });
export type AdminCountriesResponse = z.infer<typeof zAdminCountriesResponse>;

/** Enable/disable a market — TOTP step-up + a mandatory reason, like the kill switch. */
export const zSetCountryEnabledRequest = z
  .object({
    enabled: z.boolean(),
    totpCode: zTotpCode.optional(),
    reason: z.string().trim().min(5).max(1000),
  })
  .strict();
export type SetCountryEnabledRequest = z.infer<typeof zSetCountryEnabledRequest>;
